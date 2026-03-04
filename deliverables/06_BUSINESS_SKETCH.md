# ProcureAI Business Sketch (1 page)

## 1) Target Users and Stakeholders

Primary users:
- Supply/PO planners (`po_manager`) who generate and review replenishment drafts
- Procurement managers (`administrator`) who oversee approvals and exceptions

Secondary stakeholders:
- Operations leadership (service-level/stockout performance)
- Finance/AP (PO quality, reconciliation, approval traceability)
- IT/data teams (integration, security, supportability)

## 2) KPI Framework

Core KPIs for pilot tracking:
- PO draft cycle time (minutes from start to draft PO)
- Manual touches per PO (number of user/system handoffs)
- Approval turnaround time
- PO rework rate (% drafts requiring material edits)
- Supplier policy compliance (% selections aligned with approved scoring policy)
- Audit completeness (% approved POs with full run/decision trace)

Optional outcome KPIs:
- Expedite freight incidence
- Stockout events tied to planning latency
- Planner throughput (POs per planner per week)

## 3) Baseline vs Target Outcomes (Assumptions)

Assumption set for a pilot business unit:
- 1,200 POs/year
- Baseline manual draft effort: 90 minutes per PO
- Target with ProcureAI: 35 minutes per PO
- Fully loaded planner labor rate: $65/hour

Baseline and target:
- Baseline effort: 1,800 hours/year
- Target effort: 700 hours/year
- Time saved: 1,100 hours/year
- Labor value of savings: 1,100 x $65 = $71,500/year

Quality/controls target assumptions:
- Rework rate improvement: 15% to 8%
- Approval turnaround improvement: 2.0 days to 0.5 day
- Audit completeness improvement: 60% to 95%

These are planning assumptions; pilot must replace them with measured values.

## 4) Simple ROI / Value Estimate

Estimated annual value components (assumption-based):
- Labor savings from draft automation: $71,500
- Avoided expedite/rework impact: $20,000
- Compliance/audit process savings: $8,500

Total estimated annual value: $100,000

Indicative annualized cost assumptions:
- Engineering/support time: $30,000
- Cloud/API/tools: $12,000
- Change management/training: $8,000

Total annualized cost: $50,000

Simple ROI estimate:
- Net value = $100,000 - $50,000 = $50,000
- ROI = $50,000 / $50,000 = 100%
- Payback period ≈ 6 months

## 5) Total Cost of Ownership (TCO) Framing

ProcureAI optimizes for **landed cost per unit**, not just unit price.

TCO components visible in the pipeline:
- **Unit price** per SKU per supplier (from `supplier_products` table, scored per category)
- **Estimated freight** (`container_plan.estimated_freight_usd`) — allocated across all line items
- **Landed cost per unit** = `unit_price + (estimated_freight_usd / total_units_ordered)`

Container optimization contribution:
- The logistics agent selects the container type that maximizes **binding utilisation** (the higher of weight fill % vs volume fill %)
- Example: a single 40ft container at 72% utilisation vs two 20ft containers at 46% utilisation each — the 40ft option saves ~$1,500 in base freight and surfaces a lower landed cost
- The planner sees freight as a line item in the PO summary, enabling explicit freight-vs-unit-price trade-off decisions

Open PO duplicate detection contribution:
- Agent 1 cross-references existing open/draft POs before computing net quantities
- Avoids duplicate orders that would inflate inventory holding costs and excess freight
- In environments with 1,200 POs/year, even a 3% duplicate-order rate = 36 avoided redundant orders/year

## Decision Guidance

If pilot KPIs show at least:
- 30% cycle-time reduction,
- 25% rework reduction,
- and >90% audit completeness,
then scale-out is justified to adjacent categories/sites.
