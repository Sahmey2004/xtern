# Next Steps / Pilot Plan

## What a Pilot Would Require

Moving from the current demo (synthetic data, local deployment) to a production pilot at Cummins would require the following:

- **Real product catalog:** Replace the 60 synthetic diesel parts with actual Cummins part numbers, descriptions, unit costs, and reorder parameters from the ERP system.
- **Live supplier data:** Connect to Cummins' supplier portal or procurement system to pull real supplier pricing, lead times, reliability scores, and capacity information.
- **ERP integration:** Read/write access to inventory levels and purchase order records in the production ERP (SAP, Oracle, or equivalent).
- **Production database:** A dedicated Supabase instance (or Cummins-hosted PostgreSQL) with Row-Level Security enabled and proper role-based access controls.
- **Authentication:** Integration with Cummins SSO (e.g., Azure AD / Okta) to enforce the po_manager and administrator roles.

## Minimal Integrations

Three integrations are required to deliver a functional pilot:

1. **SAP / Oracle ERP** -- Read current inventory levels, product master data, and historical demand. Write approved POs back to the ERP for fulfillment. This is the critical-path integration.
2. **Supplier Portal** -- Pull current pricing, availability, and lead times for eligible suppliers. This can start as a flat-file import (CSV/Excel) and migrate to API-based access over time.
3. **Freight Carrier APIs** -- Retrieve container specifications, shipping rates, and transit times for the ContainerOptimizer agent. Initial pilot can use static rate tables if API access is not immediately available.

## Effort Estimate

| Phase | Duration | Activities |
|---|---|---|
| **Discovery & Scoping** | Weeks 1 -- 2 | Map Cummins procurement workflow, identify pilot product category, define success criteria |
| **Integration Development** | Weeks 3 -- 6 | Build ERP connector, supplier data pipeline, update MCP servers for real data formats |
| **Agent Tuning** | Weeks 5 -- 8 | Fine-tune prompts and scoring weights with real data, validate LLM outputs against historical decisions |
| **UAT & Hardening** | Weeks 9 -- 10 | User acceptance testing with procurement team, security review, performance testing |
| **Pilot Run** | Weeks 11 -- 12 | Parallel run alongside manual process, compare outcomes, measure KPIs |

**Team:** 3 people -- 1 full-stack engineer (Next.js + FastAPI), 1 ML/AI engineer (LangGraph + prompt engineering), 1 domain specialist (procurement process + ERP).

**Total estimated effort:** 8 -- 12 weeks.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **LLM accuracy with real data** | Incorrect demand forecasts or supplier rankings could lead to bad POs | Human-in-the-loop approval on every PO; run in parallel with manual process during pilot; log and review all agent decisions |
| **Supplier data freshness** | Stale pricing or lead times produce suboptimal supplier selection | Implement data freshness checks; flag supplier data older than a configurable threshold; fall back to manual review |
| **Change management** | Procurement team may resist AI-driven recommendations | Start with a narrow product category; demonstrate time savings early; maintain full transparency via decision logs |
| **Integration complexity** | ERP and supplier systems may have limited API access or inconsistent data formats | Begin with flat-file imports as a fallback; build adapters incrementally; scope pilot to systems with existing API support |
| **LLM cost at scale** | Token usage grows with product catalog size and pipeline frequency | Monitor token consumption per run; use smaller models for structured tasks (scoring, bin-packing); cache repeated lookups |
