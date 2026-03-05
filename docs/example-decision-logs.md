# Example Decision Logs

These are representative decision log entries produced by the ProcureAI pipeline. Each entry is written to the `decision_log` table in Supabase via the `log_decision` MCP tool.

## Entry 1: DemandAnalyst

```json
{
  "id": 1,
  "run_id": "run_a3f8c91d",
  "po_number": null,
  "agent_name": "DemandAnalyst",
  "timestamp": "2026-03-04T14:22:31.456Z",
  "inputs": {
    "skus_analyzed": 60,
    "horizon_months": 3,
    "below_reorder_checked": true
  },
  "output": {
    "skus_needing_replenishment": 12,
    "total_net_requirement_qty": 4850,
    "urgency_breakdown": {
      "critical": 3,
      "watch": 4,
      "normal": 5
    },
    "sample_requirements": [
      { "sku": "FLT-OIL-001", "net_qty": 500, "urgency": "critical", "need_by": "2026-03-18" },
      { "sku": "GSK-HEAD-003", "net_qty": 200, "urgency": "watch", "need_by": "2026-04-02" }
    ]
  },
  "confidence": 0.91,
  "rationale": "Identified 12 SKUs below reorder point. 3 critical items have less than 7 days of stock remaining at current demand rates. Net requirements calculated using forecast + safety stock - (on hand + in transit)."
}
```

## Entry 2: SupplierSelector

```json
{
  "id": 2,
  "run_id": "run_a3f8c91d",
  "po_number": null,
  "agent_name": "SupplierSelector",
  "timestamp": "2026-03-04T14:22:45.123Z",
  "inputs": {
    "skus_to_source": 12,
    "suppliers_evaluated": 6,
    "scoring_weights": {
      "quality_weight": 0.35,
      "delivery_weight": 0.25,
      "lead_time_weight": 0.15,
      "cost_weight": 0.25
    }
  },
  "output": {
    "selections": [
      {
        "sku": "FLT-OIL-001",
        "selected_supplier": "SUP-001",
        "supplier_name": "Precision Parts Co.",
        "composite_score": 87.4,
        "unit_price": 12.50,
        "lead_time_days": 7,
        "alternatives": [
          { "supplier_id": "SUP-003", "score": 82.1 },
          { "supplier_id": "SUP-005", "score": 76.8 }
        ]
      },
      {
        "sku": "GSK-HEAD-003",
        "selected_supplier": "SUP-002",
        "supplier_name": "Global Gasket Supply",
        "composite_score": 91.2,
        "unit_price": 8.75,
        "lead_time_days": 10,
        "alternatives": [
          { "supplier_id": "SUP-004", "score": 85.6 }
        ]
      }
    ],
    "suppliers_used": 4,
    "avg_composite_score": 84.7
  },
  "confidence": 0.88,
  "rationale": "Selected suppliers for 12 SKUs using weighted scoring (quality 35%, delivery 25%, cost 25%, lead time 15%). Average composite score 84.7. Distributed across 4 suppliers to reduce single-source risk."
}
```

## Entry 3: ContainerOptimizer

```json
{
  "id": 3,
  "run_id": "run_a3f8c91d",
  "po_number": null,
  "agent_name": "ContainerOptimizer",
  "timestamp": "2026-03-04T14:23:02.789Z",
  "inputs": {
    "line_items_count": 12,
    "total_weight_kg": 8420.5,
    "total_cbm": 22.4
  },
  "output": {
    "recommended_plan": {
      "container_type": "40ft",
      "num_containers": 1,
      "weight_utilisation_pct": 32.4,
      "volume_utilisation_pct": 33.0,
      "binding_utilisation_pct": 33.0,
      "estimated_freight_usd": 4500
    },
    "alternative_plan": {
      "container_type": "20ft",
      "num_containers": 2,
      "binding_utilisation_pct": 66.0,
      "estimated_freight_usd": 6000
    }
  },
  "confidence": 0.95,
  "rationale": "Recommended 1x 40ft container at 33% utilization ($4,500 freight) over 2x 20ft ($6,000). Single container reduces handling costs and consolidates shipment. Volume is the binding constraint."
}
```

## Entry 4: POCompiler

```json
{
  "id": 4,
  "run_id": "run_a3f8c91d",
  "po_number": "PO-20260304-001",
  "agent_name": "POCompiler",
  "timestamp": "2026-03-04T14:23:18.456Z",
  "inputs": {
    "line_items": 12,
    "suppliers": 4,
    "container_plan": "1x 40ft",
    "estimated_freight": 4500
  },
  "output": {
    "po_number": "PO-20260304-001",
    "status": "draft",
    "total_usd": 48750.00,
    "line_item_count": 12,
    "created_by": "pipeline"
  },
  "confidence": 0.92,
  "rationale": "Compiled draft PO-20260304-001 with 12 line items totaling $48,750.00 across 4 suppliers. Includes 1x 40ft container at $4,500 estimated freight. 3 critical-urgency items prioritized. PO ready for manager review and approval."
}
```

## Schema Reference

The `decision_log` table schema:

```sql
CREATE TABLE decision_log (
  id          SERIAL PRIMARY KEY,
  run_id      TEXT NOT NULL,
  po_number   TEXT REFERENCES purchase_orders(po_number),
  agent_name  TEXT NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT now(),
  inputs      JSONB NOT NULL DEFAULT '{}',
  output      JSONB NOT NULL DEFAULT '{}',
  confidence  NUMERIC(4,2),
  rationale   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_dlog_run ON decision_log(run_id);
CREATE INDEX idx_dlog_agent ON decision_log(agent_name);
```

## Notes

- Each pipeline run generates exactly 4 decision log entries (one per agent)
- If an agent is skipped due to upstream failure, no entry is created for that agent
- The `confidence` field ranges from 0.0 to 1.0 and reflects the agent's self-assessed certainty
- `inputs` and `output` are stored as JSONB for flexible querying
- All entries can be viewed in the Decision Log UI at `/logs` (administrator role only)
