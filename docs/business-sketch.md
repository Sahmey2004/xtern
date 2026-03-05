# Business Sketch

## Target Users & Stakeholders

| Role | Responsibilities | System Access |
|---|---|---|
| **Procurement Planner** (po_manager) | Initiates pipeline runs, reviews draft POs, manages day-to-day ordering | Run pipeline, view POs, view logs |
| **Supply Chain Manager** (administrator) | Approves or rejects POs, overrides supplier selections, sets scoring weights | Full access including approval authority |
| **Finance / Audit** (read-only) | Reviews decision logs for compliance, validates spend against forecasts | Read-only access to logs and PO history |

The system is designed for mid-to-large manufacturing procurement teams where purchase orders involve multiple suppliers, container logistics, and audit requirements.

## KPIs: Baseline vs. Target

| Metric | Baseline (Manual Process) | Target (ProcureAI) |
|---|---|---|
| **PO Cycle Time** | 4 -- 8 hours per order | Under 30 seconds per pipeline run |
| **Container Utilization** | ~70% (manual bin-packing) | 95%+ (algorithmic optimization) |
| **Supplier Coverage** | 1 -- 2 suppliers evaluated per order | All eligible suppliers scored (4 -- 6x) |
| **Audit Compliance** | Partial -- decisions documented inconsistently | 100% -- every agent decision logged automatically |
| **Human Review Rate** | Varies, often skipped under time pressure | 100% -- every PO requires explicit approval |

## Baseline vs. Target Outcomes

**Manual process (baseline):** A procurement planner receives a restock request, manually checks inventory in the ERP, contacts 1-2 known suppliers for quotes, estimates container sizing from experience, and assembles a PO in a spreadsheet. Audit documentation is an afterthought. The process takes hours and relies heavily on institutional knowledge.

**AI-automated with human oversight (target):** The planner triggers a single pipeline run. Four specialized agents analyze demand, score all eligible suppliers, optimize container packing, and compile a draft PO -- all in under 30 seconds. The planner reviews the output, checks the rationale in the decision log, and approves or rejects. Every decision is automatically documented.

## ROI Estimate

**Assumptions:**
- 50 purchase orders processed per week
- 2 hours of manual labor saved per PO (research, quoting, documentation)
- Fully loaded labor cost: $75/hour

**Direct labor savings:**
- 50 POs x 2 hours x $75/hr = **$7,500 per week**
- Annual savings: **~$390,000**

**Freight savings from container optimization:**
- Improving utilization from 70% to 95% reduces the number of containers shipped
- Conservative estimate: 10 -- 15% reduction in annual freight spend
- For a mid-size manufacturer spending $2M/year on freight, this represents $200K -- $300K in additional savings

**Total estimated annual impact: $590K -- $690K**, excluding soft benefits such as faster supplier response, reduced stockouts, and improved audit readiness.
