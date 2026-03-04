# ProcureAI 10-Minute Pitch and Live Demo Guide

This guide gives you a complete 10-minute live pitch script for the current codebase.
It is aligned to the required sections:
- Problem framing and imagined use case
- User roles and agent roles
- Technical architecture
- Key decisions and limitations
- Expected business impact

## 1) Talk Track at a Glance (10:00 total)

- `00:00–00:45` Opening and problem framing
- `00:45–02:00` Imagined use case and why now
- `02:00–03:00` User roles and responsibilities
- `03:00–05:00` Agent roles and orchestration
- `05:00–06:30` Technical architecture and MCP flow
- `06:30–08:00` Key design decisions and current limitations
- `08:00–09:15` Expected business impact (KPIs/ROI assumptions)
- `09:15–10:00` Close and Q&A buffer

## 2) Slide-by-Slide Script

## Slide 1 — Title and One-Line Value Proposition (`00:00–00:45`)

**What to say**
"ProcureAI is a multi-agent purchase-order drafting system for supply chain teams. It turns fragmented inventory, forecast, supplier, and logistics data into a reviewable draft PO, while keeping a human approval gate."

**Key point**
- This is decision support plus orchestration, not full autonomous procurement.

## Slide 2 — Problem Framing (`00:45–01:30`)

**What to say**
"In many operations teams, planners still bounce between ERP screens, spreadsheets, and emails to decide what to order, from whom, and how to ship. That process is slow, inconsistent, and hard to audit."

**Concrete pain points**
- Slow PO cycle time (manual data gathering + approvals)
- Human error risk (wrong quantity/supplier, duplicate ordering)
- Limited decision traceability (hard to reconstruct why decisions were made)

## Slide 3 — Imagined Use Case (`01:30–02:00`)

**Scenario narrative**
- A planner starts the pipeline for low-stock SKUs.
- The system calculates net requirements over a selected horizon.
- It ranks suppliers per SKU using weighted criteria.
- It estimates container utilization/freight.
- It compiles a draft PO and records all decisions.
- A human reviews and approves or rejects.

**Open-PO duplicate detection (call out explicitly)**
- Before computing net quantities, Agent 1 cross-references all open/draft POs for the same SKUs.
- If a SKU already has pending orders, it surfaces a warning so the planner avoids double-ordering — a safeguard that manual spreadsheet processes frequently miss.

**Business context in this repo**
- Seeded data models industrial diesel/engine parts categories (`filters`, `gaskets`, `engine_parts`, `electrical`) with realistic MOQ/weight/volume/lead-time patterns.
- Codebase is branded **Cummins Xtern 2026**, matching the industrial engine component context.

## Slide 4 — User Roles (`02:00–03:00`)

**User roles in implementation**
- `po_manager`
  - Runs pipeline
  - Reviews intermediate outputs
  - Can adjust supplier choices before container optimization
  - Can trigger approve/reject from the pipeline page in current implementation
- `administrator`
  - Everything above
  - Access to approval queue and decision logs pages

**Role mechanism in app**
- Role value comes from Supabase Auth `user_metadata.role`
- Frontend middleware restricts `/approvals` and `/logs` to `administrator`

## Slide 5 — Agent Roles and Decision Boundaries (`03:00–05:00`)

**Agent 1: DemandAnalyst**
- Pulls inventory + forecasts + open PO context via MCP
- Calculates net need = forecast + safety stock - available inventory
- Applies MOQ floor and urgency tier (`critical/watch/normal`)
- Adds need-by date and demand trend signals

**Agent 2: SupplierSelector**
- Calls supplier scoring MCP tool per SKU
- Uses category-specific weights (quality, delivery, lead time, cost)
- Returns recommended supplier + alternatives
- User can override selected supplier before next step

**Agent 3: ContainerOptimizer**
- Pulls product weight/CBM
- Calls logistics MCP tool for container plan
- Outputs container type/count, utilization, and freight estimate

**Agent 4: POCompiler**
- Assembles line items and totals
- Writes draft PO + line items to persistent store
- Generates summary note and logs final decision

**Orchestration style**
- Step-by-step, human-in-the-loop progression (`/pipeline/start` then `/pipeline/{run_id}/continue/{agent}`)
- Early-stop on error or missing prerequisites

## Slide 6 — Technical Architecture (`05:00–06:30`)

**Frontend**
- Next.js app for dashboard, pipeline, approvals, logs, supplier/data views
- Supabase Auth and role-aware navigation

**Backend**
- FastAPI API orchestrates agent execution
- Python MCP client invokes Node MCP servers over stdio JSON-RPC

**MCP servers (4, totaling 14 tools)**
- ERP data server (`get_inventory`, `get_products`, `get_forecasts`)
- Supplier data server (`get_suppliers`, `get_supplier_products`, `score_suppliers`)
- Logistics server (`get_container_specs`, `calculate_container_plan`)
- PO management server (`create_draft_po`, `get_pos`, `update_po_status`, `log_decision`, `get_decision_log`)

**Persistence**
- Supabase/PostgreSQL tables for products, suppliers, forecasts, inventory, POs, PO lines, decision logs

**Data transparency page (`/data`)**
- Accessible to both roles; shows live Inventory and Products tabs with sortable/searchable columns
- Inventory tab includes status color-coding (Critical / Watch / OK) matching the demand agent's urgency logic

## Slide 7 — Key Decisions and Current Limitations (`06:30–08:00`)

**Key decisions**
- Keep agent responsibilities narrow and separable
- Force tool access through MCP layer (not direct DB access from agents)
- Keep a mandatory human review path before final operational action
- Persist per-agent decision rationale and confidence for auditability

**Current limitations to acknowledge clearly**
- `pipeline_states` are in-memory in FastAPI (not durable across backend restart)
- Backend endpoints do not perform their own auth/authorization checks; access control is mainly frontend/middleware enforced
- Supabase RLS is disabled in schema for demo mode
- MCP calls spawn a new Node process per tool invocation (simpler, but adds latency)
- Approval status flow includes `pending_approval` in schema/tooling, but current path often goes from `draft` directly to approve/reject
- PO header `total_usd` persistence currently excludes estimated freight, while pipeline summary includes freight in computed total

## Slide 8 — Expected Business Impact (`08:00–09:15`)

**Positioning**
- These are expected outcomes from process design, not production-validated metrics yet.

**Expected KPI directions**
- Lower PO draft cycle time
- More consistent supplier selection logic
- Improved review confidence through rationale + confidence + full log trail
- Reduced manual reconciliation effort for audit/review

**Sample KPI set for discussion**
- PO cycle time (request-to-draft)
- Planner touches per PO
- % POs requiring rework
- Supplier selection consistency against policy
- Approval turnaround time

**TCO angle (bonus framing)**
- Container optimization selects the container type that maximizes binding utilisation (max of weight vs volume fill), directly reducing wasted freight spend.
- The system surfaces landed cost per unit (unit price + apportioned freight) so planners see the true sourcing cost — not just unit price.
- Choosing a 40ft container over two 20ft containers saves base freight cost and improves fill rate visibility.

## Slide 9 — Close (`09:15–10:00`)

**What to say**
"ProcureAI demonstrates a practical AI pattern for operations: multiple specialized agents, MCP-based tool grounding, persistent audit logs, and a human decision gate. The next step is a tightly scoped pilot with hardened auth and measurable KPI tracking."

---

## 3) Live Demo Runbook (If You Present with Product)

This section is optional but recommended in a pitch.

## Demo objective
Show one end-to-end run where the system:
- Detects replenishment need
- Recommends suppliers
- Builds container plan
- Creates draft PO
- Logs each decision

## Pre-demo checks (before presenting)
- Backend running (`/health` returns `ok`)
- Frontend running and login works
- Supabase seeded
- MCP server `dist/index.js` exists in all server folders (built)
- OpenAI key configured (for rationale generation)

## Suggested click path
1. Login as `manager1@procurepilot.demo`
2. Open `/data` first — show the Inventory tab, point to any Critical (red) SKU as the motivation for this run
3. Open `/pipeline`
4. Start with empty SKU selection (auto-select below reorder)
5. Review Demand Analyst output — call out urgency colors, need-by dates, and any open-PO warnings
6. Continue → Supplier Selector output; override one supplier to demonstrate human-in-the-loop control
7. Continue → Container Optimizer (call out binding utilisation %, freight estimate)
8. Continue → PO Compiler (PO number, total value, status = draft)
9. Approve the draft from the pipeline view
10. Log out; login as `admin@procurepilot.demo`; open `/logs` to show per-agent decision trace with confidence scores and JSON inputs/outputs

## What to call out live
- Every agent output includes rationale/confidence
- Supplier choices are not locked; planner can intervene
- Every stage writes decision logs to persistent storage

## Fallback plan if live demo fails
- Show architecture + flow diagram and walk through a previously generated run_id/PO example
- Emphasize audit and governance mechanics over UI polish

---

## 4) Q&A Prep (Likely Questions)

**Q: Is this autonomous procurement?**
- No. It drafts and recommends. Human review remains in control.

**Q: Why MCP instead of direct DB calls from each agent?**
- Standardized tool interface, cleaner separation of concerns, easier server-level governance.

**Q: What is production-hardening priority #1?**
- Backend auth enforcement + re-enabling RLS with role policies.

**Q: What proves value in a pilot?**
- Measured cycle time reduction, rework reduction, and approval throughput improvement.

**Q: Does the system optimize total cost, not just unit price?**
- Yes. Container optimization explicitly selects for highest binding utilisation to reduce per-unit freight. The pipeline surfaces estimated freight as a line item so planners see the full landed cost, not just unit price.

**Q: Can scoring weights be changed without re-deploying code?**
- Yes. Weights live in the `supplier_scoring_weights` table in Supabase, keyed by product category. A procurement manager can update them directly without touching agent code.
