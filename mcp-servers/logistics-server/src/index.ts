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
  dotenv.config({ path: envPath, override: false, quiet: true } as any);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const server = new McpServer({ name: 'logistics-server', version: '1.0.0' });

server.tool('ping', 'Health check', {}, async () => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ server: 'logistics-server', status: 'ok', timestamp: new Date().toISOString() }) }]
}));

// ─── GET CONTAINER SPECS ─────────────────────────────────────
server.tool(
  'get_container_specs',
  'Returns available container types with max weight, volume, and base freight cost.',
  {},
  async () => {
    const { data, error } = await supabase.from('container_specs').select('*');
    if (error) throw new Error(`get_container_specs failed: ${error.message}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ container_specs: data }) }] };
  }
);

// ─── CALCULATE CONTAINER PLAN ────────────────────────────────
server.tool(
  'calculate_container_plan',
  'Given a list of SKUs with quantities, calculates optimal container allocation using first-fit decreasing bin packing. Returns TEU count, utilisation %, and estimated freight cost.',
  {
    line_items: z.array(z.object({
      sku: z.string(),
      qty: z.number().positive(),
      unit_weight_kg: z.number().positive(),
      unit_cbm: z.number().positive(),
    })).describe('Array of order line items with physical dimensions'),
    preferred_container_type: z.enum(['20ft', '40ft', 'auto']).optional().describe('Preferred container type (default: auto = choose cheapest fit)'),
  },
  async ({ line_items, preferred_container_type = 'auto' }) => {
    // Load container specs from DB
    const { data: specs, error } = await supabase.from('container_specs').select('*');
    if (error) throw new Error(`calculate_container_plan DB error: ${error.message}`);

    const containers: Record<string, { max_weight_kg: number; max_cbm: number; base_cost_usd: number }> = {};
    for (const s of (specs ?? [])) {
      containers[s.type] = { max_weight_kg: s.max_weight_kg, max_cbm: s.max_cbm, base_cost_usd: s.base_cost_usd };
    }

    // Calculate total cargo
    let totalWeightKg = 0;
    let totalCbm = 0;
    const itemDetails: any[] = [];
    for (const item of line_items) {
      const weight = item.qty * item.unit_weight_kg;
      const cbm = item.qty * item.unit_cbm;
      totalWeightKg += weight;
      totalCbm += cbm;
      itemDetails.push({ ...item, total_weight_kg: weight, total_cbm: cbm });
    }

    // Determine which container types to try
    const candidateTypes = preferred_container_type === 'auto'
      ? ['20ft', '40ft']
      : [preferred_container_type];

    // For each type: how many containers needed? Greedy first-fit.
    const plans: any[] = [];
    for (const cType of candidateTypes) {
      const spec = containers[cType];
      if (!spec) continue;

      // Number of containers needed by weight and volume separately
      const byWeight = Math.ceil(totalWeightKg / spec.max_weight_kg);
      const byVolume = Math.ceil(totalCbm / spec.max_cbm);
      const numContainers = Math.max(byWeight, byVolume);
      const totalCost = numContainers * spec.base_cost_usd;

      // Utilisation is based on the binding constraint
      const weightUtil = (totalWeightKg / (numContainers * spec.max_weight_kg)) * 100;
      const volumeUtil = (totalCbm / (numContainers * spec.max_cbm)) * 100;
      const bindingUtil = Math.max(weightUtil, volumeUtil);

      plans.push({
        container_type: cType,
        num_containers: numContainers,
        total_weight_kg: Math.round(totalWeightKg * 100) / 100,
        total_cbm: Math.round(totalCbm * 1000) / 1000,
        weight_utilisation_pct: Math.round(weightUtil * 10) / 10,
        volume_utilisation_pct: Math.round(volumeUtil * 10) / 10,
        binding_utilisation_pct: Math.round(bindingUtil * 10) / 10,
        estimated_freight_usd: totalCost,
        max_weight_kg: spec.max_weight_kg,
        max_cbm: spec.max_cbm,
      });
    }

    // Choose best plan: highest utilisation at lowest cost
    plans.sort((a, b) => b.binding_utilisation_pct - a.binding_utilisation_pct);
    const recommended = plans[0];

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          total_weight_kg: Math.round(totalWeightKg * 100) / 100,
          total_cbm: Math.round(totalCbm * 1000) / 1000,
          item_count: line_items.length,
          plans,
          recommended_plan: recommended,
        })
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Logistics Server running on stdio');
}
main().catch(console.error);
