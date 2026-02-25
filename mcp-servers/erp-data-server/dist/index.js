"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const supabase_js_1 = require("./supabase.js");
const helper_js_1 = require("./helper.js");
const server = new mcp_js_1.McpServer({
    name: 'erp-data-server',
    version: '1.0.0',
});
// ─── Tool 1: get_products ───
server.tool('get_products', 'Fetch product catalog. Optionally filter by category.', { category: zod_1.z.string().optional().describe('Filter by category: filters, gaskets, engine_parts, electrical') }, async ({ category }) => {
    try {
        let query = supabase_js_1.supabase.from('products').select('*');
        if (category)
            query = query.eq('category', category);
        const { data, error } = await query;
        if (error)
            return (0, helper_js_1.errorResponse)(error.message);
        return (0, helper_js_1.jsonResponse)({ count: data.length, products: data });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 2: get_inventory ───
server.tool('get_inventory', 'Fetch current inventory levels. Pass sku for one product, or omit for all.', { sku: zod_1.z.string().optional().describe('Product SKU. Omit for all inventory.') }, async ({ sku }) => {
    try {
        let query = supabase_js_1.supabase.from('inventory').select(`
        *,
        products(name, category, moq, unit_weight_kg, unit_cbm, unit_price_usd)
      `);
        if (sku)
            query = query.eq('sku', sku);
        const { data, error } = await query;
        if (error)
            return (0, helper_js_1.errorResponse)(error.message);
        return (0, helper_js_1.jsonResponse)({ count: data.length, inventory: data });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 3: get_forecasts ───
server.tool('get_forecasts', 'Fetch demand forecast data for a SKU. Returns monthly forecast_qty and actual_qty.', {
    sku: zod_1.z.string().describe('Product SKU'),
    months: zod_1.z.number().optional().describe('Number of months to fetch (default 12)'),
}, async ({ sku, months }) => {
    try {
        const limit = months ?? 12;
        const { data, error } = await supabase_js_1.supabase
            .from('forecasts')
            .select('*')
            .eq('sku', sku)
            .order('period', { ascending: true })
            .limit(limit);
        if (error)
            return (0, helper_js_1.errorResponse)(error.message);
        // Calculate demand variability stats
        const historicalDiffs = data
            .filter((r) => r.actual_qty !== null)
            .map((r) => r.actual_qty - r.forecast_qty);
        const mean = historicalDiffs.length > 0
            ? historicalDiffs.reduce((a, b) => a + b, 0) / historicalDiffs.length : 0;
        const variance = historicalDiffs.length > 0
            ? historicalDiffs.reduce((s, d) => s + (d - mean) ** 2, 0) / historicalDiffs.length : 0;
        const stdDev = Math.sqrt(variance);
        return (0, helper_js_1.jsonResponse)({
            sku,
            months: data.length,
            forecasts: data,
            variability: {
                mean_error: Math.round(mean * 100) / 100,
                std_deviation: Math.round(stdDev * 100) / 100,
                historical_months: historicalDiffs.length,
            },
        });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 4: update_buffer_stock ───
server.tool('update_buffer_stock', 'Write calculated buffer stock and reorder point back to inventory table.', {
    sku: zod_1.z.string().describe('Product SKU'),
    buffer_stock: zod_1.z.number().describe('Calculated buffer stock quantity'),
    reorder_point: zod_1.z.number().describe('Calculated reorder point'),
}, async ({ sku, buffer_stock, reorder_point }) => {
    try {
        const { data, error } = await supabase_js_1.supabase
            .from('inventory')
            .update({ buffer_stock, reorder_point, updated_at: new Date().toISOString() })
            .eq('sku', sku)
            .select();
        if (error)
            return (0, helper_js_1.errorResponse)(error.message);
        return (0, helper_js_1.jsonResponse)({ updated: true, inventory: data[0] });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 5: upload_erp_excel ───
server.tool('upload_erp_excel', 'Parse an uploaded Excel file (base64) and upsert data into products/inventory/forecasts.', { base64_data: zod_1.z.string().describe('Base64 encoded Excel file content') }, async ({ base64_data }) => {
    try {
        // For now, return a placeholder. Full Excel parsing will be added in Part 6
        // when the file upload UI component is built.
        return (0, helper_js_1.jsonResponse)({
            status: 'placeholder',
            message: 'Excel upload tool registered. Full implementation in Part 6.',
        });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Start Server ───
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('erp-data-server running on stdio');
}
main().catch(console.error);
