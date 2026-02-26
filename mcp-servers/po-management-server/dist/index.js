import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const server = new McpServer({ name: 'po-management-server', version: '1.0.0' });
server.tool('ping', 'Health check', {}, async () => ({
    content: [{ type: 'text', text: JSON.stringify({ server: 'po-management-server', status: 'ok', timestamp: new Date().toISOString() }) }]
}));
// ─── CREATE DRAFT PO ─────────────────────────────────────────
server.tool('create_draft_po', 'Creates a draft Purchase Order with line items in Supabase. Returns the PO number.', {
    run_id: z.string().describe('The pipeline run ID'),
    created_by: z.string().optional().describe('User who triggered the run'),
    line_items: z.array(z.object({
        sku: z.string(),
        supplier_id: z.string(),
        qty_ordered: z.number().positive(),
        unit_price: z.number().positive(),
        rationale: z.string().optional(),
    })).describe('Line items for this PO'),
    container_plan: z.object({
        container_type: z.string(),
        num_containers: z.number(),
        total_weight_kg: z.number(),
        total_cbm: z.number(),
        binding_utilisation_pct: z.number(),
        estimated_freight_usd: z.number(),
    }).optional().describe('Container plan from logistics agent'),
    notes: z.string().optional(),
}, async ({ run_id, created_by = 'system', line_items, container_plan, notes }) => {
    // Generate PO number: PO-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const po_number = `PO-${dateStr}-${suffix}`;
    // Calculate total
    const total_usd = line_items.reduce((sum, item) => sum + item.qty_ordered * item.unit_price, 0);
    // Insert PO header
    const { error: poError } = await supabase.from('purchase_orders').insert({
        po_number,
        status: 'draft',
        created_by,
        run_id,
        total_usd: Math.round(total_usd * 100) / 100,
        container_plan: container_plan ?? null,
        notes: notes ?? null,
    });
    if (poError)
        throw new Error(`create_draft_po insert failed: ${poError.message}`);
    // Insert line items
    const lineRows = line_items.map(item => ({
        po_number,
        sku: item.sku,
        supplier_id: item.supplier_id,
        qty_ordered: item.qty_ordered,
        unit_price: item.unit_price,
        rationale: item.rationale ?? null,
    }));
    const { error: lineError } = await supabase.from('po_line_items').insert(lineRows);
    if (lineError)
        throw new Error(`create_draft_po line items failed: ${lineError.message}`);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    po_number,
                    status: 'draft',
                    total_usd: Math.round(total_usd * 100) / 100,
                    line_item_count: line_items.length,
                })
            }]
    };
});
// ─── GET POs ─────────────────────────────────────────────────
server.tool('get_pos', 'Returns Purchase Orders, optionally filtered by status. Includes line items.', {
    status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'all']).optional().describe('Filter by status (default: all)'),
    run_id: z.string().optional().describe('Filter by pipeline run ID'),
    limit: z.number().min(1).max(50).optional().describe('Max results (default 20)'),
}, async ({ status, run_id, limit = 20 }) => {
    let query = supabase.from('purchase_orders').select(`
      *,
      po_line_items (sku, supplier_id, qty_ordered, unit_price, total_price, rationale)
    `);
    if (status && status !== 'all')
        query = query.eq('status', status);
    if (run_id)
        query = query.eq('run_id', run_id);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
    if (error)
        throw new Error(`get_pos failed: ${error.message}`);
    return { content: [{ type: 'text', text: JSON.stringify({ purchase_orders: data, count: data?.length ?? 0 }) }] };
});
// ─── UPDATE PO STATUS ─────────────────────────────────────────
server.tool('update_po_status', 'Updates a Purchase Order status. Use for approval, rejection, or submission for review.', {
    po_number: z.string().describe('The PO number to update'),
    new_status: z.enum(['pending_approval', 'approved', 'rejected']).describe('New status'),
    reviewer: z.string().optional().describe('Name of the person taking action'),
    notes: z.string().optional().describe('Reviewer notes or rejection reason'),
    line_item_overrides: z.array(z.object({
        sku: z.string(),
        new_qty: z.number().positive(),
    })).optional().describe('Planner quantity overrides before submission'),
}, async ({ po_number, new_status, reviewer, notes, line_item_overrides }) => {
    const updateData = { status: new_status };
    if (new_status === 'approved' || new_status === 'rejected') {
        updateData.approved_by = reviewer ?? 'unknown';
        updateData.approved_at = new Date().toISOString();
    }
    if (notes)
        updateData.notes = notes;
    // Apply any line item quantity overrides
    if (line_item_overrides && line_item_overrides.length > 0) {
        for (const override of line_item_overrides) {
            await supabase
                .from('po_line_items')
                .update({ qty_ordered: override.new_qty })
                .eq('po_number', po_number)
                .eq('sku', override.sku);
        }
        // Recalculate total
        const { data: lines } = await supabase
            .from('po_line_items')
            .select('qty_ordered, unit_price')
            .eq('po_number', po_number);
        const newTotal = (lines ?? []).reduce((sum, l) => sum + l.qty_ordered * l.unit_price, 0);
        updateData.total_usd = Math.round(newTotal * 100) / 100;
    }
    const { error } = await supabase.from('purchase_orders').update(updateData).eq('po_number', po_number);
    if (error)
        throw new Error(`update_po_status failed: ${error.message}`);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ success: true, po_number, new_status, reviewer, timestamp: new Date().toISOString() })
            }]
    };
});
// ─── LOG DECISION ─────────────────────────────────────────────
server.tool('log_decision', 'Writes an agent decision record to the audit log in Supabase.', {
    run_id: z.string().describe('Pipeline run ID'),
    agent_name: z.string().describe('Name of the agent making this decision'),
    inputs: z.record(z.string(), z.unknown()).describe('Inputs the agent received'),
    output: z.record(z.string(), z.unknown()).describe('Agent output / decision'),
    confidence: z.number().min(0).max(1).optional().describe('Confidence score 0–1'),
    rationale: z.string().describe('Human-readable explanation of the decision'),
    po_number: z.string().optional().describe('Associated PO number if applicable'),
}, async ({ run_id, agent_name, inputs, output, confidence, rationale, po_number }) => {
    const { error } = await supabase.from('decision_log').insert({
        run_id,
        agent_name,
        po_number: po_number ?? null,
        inputs,
        output,
        confidence: confidence ?? null,
        rationale,
        timestamp: new Date().toISOString(),
    });
    if (error)
        throw new Error(`log_decision failed: ${error.message}`);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, agent_name, run_id }) }] };
});
// ─── GET DECISION LOG ────────────────────────────────────────
server.tool('get_decision_log', 'Returns decision log entries for a run or PO.', {
    run_id: z.string().optional().describe('Filter by pipeline run ID'),
    po_number: z.string().optional().describe('Filter by PO number'),
    agent_name: z.string().optional().describe('Filter by agent name'),
    limit: z.number().min(1).max(100).optional().describe('Max results (default 50)'),
}, async ({ run_id, po_number, agent_name, limit = 50 }) => {
    let query = supabase.from('decision_log').select('*');
    if (run_id)
        query = query.eq('run_id', run_id);
    if (po_number)
        query = query.eq('po_number', po_number);
    if (agent_name)
        query = query.eq('agent_name', agent_name);
    const { data, error } = await query.order('timestamp', { ascending: true }).limit(limit);
    if (error)
        throw new Error(`get_decision_log failed: ${error.message}`);
    return { content: [{ type: 'text', text: JSON.stringify({ entries: data, count: data?.length ?? 0 }) }] };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PO Management Server running on stdio');
}
main().catch(console.error);
