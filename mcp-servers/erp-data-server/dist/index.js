import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
for (const envPath of [join(__dirname, '../../../.env'), join(__dirname, '../../../backend/.env')]) {
    dotenv.config({ path: envPath, override: false, quiet: true });
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const server = new McpServer({ name: 'erp-data-server', version: '1.0.0' });
server.tool('ping', 'Health check', {}, async () => ({
    content: [{ type: 'text', text: JSON.stringify({ server: 'erp-data-server', status: 'ok', timestamp: new Date().toISOString() }) }]
}));
server.tool('get_products', 'Returns products with MOQ, weight, volume, and price.', {
    skus: z.array(z.string()).optional().describe('Filter to specific SKUs'),
    category: z.string().optional().describe('Category: filters, gaskets, engine_parts, electrical'),
}, async ({ skus, category }) => {
    let query = supabase.from('products').select('*');
    if (skus && skus.length > 0)
        query = query.in('sku', skus);
    if (category)
        query = query.eq('category', category);
    const { data, error } = await query.order('sku');
    if (error)
        throw new Error(`get_products failed: ${error.message}`);
    return { content: [{ type: 'text', text: JSON.stringify({ products: data, count: data?.length ?? 0 }) }] };
});
server.tool('get_inventory', 'Returns current inventory positions. Optionally filter to SKUs below reorder point.', {
    skus: z.array(z.string()).optional().describe('Filter to specific SKUs'),
    below_reorder_only: z.boolean().optional().describe('Only SKUs at or below reorder point'),
}, async ({ skus, below_reorder_only }) => {
    let query = supabase.from('inventory').select('*, products(name, category, moq, unit_weight_kg, unit_cbm)');
    if (skus && skus.length > 0)
        query = query.in('sku', skus);
    const { data, error } = await query;
    if (error)
        throw new Error(`get_inventory failed: ${error.message}`);
    let result = data ?? [];
    if (below_reorder_only) {
        result = result.filter((r) => (r.current_stock + r.in_transit) <= r.reorder_point);
    }
    return { content: [{ type: 'text', text: JSON.stringify({ inventory: result, count: result.length }) }] };
});
server.tool('get_forecasts', 'Returns demand forecasts for a planning horizon. Defaults to next 3 months.', {
    skus: z.array(z.string()).optional().describe('Filter to specific SKUs'),
    months_ahead: z.number().min(1).max(12).optional().describe('Future months to include (default 3)'),
    include_historical: z.boolean().optional().describe('Also include past months with actuals'),
}, async ({ skus, months_ahead = 3, include_historical = false }) => {
    const today = new Date();
    const futureEnd = new Date(today.getFullYear(), today.getMonth() + months_ahead, 1);
    let query = supabase.from('forecasts').select('*');
    if (skus && skus.length > 0)
        query = query.in('sku', skus);
    if (include_historical) {
        query = query.lte('period', futureEnd.toISOString().slice(0, 10));
    }
    else {
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        query = query
            .gte('period', currentMonth.toISOString().slice(0, 10))
            .lte('period', futureEnd.toISOString().slice(0, 10));
    }
    const { data, error } = await query.order('sku').order('period');
    if (error)
        throw new Error(`get_forecasts failed: ${error.message}`);
    const summaryMap = {};
    for (const row of (data ?? [])) {
        if (!summaryMap[row.sku])
            summaryMap[row.sku] = { sku: row.sku, total_forecast: 0, months: 0 };
        summaryMap[row.sku].total_forecast += row.forecast_qty;
        summaryMap[row.sku].months += 1;
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ forecasts: data, summary_by_sku: Object.values(summaryMap), horizon_months: months_ahead, count: data?.length ?? 0 })
            }]
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('ERP Data Server running on stdio');
}
main().catch(console.error);
