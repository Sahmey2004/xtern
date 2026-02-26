"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const supabase_js_1 = require("./supabase.js");
const helper_js_1 = require("./helper.js");
const server = new mcp_js_1.McpServer({ name: 'logistics-server', version: '1.0.0' });
// ─── Tool 1: get_container_specs ───
server.tool('get_container_specs', 'Get available container types with dimensions and costs.', {}, async () => {
    try {
        const { data, error } = await supabase_js_1.supabase.from('container_specs').select('*');
        if (error)
            return (0, helper_js_1.errorResponse)(error.message);
        return (0, helper_js_1.jsonResponse)({ containers: data });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 2: calculate_container_fit ───
server.tool('calculate_container_fit', 'Calculate optimal container loading for a set of items. Tries 20ft-only, 40ft-only, and mixed strategies. Flags utilization below 80%.', {
    items: zod_1.z.array(zod_1.z.object({
        sku: zod_1.z.string(),
        quantity: zod_1.z.number(),
        unit_weight_kg: zod_1.z.number(),
        unit_cbm: zod_1.z.number(),
    })).describe('Array of items to pack'),
}, async ({ items }) => {
    try {
        // Get container specs
        const { data: specs } = await supabase_js_1.supabase.from('container_specs').select('*');
        if (!specs || specs.length === 0)
            return (0, helper_js_1.errorResponse)('No container specs found');
        const c20 = specs.find((s) => s.type === '20ft');
        const c40 = specs.find((s) => s.type === '40ft');
        // Calculate total shipment volume and weight
        const totalWeight = items.reduce((s, i) => s + i.quantity * i.unit_weight_kg, 0);
        const totalCbm = items.reduce((s, i) => s + i.quantity * i.unit_cbm, 0);
        // ─── Strategy A: 40ft containers only ───
        const count40 = Math.max(1, Math.ceil(Math.max(totalWeight / c40.max_weight_kg, totalCbm / c40.max_cbm)));
        const util40w = (totalWeight / (count40 * c40.max_weight_kg)) * 100;
        const util40v = (totalCbm / (count40 * c40.max_cbm)) * 100;
        const util40 = Math.max(util40w, util40v);
        const stratA = {
            strategy: '40ft_only',
            containers: [{
                    type: '40ft', count: count40, weight_kg: totalWeight,
                    cbm_used: totalCbm, utilization_pct: Math.round(util40 * 100) / 100,
                    cost_usd: count40 * c40.base_cost_usd
                }],
            total_cost: count40 * c40.base_cost_usd,
            min_utilization: Math.round(util40 * 100) / 100,
            total_containers: count40,
        };
        // ─── Strategy B: 20ft containers only ───
        const count20 = Math.max(1, Math.ceil(Math.max(totalWeight / c20.max_weight_kg, totalCbm / c20.max_cbm)));
        const util20w = (totalWeight / (count20 * c20.max_weight_kg)) * 100;
        const util20v = (totalCbm / (count20 * c20.max_cbm)) * 100;
        const util20 = Math.max(util20w, util20v);
        const stratB = {
            strategy: '20ft_only',
            containers: [{
                    type: '20ft', count: count20, weight_kg: totalWeight,
                    cbm_used: totalCbm, utilization_pct: Math.round(util20 * 100) / 100,
                    cost_usd: count20 * c20.base_cost_usd
                }],
            total_cost: count20 * c20.base_cost_usd,
            min_utilization: Math.round(util20 * 100) / 100,
            total_containers: count20,
        };
        // ─── Strategy C: Mixed (fill 40ft first, remainder in 20ft) ───
        const full40 = Math.floor(Math.min(totalWeight / c40.max_weight_kg, totalCbm / c40.max_cbm));
        const remainWeight = totalWeight - full40 * c40.max_weight_kg;
        const remainCbm = totalCbm - full40 * c40.max_cbm;
        let stratC = null;
        if (full40 > 0 && (remainWeight > 0 || remainCbm > 0)) {
            const rem20 = Math.max(1, Math.ceil(Math.max(remainWeight / c20.max_weight_kg, remainCbm / c20.max_cbm)));
            const mixUtil40 = 95; // full 40ft containers are well-utilized
            const mixUtil20w = (remainWeight / (rem20 * c20.max_weight_kg)) * 100;
            const mixUtil20v = (remainCbm / (rem20 * c20.max_cbm)) * 100;
            const mixUtil20 = Math.max(mixUtil20w, mixUtil20v);
            stratC = {
                strategy: 'mixed_40ft_20ft',
                containers: [
                    {
                        type: '40ft', count: full40, weight_kg: full40 * c40.max_weight_kg,
                        cbm_used: full40 * c40.max_cbm, utilization_pct: mixUtil40,
                        cost_usd: full40 * c40.base_cost_usd
                    },
                    {
                        type: '20ft', count: rem20, weight_kg: Math.max(0, remainWeight),
                        cbm_used: Math.max(0, remainCbm),
                        utilization_pct: Math.round(Math.max(0, mixUtil20) * 100) / 100,
                        cost_usd: rem20 * c20.base_cost_usd
                    },
                ],
                total_cost: full40 * c40.base_cost_usd + rem20 * c20.base_cost_usd,
                min_utilization: Math.round(Math.min(mixUtil40, Math.max(0, mixUtil20)) * 100) / 100,
                total_containers: full40 + rem20,
            };
        }
        // ─── Pick best option ───
        const options = [stratA, stratB, ...(stratC ? [stratC] : [])];
        const viable = options.filter(o => o.min_utilization >= 80);
        const best = viable.length > 0
            ? viable.sort((a, b) => a.total_cost - b.total_cost)[0]
            : options.sort((a, b) => b.min_utilization - a.min_utilization)[0];
        const recommendation = best.min_utilization >= 80 ? 'FCL' : 'LCL';
        return (0, helper_js_1.jsonResponse)({
            shipment_summary: { total_weight_kg: totalWeight, total_cbm: totalCbm },
            options,
            recommended: { ...best, fcl_lcl: recommendation },
            below_80_pct: best.min_utilization < 80,
            suggestion: best.min_utilization < 80
                ? 'Utilization below 80%. Consider: (a) pull forward demand, (b) combine with another order, or (c) ship LCL.'
                : 'Good utilization. Recommend FCL shipping.',
        });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
// ─── Tool 3: save_container_plan ───
server.tool('save_container_plan', 'Save the selected container plan to the database.', {
    po_number: zod_1.z.string().describe('Purchase order number'),
    plans: zod_1.z.array(zod_1.z.object({
        container_type: zod_1.z.string(),
        fcl_lcl: zod_1.z.string(),
        utilization_pct: zod_1.z.number(),
        weight_kg: zod_1.z.number(),
        cbm_used: zod_1.z.number(),
        estimated_freight_usd: zod_1.z.number(),
    })).describe('Container plan details'),
}, async ({ po_number, plans }) => {
    try {
        const rows = plans.map(p => ({ po_number, ...p }));
        const { data, error } = await supabase_js_1.supabase.from('container_plans').insert(rows).select();
        if (error)
            return (0, helper_js_1.errorResponse)(error.message);
        return (0, helper_js_1.jsonResponse)({ saved: true, plan_count: data.length, plans: data });
    }
    catch (e) {
        return (0, helper_js_1.errorResponse)(e.message);
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('logistics-server running on stdio');
}
main().catch(console.error);
