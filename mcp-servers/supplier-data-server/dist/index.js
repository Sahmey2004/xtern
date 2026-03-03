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
const server = new McpServer({ name: 'supplier-data-server', version: '1.0.0' });
server.tool('ping', 'Health check', {}, async () => ({
    content: [{ type: 'text', text: JSON.stringify({ server: 'supplier-data-server', status: 'ok', timestamp: new Date().toISOString() }) }]
}));
// ─── GET SUPPLIERS ───────────────────────────────────────────
server.tool('get_suppliers', 'Returns all suppliers with quality, delivery, lead time, and cost scores.', {
    supplier_ids: z.array(z.string()).optional().describe('Filter to specific supplier IDs'),
    region: z.string().optional().describe('Filter by region'),
}, async ({ supplier_ids, region }) => {
    let query = supabase.from('suppliers').select('*');
    if (supplier_ids && supplier_ids.length > 0)
        query = query.in('id', supplier_ids);
    if (region)
        query = query.eq('region', region);
    const { data, error } = await query.order('id');
    if (error)
        throw new Error(`get_suppliers failed: ${error.message}`);
    return { content: [{ type: 'text', text: JSON.stringify({ suppliers: data, count: data?.length ?? 0 }) }] };
});
// ─── GET SUPPLIER PRODUCTS ───────────────────────────────────
server.tool('get_supplier_products', 'Returns supplier-product pricing mappings. Use to find which suppliers carry which SKUs and at what price.', {
    skus: z.array(z.string()).optional().describe('Filter to specific SKUs'),
    supplier_ids: z.array(z.string()).optional().describe('Filter to specific suppliers'),
}, async ({ skus, supplier_ids }) => {
    let query = supabase.from('supplier_products').select(`
      *,
      suppliers (name, region, lead_time_days, quality_score, delivery_performance, cost_rating),
      products (name, category, moq, unit_weight_kg, unit_cbm)
    `);
    if (skus && skus.length > 0)
        query = query.in('sku', skus);
    if (supplier_ids && supplier_ids.length > 0)
        query = query.in('supplier_id', supplier_ids);
    const { data, error } = await query;
    if (error)
        throw new Error(`get_supplier_products failed: ${error.message}`);
    return { content: [{ type: 'text', text: JSON.stringify({ supplier_products: data, count: data?.length ?? 0 }) }] };
});
// ─── SCORE SUPPLIERS ─────────────────────────────────────────
server.tool('score_suppliers', 'Scores and ranks suppliers for a given SKU using weighted criteria (quality, delivery, lead time, cost). Returns ranked list with scores.', {
    sku: z.string().describe('The SKU to score suppliers for'),
    order_qty: z.number().positive().describe('Planned order quantity'),
}, async ({ sku, order_qty }) => {
    // Get product category to find weights
    const { data: product } = await supabase.from('products').select('category, moq').eq('sku', sku).single();
    const category = product?.category ?? 'filters';
    const moq = product?.moq ?? 1;
    // Get scoring weights for this category
    const { data: weights } = await supabase
        .from('supplier_scoring_weights')
        .select('*')
        .eq('category', category)
        .single();
    const w = weights ?? { delivery_weight: 0.25, quality_weight: 0.35, lead_time_weight: 0.15, cost_weight: 0.25 };
    // Get all suppliers for this SKU
    const { data: mappings, error } = await supabase
        .from('supplier_products')
        .select('*, suppliers(*)')
        .eq('sku', sku);
    if (error)
        throw new Error(`score_suppliers failed: ${error.message}`);
    if (!mappings || mappings.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'No suppliers found for SKU', sku }) }] };
    }
    // Score each supplier (all scores 0–100, higher = better)
    const scored = mappings.map((m) => {
        const sup = m.suppliers;
        // Lead time: 7 days = 100, 28 days = 0
        const leadTimeScore = Math.max(0, 100 - (sup.lead_time_days - 7) * (100 / 21));
        // Cost: cost_rating is already 0–100 (higher = cheaper)
        const costScore = sup.cost_rating;
        // MOQ fit: actual moq vs order qty — if order_qty >= moq, perfect (100), else penalise
        const effectiveMoq = m.moq_override ?? moq;
        const moqFit = order_qty >= effectiveMoq ? 100 : (order_qty / effectiveMoq) * 100;
        const totalScore = (sup.quality_score * w.quality_weight +
            sup.delivery_performance * w.delivery_weight +
            leadTimeScore * w.lead_time_weight +
            costScore * w.cost_weight);
        return {
            supplier_id: sup.id,
            supplier_name: sup.name,
            region: sup.region,
            lead_time_days: sup.lead_time_days,
            unit_price: m.unit_price,
            moq: effectiveMoq,
            moq_fit_pct: Math.round(moqFit),
            score: Math.round(totalScore * 10) / 10,
            score_breakdown: {
                quality: sup.quality_score,
                delivery: sup.delivery_performance,
                lead_time: Math.round(leadTimeScore),
                cost: costScore,
            },
            weights_used: w,
        };
    });
    scored.sort((a, b) => b.score - a.score);
    const recommended = scored[0];
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    sku,
                    category,
                    order_qty,
                    ranked_suppliers: scored,
                    recommended_supplier: recommended,
                })
            }]
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Supplier Data Server running on stdio');
}
main().catch(console.error);
