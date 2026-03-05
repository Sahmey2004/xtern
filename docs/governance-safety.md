# Governance & Safety Brief

## Human-in-the-Loop Rules

ProcureAI enforces human oversight at every critical decision point in the procurement pipeline. The pipeline executes four sequential stages, each producing outputs that are visible to the operator before the next stage begins:

1. **Demand Analysis** -- The DemandAnalyst agent forecasts reorder quantities based on inventory levels, historical forecasts, and lead times. The operator can review recommended quantities before supplier selection begins.
2. **Supplier Selection** -- The SupplierSelector agent scores and ranks suppliers using weighted criteria (price, reliability, lead time, quality). The operator can override supplier rankings or exclude specific suppliers before optimization.
3. **Container Optimization** -- The ContainerOptimizer agent bins line items into containers to maximize utilization. Results are presented for review before PO compilation.
4. **PO Compilation** -- The POCompiler agent assembles draft purchase orders. Each PO enters a "pending_review" state and **must be explicitly approved or rejected** by a user with the administrator role via `POST /pipeline/approve/:po_number`.

Rejected POs are not deleted. They remain in the system with a "rejected" status so the operator can modify inputs and re-run the pipeline. No purchase order is finalized without human approval.

## Audit & Traceability Strategy

Every agent writes a structured decision record to the `decision_log` table in Supabase via the MCP `log_decision` tool. Each record contains:

| Field | Description |
|---|---|
| `id` | Auto-generated UUID |
| `run_id` | Shared identifier linking all decisions within a single pipeline execution |
| `agent_name` | Which agent produced the decision (e.g., `demand_analyst`, `supplier_selector`) |
| `timestamp` | ISO-8601 timestamp of when the decision was made |
| `inputs` | JSON snapshot of the data the agent received |
| `output` | JSON snapshot of the agent's produced result |
| `confidence` | Numeric confidence score (0.0 -- 1.0) |
| `rationale` | Free-text explanation of why the agent made this decision |

This provides a complete, queryable audit trail. The frontend exposes a Logs page where administrators can filter by run_id, agent, or time range to reconstruct the reasoning behind any purchase order.

## Data Handling Assumptions

- **All data is synthetic.** The demo uses 60 diesel engine parts and 6 fictional suppliers. No real Cummins product data, pricing, or supplier information is included.
- **No PII is stored or processed.** Supplier records contain company names and capabilities only.
- **Database:** Supabase PostgreSQL. Row-Level Security (RLS) is disabled for the demo to simplify development. A production deployment would enable RLS with role-based policies.
- **LLM interactions** send only synthetic product and supplier data to the model provider. No sensitive or proprietary information is transmitted.

## Fail-Safe Behaviors

- **Empty result handling:** Each agent checks whether upstream data is present. If the DemandAnalyst returns no reorder recommendations, the SupplierSelector skips execution and logs the reason. This prevents cascading errors through the pipeline.
- **LLM error fallback:** If the LLM fails to respond or returns malformed output, agents fall back to rule-based defaults (e.g., reorder quantity = max(0, reorder_point - current_stock), supplier ranking by lowest unit price).
- **Rejected PO remediation:** Rejected purchase orders remain visible in the Approvals page with their full decision log. Operators can adjust parameters and trigger a new pipeline run.
- **Pipeline isolation:** Each run is assigned a unique `run_id`. A failed run does not affect prior approved POs or corrupt existing data.
