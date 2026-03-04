# ProcureAI — Competition Rubric Audit & Gap Analysis
*Generated: March 2026 | System: Multi-Agent Supply Chain PO Automation*

---

## MINIMAL TECHNICAL EXPECTATIONS CHECKLIST

| Requirement | Status | Evidence |
|---|---|---|
| **Multi-agent orchestration** (1 primary + 2+ sub-agents) | ✅ PASS | LangGraph pipeline + 4 distinct agents |
| **MCP usage** (agents invoke MCP servers to read/write) | ✅ PASS | 4 MCP servers, 14 tools, called by agents |
| **Decision-making logic** (non-trivial reasoning) | ✅ PASS | Weighted scoring, urgency tiers, bin packing, LLM validation |
| **Persistent context & audit store** (DB + decision logs) | ✅ PASS | Supabase PostgreSQL, `decision_log` table with confidence |
| **Multi-user interaction** (2+ roles with different flows) | ✅ PASS | `administrator` + `po_manager` via Supabase Auth |
| **Basic security posture** (auth, encryption, secrets) | ⚠️ PARTIAL | Auth ✅, encryption assumed (HTTPS/Supabase), no written statement |

**Overall: 5/6 fully met, 1 partial. Minimum requirements are satisfied.**

---

## RUBRIC SCORING: DETAILED ANALYSIS

---

### 1. Multi-agent Design & Orchestration — 25 pts

#### What's Built

**Orchestrator Layer (`backend/graph/pipeline.py`)**
- LangGraph `StateGraph` compiles a directed acyclic pipeline
- Conditional routing after each agent checks for errors or empty outputs
- State is typed (`PipelineState` TypedDict in `graph/state.py`) and passed immutably between nodes
- Pipeline exposed via step-by-step FastAPI endpoints (`/pipeline/start` → `/pipeline/{run_id}/continue/{agent}`)

**Sub-agents (4 distinct nodes):**

| Agent | File | Responsibility | Distinct Logic |
|---|---|---|---|
| DemandAnalyst | `agents/demand_analyst.py` | Net replenishment calculation | Net qty formula, MOQ floor, 3-tier urgency, need-by date, sales delta % |
| SupplierSelector | `agents/supplier_selector.py` | Weighted supplier scoring | Multi-criteria scoring with category-specific weights from DB |
| ContainerOptimizer | `agents/container_optimizer.py` | Freight container bin packing | First-fit decreasing by weight AND volume, binding utilisation |
| POCompiler | `agents/po_compiler.py` | Draft PO assembly + persistence | PO number generation, total calculation, Supabase insert |

**Routing Logic:**
```
DemandAnalyst → [error/empty? → END] → SupplierSelector
SupplierSelector → [error/no valid selections? → END] → ContainerOptimizer
ContainerOptimizer → [error? → END] → POCompiler → END
```

**State Structure (`graph/state.py`):**
- 25+ typed fields, structured by agent stage
- Includes: `inventory_snapshot`, `net_requirements`, `supplier_selections`, `order_line_items`, `container_plan`, `po_number`, `agent_activity`, `error`, `run_id`

#### Current Gaps & Score Estimate
- No separate orchestrator agent *class* — the LangGraph graph itself is the orchestrator
- Conditional routing is error-gating only, not dynamic task routing
- All 4 agents always run sequentially (no parallelism)
- **Estimated: 18–21/25**

#### How to Maximize
- [ ] Add an `OrchestratorAgent` node at the start that explicitly decides which SKUs need immediate handling vs. can be batched — shows intentional orchestration design
- [ ] Add parallel branching: DemandAnalyst could fan-out SupplierSelector + ERP data enrichment in parallel (LangGraph supports parallel branches)
- [ ] Add a routing diagram to your tech design doc and pitch — visually shows orchestration sophistication
- [ ] Rename `pipeline.py` nodes to show clear orchestrator pattern: emphasize `orchestrate_pipeline()` as the primary coordinator

---

### 2. Working Demo & Reproducibility — 20 pts

#### What's Built

**Setup:**
- `supabase/schema.sql` — full schema, idempotent (uses `create table if not exists`, `drop table if exists`)
- `data/seed_data.py` — seeds all business data (products, suppliers, forecasts, inventory, container specs, scoring weights)
- `data/seed_auth_users.py` — creates 3 demo Supabase Auth users with roles
- `backend/config.py` — loads `.env` from repo root or `backend/.env` as fallback

**Runnability:**
- Backend: `cd backend && uvicorn main:app --reload` (port 8000)
- Frontend: `cd frontend && npm run dev` (port 3000)
- 4 MCP servers: TypeScript compiled to `dist/index.js`, spawned as Node.js subprocesses by Python
- MCP servers auto-installed: `npm install` required in each `mcp-servers/*/` dir

**API Coverage:**
- `GET /health` — health check with all service status flags
- `GET /test-supabase` — verifies DB connectivity
- `GET /test-openai` — verifies LLM connectivity
- Step-by-step pipeline endpoints return JSON at each agent gate
- Approval/rejection endpoint

**Demo Credentials:**
- `admin@procurepilot.demo` / `ChangeMe123!` — administrator
- `manager1@procurepilot.demo` / `ChangeMe123!` — po_manager

#### Current Gaps
- No `README.md` with step-by-step setup instructions
- No `docker-compose.yml` (requires manual Python venv + npm install)
- MCP server `node_modules` not committed; first-run setup not documented
- **Estimated: 13–16/20**

#### How to Maximize
- [ ] **Write a `README.md`** with exact commands from clone to running demo (most important)
- [ ] Add a `make setup` or `setup.sh` script that runs all the steps in sequence
- [ ] Add a `docker-compose.yml` for the backend (optional but impressive)
- [ ] Record a short demo video (screen recording of the full pipeline run) as a fallback
- [ ] Add a `/pipeline/demo` endpoint that auto-seeds and runs a test pipeline in one call
- [ ] Document the `NEXT_PUBLIC_BACKEND_URL` env var requirement explicitly

---

### 3. Problem Framing & Realism — 15 pts

#### What's Built

**Business Problem:**
- Supply chain planners at manufacturing/distribution companies spend hours manually computing PO quantities, selecting suppliers, and calculating freight
- ProcureAI automates the full cycle: demand sensing → supplier selection → container optimization → PO drafting

**Realism Indicators:**
- Real procurement concepts: safety stock, reorder point, MOQ (minimum order quantity), in-transit inventory, lead times
- 3-tier urgency: critical (stockout risk), watch (approaching reorder), normal
- Sales delta % (trending demand): compares last 3 months actuals vs prior 3 months
- Need-by date: estimated days until stockout based on monthly demand rate
- Category-specific supplier scoring weights (e.g., electrical parts weight quality differently than filters)
- Container utilisation optimization (weight AND volume constraints, not just one)
- Open PO deduplication: warns if SKU already has pending orders to prevent double-ordering
- Human-in-the-loop approval: no PO commits without explicit approve/reject (realistic governance)

**Data Realism:**
- 10+ SKU categories with distinct MOQ, weight, volume, pricing
- Multiple suppliers per SKU with region, lead time, quality/delivery/cost scores
- Historical forecast actuals available for trend analysis
- Supplier scoring weights differ by category (stored in DB, not hardcoded)

#### Current Gaps
- No explicit framing of "who uses this" (personas) in the codebase
- No quantified baseline (e.g., "current manual process takes X hours")
- **Estimated: 11–13/15**

#### How to Maximize
- [ ] Add a problem statement slide and business sketch document quantifying:
  - Average time per manual PO cycle (industry: 2–6 hours)
  - Error rate in manual supplier selection
  - Typical MOQ compliance failures
- [ ] Add a demo narrative: "Here's a scenario where 3 SKUs are critical, watch the system catch the double-order risk and auto-select the better supplier"
- [ ] Mention Cummins-specific context in your pitch (industrial filters, engine parts are in the seed data)

---

### 4. MCP Usage & Persistence — 15 pts

#### What's Built

**4 MCP Servers (all TypeScript, stdio JSON-RPC transport):**

| Server | Key | Tools | DB Tables |
|---|---|---|---|
| ERP Data Server | `erp` | `get_inventory`, `get_products`, `get_forecasts`, `ping` | `inventory`, `products`, `forecasts` |
| Supplier Data Server | `supplier` | `get_suppliers`, `get_supplier_products`, `score_suppliers`, `ping` | `suppliers`, `supplier_products`, `supplier_scoring_weights` |
| Logistics Server | `logistics` | `get_container_specs`, `calculate_container_plan`, `ping` | `container_specs` |
| PO Management Server | `po` | `create_draft_po`, `get_pos`, `update_po_status`, `log_decision`, `get_decision_log`, `ping` | `purchase_orders`, `po_line_items`, `decision_log` |

**Total: 14 MCP tools across 4 servers**

**MCP Invocation Pattern (`backend/mcp_client/client.py`):**
- Spawns Node.js subprocess with stdio transport
- Sends JSON-RPC: `initialize` → `notifications/initialized` → `tools/call`
- All agents communicate exclusively through MCP (no direct Supabase calls from Python agents)

**Read Operations (by agent):**
- DemandAnalyst: reads `get_inventory`, `get_forecasts`, `get_pos` (open PO check)
- SupplierSelector: reads `score_suppliers` (which internally reads supplier_products, scoring weights)
- ContainerOptimizer: reads `get_products` (for weight/CBM), `calculate_container_plan` (reads container_specs)
- POCompiler: reads nothing (output-only)

**Write Operations:**
- All 4 agents write to `log_decision` (decision_log table)
- POCompiler writes to `create_draft_po` (purchase_orders + po_line_items tables)
- Approval API writes via `update_po_status` (purchase_orders update)

#### Current Gaps
- MCP invocation is synchronous (subprocess per call, not persistent connection) — acceptable but non-standard
- `calculate_container_plan` does pure computation; Supabase read is a side effect (container specs lookup)
- **Estimated: 13–15/15** — strong coverage

#### How to Maximize
- [ ] In your pitch, explicitly walk through the MCP call chain for one agent (diagram: Agent → MCP tool → Supabase → response)
- [ ] Mention that MCP enables the agents to be swapped for different data backends without changing agent logic (architectural benefit)
- [ ] The `score_suppliers` tool is a particularly strong example — it reads scoring weights per product category from DB and applies them dynamically, showing DB-driven configuration

---

### 5. Governance, Safety & Auditability — 15 pts

#### What's Built

**Decision Logging:**
- Every agent calls `po:log_decision()` before returning
- Log entry includes: `run_id`, `agent_name`, `inputs` (JSON), `output` (JSON), `confidence` (0.0–1.0), `rationale`, `po_number`
- Queryable by `run_id`, `po_number`, `agent_name`
- Full logs viewable at `/logs` (admin-only page with filter pills + expandable JSON)

**Confidence Scoring:**
- All 4 agents produce LLM-generated confidence: `0.0–1.0`
- LLM-generated rationale (one-liner per agent)
- Fallback to deterministic confidence if LLM fails
- Displayed in UI with color-coded bars (green ≥80%, amber ≥60%, red <60%)

**Human-in-the-Loop Gate:**
- Pipeline pauses after each of 4 agents — user reviews before continuing
- PO status machine: `draft` → `pending_approval` → `approved` / `rejected`
- Approval requires: `reviewer` name, optional `notes`, optional `line_item_overrides`
- `approved_by`, `approved_at` stored in `purchase_orders` table

**Supplier Override:**
- Between SupplierSelector and ContainerOptimizer, user can override any AI supplier pick
- Stored with note: `"Manually selected by planner: {supplier_name}"`

**Multi-user RBAC:**
- `administrator`: full access (all pages including /approvals, /logs)
- `po_manager`: restricted (no /approvals, no /logs — redirected to /pipeline)
- Enforced in Next.js edge middleware + NavLinks component

**Auth Security:**
- Supabase Auth (email + password)
- JWT tokens stored as cookies (not localStorage) via `@supabase/ssr`
- `createBrowserClient` syncs session cookies — middleware reads cookies on every request
- Role stored in `user_metadata.role` — no extra DB round-trip required

**Security Posture:**
- Supabase connections: HTTPS (TLS 1.2+) by default (Supabase-managed)
- Backend: CORS restricted to localhost:3000, localhost:3001, and vercel.app origins
- Secrets: `.env` files (not committed), service role key server-side only
- RLS disabled for demo (explicitly documented in schema.sql)

#### Current Gaps
- No written security posture document (encryption-in-transit statement, secrets handling note)
- RLS disabled in Supabase (acceptable for demo, but should be noted as prod gap)
- Pipeline state stored in backend memory dict (no persistence — lost on server restart)
- No rate limiting on API endpoints
- **Estimated: 11–14/15**

#### How to Maximize
- [ ] **Write a `GOVERNANCE_BRIEF.md`** (this is a required deliverable!) covering:
  - Authentication model (Supabase Auth + JWT cookies)
  - Encryption in transit (HTTPS for all Supabase and OpenAI calls)
  - Secrets handling (env vars, service role key server-side only)
  - Data residency (Supabase hosted, region configurable)
  - Audit trail completeness
  - Human approval as control gate (no autonomous PO submission)
  - Known demo compromises (RLS off, in-memory pipeline state)
- [ ] Mention the pipeline state loss risk + note it as `pipeline_states[run_id]` in-memory store
- [ ] Add a PO `submitted_by` tracking field for po_manager user who initiated the pipeline run

---

### 6. Business Impact & Clarity — 10 pts

#### What's Built

**Quantifiable Outputs:**
- `po_total_usd` — total PO value including freight
- `container_plan.estimated_freight_usd` — freight cost
- `net_requirements[n].final_order_qty` — exact order quantities after MOQ enforcement
- `demand_confidence`, `supplier_confidence` — AI confidence per decision
- `sales_delta_pct` — % demand trend (shows growth/decline signal)
- Need-by date — prevents stockouts proactively

**Business Value Chain:**
1. Auto-detect SKUs below reorder point (eliminates manual monitoring)
2. Calculate exact replenishment quantities (eliminates spreadsheet errors)
3. Score and rank suppliers with category-weighted criteria (faster, more consistent selection)
4. Optimize container type for freight efficiency (reduces shipping cost by finding binding utilisation)
5. Generate PO with audit trail (eliminates manual PO writing)
6. Human approval gate (maintains governance without slowing process)

#### Current Gaps
- No explicit ROI calculation or time-savings estimate
- No comparison to "current state" (e.g., "without ProcureAI, this takes X hours and Y manual steps")
- No pilot plan document (required deliverable)
- **Estimated: 7–9/10**

#### How to Maximize
- [ ] **Write a `BUSINESS_SKETCH.md`** and `PILOT_PLAN.md` (both required deliverables)
- [ ] Add to pitch: "This 4-agent pipeline runs in under 60 seconds vs. 4–6 hours manual" (validate with actual runtime)
- [ ] Quantify: "For a company ordering 50 SKUs/month: 50 × 4hrs = 200hrs saved/month"
- [ ] Add TCO metric to the PO output (see TCO Bonus section below)

---

### OPTIONAL TCO BONUS — up to 10 pts

**TCO = Total Cost of Ownership** (or Total Cost Optimization)

This is about demonstrating quantified cost analysis beyond just PO line totals.

#### What's Partially There
- `po_total_usd` = line item totals + freight (partial TCO)
- `estimated_freight_usd` = shipping cost per PO
- `unit_price` per SKU per supplier available

#### What TCO Would Include
Full TCO calculation per order:
```
TCO = (unit_price × qty) + freight_per_unit + (lead_time_risk_cost) + (stockout_cost)
```
- **Freight per unit** = `estimated_freight_usd / total_units_ordered`
- **Lead time risk cost** = units at risk of stockout × margin impact per unit × lead time days
- **Stockout cost** = critical SKUs × estimated lost revenue per day × days at risk

#### How to Earn the TCO Bonus
- [ ] Add a `TCOSummary` component to the pipeline review screen showing:
  - Landed cost per unit (unit_price + freight/unit)
  - Total freight as % of PO value
  - Stockout risk avoided ($) = critical SKUs × monthly demand × margin
  - Net cost delta vs. cheapest supplier (shows that best score ≠ cheapest, but lowest TCO)
- [ ] In the PO compiler agent, add a `tco_per_unit` calculation to each line item
- [ ] In your pitch, frame container optimization as "we chose the 40ft container because it reduces landed cost by $X vs. two 20ft containers"

---

## REQUIRED DELIVERABLES STATUS

| Deliverable | Status | Notes |
|---|---|---|
| 10-min Pitch | ❌ Not in repo | Must be prepared separately |
| Runnable Demo | ✅ Implemented | Need setup README |
| Code Repository | ✅ Complete | Needs README |
| Tech Design Doc | ❌ Missing | **Create `TECH_DESIGN.md`** |
| Governance Brief | ❌ Missing | **Create `GOVERNANCE_BRIEF.md`** |
| Business Sketch | ❌ Missing | **Create `BUSINESS_SKETCH.md`** |
| Pilot Plan | ❌ Missing | **Create `PILOT_PLAN.md`** |

**3 of 7 deliverables are missing. These are required, not optional.**

---

## PRIORITIZED ACTION LIST

### Critical (do before demo)
1. **Write `README.md`** with exact setup steps (schema → seed → backend → frontend → MCP servers)
2. **Write `GOVERNANCE_BRIEF.md`** (auth model, encryption, secrets, audit, known compromises)
3. **Write `TECH_DESIGN.md`** (architecture diagram, agent descriptions, MCP call chain, data flows)
4. **Write `BUSINESS_SKETCH.md`** (problem, solution, value quantification)
5. **Write `PILOT_PLAN.md`** (rollout phases, integration points, success metrics)

### High Impact (maximize score)
6. Add explicit security posture section to codebase (even as a comment block in main.py or a brief doc)
7. Add TCO per-unit calculation to PO compiler output
8. Add an `OrchestratorAgent` wrapper (or at minimum a flowchart in tech design showing LangGraph DAG)
9. Record 3–5 min screen capture of full pipeline run (backup for live demo failures)

### Medium Impact (polish)
10. Add `make setup` script or `setup.sh` for one-command install
11. Persist pipeline state to Supabase (or at least note in-memory limitation in governance brief)
12. Add explicit `triggered_by` auto-fill from logged-in user in pipeline page (partially done)
13. Add competitor cost comparison in supplier view (shows TCO thinking)

---

## ESTIMATED TOTAL SCORE (current state)

| Category | Max | Current Estimate |
|---|---|---|
| Multi-agent Design & Orchestration | 25 | 18–21 |
| Working Demo & Reproducibility | 20 | 13–16 |
| Problem Framing & Realism | 15 | 11–13 |
| MCP Usage & Persistence | 15 | 13–15 |
| Governance, Safety & Auditability | 15 | 11–14 |
| Business Impact & Clarity | 10 | 7–9 |
| **Total** | **100** | **73–88** |
| TCO Bonus | +10 | 0–4 |

**Current estimate: 73–88 pts** (passes 70/100 threshold, likely in the upper tier with docs)

**With all recommended actions: 88–98 pts**

---

## STRONGEST TALKING POINTS FOR PITCH

1. **4 specialized agents, not 1 monolith** — Each agent has a single responsibility and communicates exclusively through MCP tools (clean separation of concerns)
2. **14 MCP tools across 4 servers** — ERP reads, supplier scoring, logistics bin packing, PO writes — real enterprise system categories
3. **No autonomous PO submission** — Human approval is a hard gate. The AI assists, humans decide. This is the governance story.
4. **Category-aware supplier scoring** — Weights come from DB (`supplier_scoring_weights` table). A filter has different priorities (delivery speed) vs. an electrical part (quality). This is configurable without code changes.
5. **Open PO deduplication** — Agent 1 checks for existing open POs per SKU to prevent double-ordering — realistic operational safeguard
6. **Full audit trail** — Every agent decision logged with inputs, outputs, confidence, and rationale. Full traceability from net_requirement to approved PO.
7. **Two-role access control** — Administrators can view audit logs and approve POs; PO Managers run the pipeline and review but can't override completed POs. Realistic enterprise RBAC.

---

*This document was generated from a full codebase audit of `/Users/sahmey/procureai/test`.*
