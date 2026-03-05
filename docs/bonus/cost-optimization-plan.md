# YOY Cost Optimization Plan

**ProcureAI -- Multi-Agent Supply Chain PO Automation**
Prepared for: Cummins Xtern 2026 Bonus Submission

---

## 1. Strategic Objective

ProcureAI targets Cummins IT procurement operations with a clear mandate: **minimize spend, maximize reusability, and eliminate vendor lock-in.** The system is built entirely on open-source foundations, ensuring that every dollar spent on development produces an asset Cummins owns outright.

The core value proposition is simple: a single investment in a modular AI framework that pays for itself within months and can be redeployed across multiple operational domains without rebuilding from scratch.

---

## 2. Value Proposition: Open-Source First, No Vendor Lock-In

| Dimension | ProcureAI (Build) | SaaS (Coupa / SAP Ariba) |
|---|---|---|
| Licensing | $0 -- all MIT/Apache 2.0 | $150K--250K/yr per module |
| Customization | Full control over agents, logic, UI | Limited to vendor configuration |
| Data Sovereignty | All data in Cummins-controlled Supabase | Data resides on vendor cloud |
| Switching Cost | None -- standard APIs, open formats | High -- proprietary data models |
| AI/ML Integration | Native LangGraph agents, swap models freely | Vendor-gated AI features |
| Time to Customize | Hours (code change + deploy) | Weeks (vendor ticket + release cycle) |

**Bottom line:** SaaS platforms charge annually for features that ProcureAI delivers at a fraction of the cost, with full ownership and the ability to evolve independently.

---

## 3. Total Cost of Ownership: Build vs Buy vs Hybrid

### 3-Year TCO Comparison

| Cost Category | Build (ProcureAI) | Buy (Coupa/Ariba) | Hybrid |
|---|---|---|---|
| Year 1: Implementation | $150K--200K | $200K (license + onboarding) | $180K |
| Year 2: Operations | $50K--80K | $200K (license renewal) | $140K |
| Year 3: Operations | $50K--80K | $200K (license renewal) | $140K |
| **3-Year Total** | **$250K--360K** | **$600K** | **$460K** |
| Framework Reuse Credit | -60% on next project | $0 | -30% on next project |

The Build option saves **40--58%** over a pure Buy approach across three years. The Hybrid model (using a SaaS ERP connector with custom AI agents) falls in between but still carries vendor dependency.

---

## 4. Framework Reusability: The MCP + LangGraph Pattern

ProcureAI is not a single-purpose application. It is a **reusable multi-agent framework** built on two portable patterns:

1. **MCP Server Pattern** -- Each data domain (ERP, suppliers, logistics, PO management) is encapsulated in a standalone TypeScript MCP server exposing tools via JSON-RPC over stdio. New domains require only a new server; the client and orchestration layer remain unchanged.

2. **LangGraph Orchestration** -- The agent pipeline (DemandAnalyst, SupplierSelector, ContainerOptimizer, POCompiler) is a directed graph with conditional routing and human-in-the-loop approval. Swapping agents or adding new ones is a graph edit, not a rewrite.

### Reuse Candidates at Cummins

| Use Case | Reusable Components | New Components Needed | Estimated Effort |
|---|---|---|---|
| **Warranty Claims Processing** | MCP client, LangGraph pipeline, Supabase schema pattern, Next.js UI shell | Claims MCP server, ClaimsAnalyst agent, ApprovalAgent | 4--6 weeks |
| **Maintenance Scheduling** | MCP client, pipeline orchestration, approval flow, logging | Equipment MCP server, SchedulerAgent, PriorityAgent | 5--7 weeks |
| **Parts Fulfillment** | MCP client, supplier MCP server (as-is), logistics MCP server (as-is), UI shell | FulfillmentAgent, InventoryAgent | 3--5 weeks |

Each reuse instance saves approximately **60% of development effort** compared to building from scratch, because the framework, infrastructure, and patterns are already proven.

---

## 5. Year-Over-Year Breakdown

### Year 1: Initial Build and Pilot ($150K--200K)

- Development team (3 FTEs, 12 weeks): $120K
- Infrastructure setup (Supabase Pro, hosting, CI/CD): $5K
- Training and documentation: $10K
- LLM API costs for development and testing: $5K
- Contingency (15%): $20K--30K
- **Deliverable:** Production-ready PO automation system handling full procurement cycle

### Year 2: Maintenance, Optimization, and First Reuse ($50K--80K)

- Maintenance developer (0.5 FTE): $30K
- LLM API costs at production scale (~$2K/month): $24K
- Infrastructure (Supabase + hosting): $1.5K
- First framework reuse project (warranty claims): incremental $50K--70K (vs $150K standalone)
- **Deliverable:** Stable production system + one additional use case deployed

### Year 3+: Steady State and Continued Reuse ($50K--80K/yr)

- Ongoing maintenance: $30K
- Infrastructure and API costs: $25K
- Each additional reuse project: $50K--70K incremental
- **Cumulative savings vs SaaS:** $340K--$450K by end of Year 3
- **Deliverable:** Multi-domain AI operations platform

---

## 6. Efficiency Gains

ProcureAI directly reduces manual effort in the procurement planning cycle:

| Metric | Before ProcureAI | After ProcureAI | Improvement |
|---|---|---|---|
| Procurement planners required | 5 FTEs | 2 FTEs (AI-augmented) | 60% headcount reduction |
| PO generation cycle time | 4--6 hours | < 5 minutes | 98% faster |
| Supplier evaluation | Manual spreadsheet review | Automated multi-factor scoring | Consistent, auditable |
| Container optimization | Rule-of-thumb estimates | Algorithm-driven bin packing | 10--15% freight savings |
| Error rate in PO creation | 3--5% | < 0.5% (validated by agents) | 85% reduction |

The 3-FTE reduction represents approximately **$270K--$390K in annual labor savings** (loaded cost), which alone exceeds the total 3-year cost of the system.

---

## 7. Development Method

ProcureAI is built and maintained by an internal team using entirely open-source tooling:

- **Frontend:** Next.js 14 (MIT) with TypeScript
- **Backend:** Python FastAPI (MIT) with LangGraph (MIT) orchestration
- **Database:** Supabase (Apache 2.0) with PostgreSQL
- **AI Models:** OpenAI GPT-4o-mini via API (pay-per-token, no license fee) with option to migrate to self-hosted Llama 3.1
- **MCP Servers:** TypeScript with Anthropic MCP SDK (MIT)

No proprietary dependencies. No vendor lock-in. Full source code ownership.

---

## 8. Recommendation

**Build on open-source.** The numbers are clear: ProcureAI costs less than half of a comparable SaaS solution over three years, delivers full customization and data sovereignty, and creates a reusable framework that reduces the cost of every subsequent AI automation project by 60%. The investment pays for itself in under six months through labor savings and freight optimization alone.
