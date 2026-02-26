"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const supabase_js_1 = require("./supabase.js");
const helpers_js_1 = require("./helpers.js");
const server = new mcp_js_1.McpServer({
    name: 'supplier-data-server',
    version: '1.0.0',
});
// ─── Tool 1: get_suppliers_for_sku ───
server.tool('get_suppliers_for_sku', 'Get all suppliers that can provide a given SKU, with their performance metrics and pricing.', { sku: zod_1.z.string().describe('Product SKU to find suppliers for') }, async ({ sku }) => {
    try {
        // Get product category first
        const { data: product, error: pErr } = await supabase_js_1.supabase
            .from('products').select('category').eq('sku', sku).single();
        if (pErr)
            return (0, helpers_js_1.errorResponse)(`Product not found: ${sku}`);
        // Get supplier-product mappings with supplier details
        const { data, error } = await supabase_js_1.supabase
            .from('supplier_products')
            .select(`
          unit_price, moq_override,
          suppliers(id, name, region, lead_time_days, quality_score, delivery_performance, cost_rating)
        `)
            .eq('sku', sku);
        if (error)
            return (0, helpers_js_1.errorResponse)(error.message);
        const suppliers = data.map((row) => ({
            supplier_id: row.suppliers.id,
            name: row.suppliers.name,
            region: row.suppliers.region,
            lead_time_days: row.suppliers.lead_time_days,
            quality_score: row.suppliers.quality_score,
            delivery_performance: row.suppliers.delivery_performance,
            cost_rating: row.suppliers.cost_rating,
            unit_price: row.unit_price,
            moq_override: row.moq_override,
        }));
        return (0, helpers_js_1.jsonResponse)({
            sku,
            category: product.category,
            supplier_count: suppliers.length,
            suppliers,
        });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 2: get_scoring_weights ───
server.tool('get_scoring_weights', 'Get the supplier decision matrix weights for a product category.', { category: zod_1.z.string().describe('Product category: filters, gaskets, engine_parts, electrical') }, async ({ category }) => {
    try {
        const { data, error } = await supabase_js_1.supabase
            .from('supplier_scoring_weights')
            .select('*')
            .eq('category', category)
            .single();
        if (error)
            return (0, helpers_js_1.errorResponse)(error.message);
        return (0, helpers_js_1.jsonResponse)(data);
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 3: get_supplier_history ───
server.tool('get_supplier_history', 'Get past decision records involving this supplier from the decision log.', { supplier_id: zod_1.z.string().describe('Supplier ID, e.g. SUP-A') }, async ({ supplier_id }) => {
    try {
        const { data, error } = await supabase_js_1.supabase
            .from('decision_log')
            .select('*')
            .eq('agent', 'supplier_selector')
            .ilike('output', `%${supplier_id}%`)
            .order('timestamp', { ascending: false })
            .limit(20);
        if (error)
            return (0, helpers_js_1.errorResponse)(error.message);
        return (0, helpers_js_1.jsonResponse)({
            supplier_id,
            history_count: data.length,
            decisions: data,
            note: data.length === 0 ? 'No history yet. This populates as the pipeline runs.' : undefined,
        });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 4: update_scoring_weights ───
server.tool('update_scoring_weights', 'Update the supplier scoring weights for a category. All 4 weights must sum to 1.0.', {
    category: zod_1.z.string().describe('Product category'),
    delivery_weight: zod_1.z.number().describe('Weight for delivery performance (0-1)'),
    quality_weight: zod_1.z.number().describe('Weight for quality score (0-1)'),
    lead_time_weight: zod_1.z.number().describe('Weight for lead time (0-1)'),
    cost_weight: zod_1.z.number().describe('Weight for cost rating (0-1)'),
}, async ({ category, delivery_weight, quality_weight, lead_time_weight, cost_weight }) => {
    try {
        const sum = delivery_weight + quality_weight + lead_time_weight + cost_weight;
        if (Math.abs(sum - 1.0) > 0.01) {
            return (0, helpers_js_1.errorResponse)(`Weights must sum to 1.0. Current sum: ${sum}`);
        }
        const { data, error } = await supabase_js_1.supabase
            .from('supplier_scoring_weights')
            .update({ delivery_weight, quality_weight, lead_time_weight, cost_weight })
            .eq('category', category)
            .select();
        if (error)
            return (0, helpers_js_1.errorResponse)(error.message);
        return (0, helpers_js_1.jsonResponse)({ updated: true, weights: data[0] });
    }
    catch (e) {
        return (0, helpers_js_1.errorResponse)(e.message);
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('supplier-data-server running on stdio');
}
main().catch(console.error);
