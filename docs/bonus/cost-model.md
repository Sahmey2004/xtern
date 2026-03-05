# Cost Model & Financials

**ProcureAI -- Multi-Agent Supply Chain PO Automation**
Prepared for: Cummins Xtern 2026 Bonus Submission

---

## One-Time Implementation Costs

| Item | Cost | Notes |
|---|---|---|
| Development team (3 FTEs x 12 weeks) | $120,000 | Full-stack + ML engineers, blended rate ~$65/hr |
| Infrastructure setup | $5,000 | Supabase project, CI/CD pipelines, staging environment |
| Training and onboarding | $10,000 | User training, runbooks, internal documentation |
| **Total One-Time** | **$135,000** | |

---

## Annual Recurring Costs

| Item | Monthly | Annual | Notes |
|---|---|---|---|
| LLM API (GPT-4o-mini) | $2,000 | $24,000 | ~500K tokens/day at $0.15/1M input, $0.60/1M output |
| Supabase Pro | $25 | $300 | Managed PostgreSQL, auth, storage |
| Hosting (Railway/Fly.io) | $100 | $1,200 | Backend API + 4 MCP server processes |
| Vercel (Frontend) | $20 | $240 | Next.js hosting, Pro plan |
| Maintenance developer (0.5 FTE) | $2,500 | $30,000 | Bug fixes, model updates, feature requests |
| Monitoring and logging | $50 | $600 | Uptime checks, error tracking |
| **Total Annual** | **$4,695** | **$56,340** | Rounded to ~$60K/yr for planning |

---

## 3-Year Total Cost of Ownership

| | Year 1 | Year 2 | Year 3 | Total |
|---|---|---|---|---|
| **Build (ProcureAI)** | $135K + $60K = $195K | $60K | $60K | **$315K** |
| **Buy (Coupa)** | $200K | $200K | $200K | **$600K** |
| **Savings (Build vs Buy)** | $5K | $140K | $140K | **$285K (47%)** |

*Note: Coupa estimate based on mid-market license for procurement module. SAP Ariba typically runs $250K--350K/yr, widening the gap further.*

---

## Return on Investment

| Benefit | Annual Value | Basis |
|---|---|---|
| Headcount reduction (5 planners to 2) | $390,000 | 3 FTEs at $130K loaded cost |
| Freight optimization (container packing) | $50,000 | 10--15% savings on $400K annual freight |
| Error reduction in PO processing | $25,000 | Fewer returns, corrections, expedited shipments |
| Cycle time reduction (supplier response) | $15,000 | Faster order placement captures early-pay discounts |
| **Total Annual Benefit** | **$480,000** | |

---

## Payback Analysis

| Metric | Value |
|---|---|
| Total Year 1 investment | $195,000 |
| Monthly benefit (once deployed) | $40,000 |
| Deployment timeline | 12 weeks (Month 1--3) |
| Benefits begin | Month 4 |
| Cumulative benefit by Month 8 | $200,000 |
| **Payback period** | **~4 months after deployment (Month 7--8)** |
| Net benefit, end of Year 1 | $165,000 |
| Net benefit, end of Year 3 | $1,125,000 |

The system reaches **cost neutrality by Month 8 of Year 1**. Every month thereafter generates approximately $40K in net value. By the end of Year 3, cumulative net benefit exceeds $1.1M against a total spend of $315K.

---

## Sensitivity Notes

- If LLM costs decrease (expected 30--50% YOY reduction in API pricing), annual recurring drops to ~$45K/yr by Year 3.
- If self-hosted Llama 3.1 is adopted, API costs drop to $0 but hosting increases by ~$500/month for GPU compute. Net savings: ~$18K/yr.
- Framework reuse on a second project (e.g., warranty claims) adds ~$60K one-time but saves ~$135K vs standalone build, yielding a net $75K saving per reuse instance.
