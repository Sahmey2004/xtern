"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const supabase_js_1 = require("./supabase.js");
const helpers_js_1 = require("./helpers.js");
const server = new mcp_js_1.McpServer({ name: 'po-management-server', version: '1.0.0' });
// ─── Helper: generate PO number ───
function generatePONumber() {
    const d = new Date();
    const date = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 900) + 100;
    return `PO-${date}-${rand}`;
}
// ─── Tool 1: create_draft_po ───
server.tool('create_draft_po', 'Create a new Purchase Order in draft status with line items.', {
    supplier_id: zod_1.z.string(),
    run_id: zod_1.z.string().optional(),
    order_date: zod_1.z.string().describe('ISO date string'),
    expected_delivery: zod_1.z.string().describe('ISO date string'),
    line_items: zod_1.z.array(zod_1.z.object({
        sku: zod_1.z.string(),
        quantity: zod_1.z.number(),
        unit_price: zod_1.z.number(),
    })),
}, async ({ supplier_id, run_id, order_date, expected_delivery, line_items }) => {
    try {
        const po_number = generatePONumber();
        const total_value = line_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        // Insert PO header
        const { error: poErr } = await supabase_js_1.supabase.from('purchase_orders').insert({
            po_number, supplier_id, run_id: run_id || null, status: 'draft',
            total_value: Math.round(total_value * 100) / 100,
            order_date, expected_delivery,
        });
        if (poErr)
            return (0, helpers_js_1.errorResponse)(poErr.message);
        // Insert line items
        const rows = line_items.map(i => ({
            po_number, sku: i.sku, quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: Math.round(i.quantity * i.unit_price * 100) / 100,
        }));
        const { error: liErr } = await supabase_js_1.supabase.from('po_line_items').insert(rows);
        if (liErr)
            return (0, helpers_js_1.errorResponse)(liErr.message);
        return (0, helpers_js_1.jsonResponse)({
            po_number, status: 'draft', supplier_id, total_value,
            line_item_count: rows.length,
        });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 2: submit_for_approval ───
server.tool('submit_for_approval', 'Move a draft PO to pending_approval and create an approval queue entry.', { po_number: zod_1.z.string() }, async ({ po_number }) => {
    try {
        const { error: upErr } = await supabase_js_1.supabase
            .from('purchase_orders')
            .update({ status: 'pending_approval' })
            .eq('po_number', po_number);
        if (upErr)
            return (0, helpers_js_1.errorResponse)(upErr.message);
        const { error: aqErr } = await supabase_js_1.supabase
            .from('approval_queue')
            .insert({ po_number, status: 'pending' });
        if (aqErr)
            return (0, helpers_js_1.errorResponse)(aqErr.message);
        return (0, helpers_js_1.jsonResponse)({ po_number, status: 'pending_approval' });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 3: get_approval_queue ───
server.tool('get_approval_queue', 'Get all POs awaiting approval with details.', {}, async () => {
    try {
        const { data, error } = await supabase_js_1.supabase
            .from('approval_queue')
            .select(`
          *,
          purchase_orders(po_number, supplier_id, total_value, order_date, expected_delivery,
            suppliers(name, region))
        `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error)
            return (0, helpers_js_1.errorResponse)(error.message);
        return (0, helpers_js_1.jsonResponse)({ pending_count: data.length, queue: data });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 4: approve_po ───
server.tool('approve_po', 'Approve a pending Purchase Order.', {
    po_number: zod_1.z.string(),
    reviewer: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
}, async ({ po_number, reviewer, notes }) => {
    try {
        const now = new Date().toISOString();
        await supabase_js_1.supabase.from('purchase_orders')
            .update({ status: 'approved', approved_by: reviewer, approved_at: now })
            .eq('po_number', po_number);
        await supabase_js_1.supabase.from('approval_queue')
            .update({ status: 'approved', reviewer, notes, decided_at: now })
            .eq('po_number', po_number);
        return (0, helpers_js_1.jsonResponse)({ po_number, status: 'approved', reviewer });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 5: reject_po ───
server.tool('reject_po', 'Reject a pending Purchase Order with a reason.', {
    po_number: zod_1.z.string(),
    reviewer: zod_1.z.string(),
    reason: zod_1.z.string(),
}, async ({ po_number, reviewer, reason }) => {
    try {
        const now = new Date().toISOString();
        await supabase_js_1.supabase.from('purchase_orders')
            .update({ status: 'rejected', rejection_reason: reason })
            .eq('po_number', po_number);
        await supabase_js_1.supabase.from('approval_queue')
            .update({ status: 'rejected', reviewer, notes: reason, decided_at: now })
            .eq('po_number', po_number);
        return (0, helpers_js_1.jsonResponse)({ po_number, status: 'rejected', reason });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 6: modify_po ───
server.tool('modify_po', 'Apply modifications from human reviewer to a PO (quantity changes, supplier override).', {
    po_number: zod_1.z.string(),
    reviewer: zod_1.z.string(),
    modifications: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).describe('JSON object with changes'),
}, async ({ po_number, reviewer, modifications }) => {
    try {
        const now = new Date().toISOString();
        await supabase_js_1.supabase.from('approval_queue')
            .update({ status: 'modified', reviewer, modifications, decided_at: now })
            .eq('po_number', po_number);
        await supabase_js_1.supabase.from('purchase_orders')
            .update({ status: 'draft' }) // Back to draft for re-processing
            .eq('po_number', po_number);
        return (0, helpers_js_1.jsonResponse)({ po_number, status: 'modified', modifications });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 7: log_decision ───
server.tool('log_decision', 'Write a traceability record to the decision log. Called by all 4 agents after every action.', {
    agent: zod_1.z.string().describe('Agent name: demand_analyst, supplier_selector, container_optimizer, po_compiler'),
    action: zod_1.z.string().describe('What action was performed'),
    run_id: zod_1.z.string().optional(),
    inputs: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    output: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    confidence: zod_1.z.number().optional().describe('0 to 1'),
    rationale: zod_1.z.string().optional(),
}, async ({ agent, action, run_id, inputs, output, confidence, rationale }) => {
    try {
        const { data, error } = await supabase_js_1.supabase.from('decision_log').insert({
            agent, action, run_id: run_id || null,
            inputs: inputs || {}, output: output || {},
            confidence: confidence || null, rationale: rationale || null,
        }).select();
        if (error)
            return (0, helpers_js_1.errorResponse)(error.message);
        return (0, helpers_js_1.jsonResponse)({ logged: true, decision_id: data[0].id });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('po-management-server running on stdio');
}
main().catch(console.error);
