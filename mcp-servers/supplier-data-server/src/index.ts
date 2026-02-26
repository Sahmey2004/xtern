import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { supabase } from './supabase.js';
import { jsonResponse, errorResponse } from './helpers.js';

const server = new McpServer({
  name: 'supplier-data-server',
  version: '1.0.0',
});

// ─── Tool 1: get_suppliers_for_sku ───
server.tool(
  'get_suppliers_for_sku',
  'Get all suppliers that can provide a given SKU, with their performance metrics and pricing.',
  { sku: z.string().describe('Product SKU to find suppliers for') },
  async ({ sku }) => {
    try {
      // Get product category first
      const { data: product, error: pErr } = await supabase
        .from('products').select('category').eq('sku', sku).single();
      if (pErr) return errorResponse(`Product not found: ${sku}`);

      // Get supplier-product mappings with supplier details
      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          unit_price, moq_override,
          suppliers(id, name, region, lead_time_days, quality_score, delivery_performance, cost_rating)
        `)
        .eq('sku', sku);
      if (error) return errorResponse(error.message);

      const suppliers = data.map((row: any) => ({
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

      return jsonResponse({
        sku,
        category: product.category,
        supplier_count: suppliers.length,
        suppliers,
      });
    } catch (e: any) { return errorResponse(e.message); }
  }
);

// ─── Tool 2: get_scoring_weights ───
server.tool(
  'get_scoring_weights',
  'Get the supplier decision matrix weights for a product category.',
  { category: z.string().describe('Product category: filters, gaskets, engine_parts, electrical') },
  async ({ category }) => {
    try {
      const { data, error } = await supabase
        .from('supplier_scoring_weights')
        .select('*')
        .eq('category', category)
        .single();
      if (error) return errorResponse(error.message);
      return jsonResponse(data);
    } catch (e: any) { return errorResponse(e.message); }
  }
);

// ─── Tool 3: get_supplier_history ───
server.tool(
  'get_supplier_history',
  'Get past decision records involving this supplier from the decision log.',
  { supplier_id: z.string().describe('Supplier ID, e.g. SUP-A') },
  async ({ supplier_id }) => {
    try {
      const { data, error } = await supabase
        .from('decision_log')
        .select('*')
        .eq('agent', 'supplier_selector')
        .ilike('output', `%${supplier_id}%`)
        .order('timestamp', { ascending: false })
        .limit(20);
      if (error) return errorResponse(error.message);
      return jsonResponse({
        supplier_id,
        history_count: data.length,
        decisions: data,
        note: data.length === 0 ? 'No history yet. This populates as the pipeline runs.' : undefined,
      });
    } catch (e: any) { return errorResponse(e.message); }
  }
);

// ─── Tool 4: update_scoring_weights ───
server.tool(
  'update_scoring_weights',
  'Update the supplier scoring weights for a category. All 4 weights must sum to 1.0.',
  {
    category: z.string().describe('Product category'),
    delivery_weight: z.number().describe('Weight for delivery performance (0-1)'),
    quality_weight: z.number().describe('Weight for quality score (0-1)'),
    lead_time_weight: z.number().describe('Weight for lead time (0-1)'),
    cost_weight: z.number().describe('Weight for cost rating (0-1)'),
  },
  async ({ category, delivery_weight, quality_weight, lead_time_weight, cost_weight }) => {
    try {
      const sum = delivery_weight + quality_weight + lead_time_weight + cost_weight;
      if (Math.abs(sum - 1.0) > 0.01) {
        return errorResponse(`Weights must sum to 1.0. Current sum: ${sum}`);
      }
      const { data, error } = await supabase
        .from('supplier_scoring_weights')
        .update({ delivery_weight, quality_weight, lead_time_weight, cost_weight })
        .eq('category', category)
        .select();
      if (error) return errorResponse(error.message);
      return jsonResponse({ updated: true, weights: data[0] });
    } catch (e: any) { return errorResponse(e.message); }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('supplier-data-server running on stdio');
}
main().catch(console.error);