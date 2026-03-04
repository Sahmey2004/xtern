# ProcureAI Next Steps and Pilot Plan (1 page)

## Pilot Objective

Validate that multi-agent PO drafting improves planning speed and decision quality while preserving governance controls.

## 1) What a Pilot Would Require

Scope (recommended):
- One product family or plant/business unit
- 8-12 week pilot period
- 2-5 active planners + 1-2 approvers

Success criteria (example):
- >=30% reduction in draft cycle time
- >=25% reduction in draft rework
- >=90% of approved POs with complete traceability artifacts

Pilot operating model:
- ProcureAI generates draft and recommendations
- Human reviewer remains final decision authority
- Exceptions and overrides are logged for policy tuning

## 2) Minimal Integrations

Required minimum integrations:
- ERP export/import for products, forecasts, inventory (batch acceptable in phase 1; SAP BAPI or Oracle REST APIs in phase 2)
- Supplier master and supplier-SKU pricing feed
- PO destination system write path (or staged review table)
- Identity provider integration (or controlled auth user provisioning via Supabase Auth admin API)

**MCP layer as integration abstraction:**
The four MCP servers (`erp-data-server`, `supplier-data-server`, `logistics-server`, `po-management-server`) are the sole data interface for all agents. In a pilot, each MCP server's tool implementations would be swapped to point at the production ERP or supplier API, while the agents themselves remain unchanged. This design significantly reduces integration risk — agent logic does not need to change when the data source changes.

**Scoring policy integration:**
Supplier scoring weights are stored in the `supplier_scoring_weights` table, keyed by product category. Procurement policy changes (e.g., increase cost weighting for a specific category) are applied directly in the database — no code deployment required. This makes the system configurable by operations teams without engineering involvement.

Minimal technical hardening before pilot go-live:
- Backend authentication + role authorization on all sensitive endpoints
- Supabase RLS enabled with least-privilege policies
- Durable pipeline run state store (Redis or Supabase `pipeline_runs` table)
- Basic monitoring for API health, MCP call failures, and LLM error rates

## 3) Effort Estimate and Risks

Indicative effort (small team):
- Week 1-2: security hardening + environment setup
- Week 3-4: integration adapters and data quality checks
- Week 5-6: UAT with planners, policy calibration
- Week 7-8: controlled pilot and KPI measurement

Team shape:
- 1 backend engineer
- 1 frontend/full-stack engineer
- 1 data/integration engineer (part-time)
- 1 product/operations owner

Top risks:
- Data freshness/quality gaps reduce recommendation trust
- Authentication/authorization gaps expose governance risk
- LLM variability causes inconsistent rationale quality
- Change management resistance from planner teams

Risk mitigations:
- Start with narrow SKU scope and daily data validation checks
- Enforce backend auth and RLS before pilot use
- Keep deterministic business rules as guardrails around LLM summaries
- Provide short training + override playbooks for planners

## Pilot Exit Decision

Scale to next unit only if:
- Security controls are fully enforced
- KPI thresholds are met for 2 consecutive reporting periods
- Stakeholder review confirms acceptable risk and operator trust
