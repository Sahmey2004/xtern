# Licensing & Legal

**ProcureAI -- Multi-Agent Supply Chain PO Automation**
Prepared for: Cummins Xtern 2026 Bonus Submission

---

## Open-Source Component Licenses

Every component in ProcureAI uses a permissive open-source license. There are no GPL or AGPL dependencies that would impose copyleft obligations on Cummins proprietary code.

| Component | License | Commercial Use | Copyleft Obligation |
|---|---|---|---|
| Next.js 14 | MIT | Permitted | None |
| FastAPI | MIT | Permitted | None |
| LangGraph | MIT | Permitted | None |
| Supabase (self-hosted) | Apache 2.0 | Permitted | None |
| Supabase Cloud (managed) | Commercial SaaS | Permitted (paid plan) | None |
| Anthropic MCP SDK | MIT | Permitted | None |
| Zod (validation) | MIT | Permitted | None |
| TypeScript | Apache 2.0 | Permitted | None |
| Python | PSF License | Permitted | None |
| PostgreSQL | PostgreSQL License | Permitted | None |

**Assessment:** The entire stack is clear for commercial deployment. No component requires source code disclosure or restricts proprietary use.

---

## AI Model Licensing

### Primary: OpenAI GPT-4o-mini (API)

| Item | Detail |
|---|---|
| Access model | Commercial API, pay-per-token |
| License requirement | OpenAI Terms of Service (accepted on API key creation) |
| Special license needed | No |
| Data retention by OpenAI | API inputs/outputs are NOT used for model training (per OpenAI API Data Usage Policy, effective March 2023) |
| Output ownership | Cummins owns all generated output per OpenAI ToS |
| Estimated cost | ~$2,000/month at production scale |

### Alternative: Meta Llama 3.1 8B Instruct (Self-Hosted)

| Item | Detail |
|---|---|
| License | Meta Llama 3.1 Community License |
| Commercial use | Permitted for organizations with fewer than 700 million monthly active users |
| Hosting | Self-hosted on GPU infrastructure (no API dependency) |
| Data retention | None -- all inference runs on Cummins-controlled hardware |
| Cost | $0 licensing; ~$500/month GPU compute (single A10G or equivalent) |

Cummins is well under the 700M MAU threshold, making Llama 3.1 fully available for commercial deployment. Switching from OpenAI to Llama requires changing one configuration value in the backend (model provider endpoint) with no code changes to agents or pipeline logic.

---

## Data Governance

| Concern | Approach |
|---|---|
| Data residency | All application data stored in Supabase (PostgreSQL). Supabase Cloud offers region selection (US, EU, APAC). Self-hosted option available for full control. |
| Data sent to LLM | Only structured prompts containing product names, quantities, and supplier metadata. No PII, no financial credentials, no trade secrets in prompts. |
| LLM provider data policy | OpenAI API does not train on customer data. Zero data retention option available via API configuration. |
| Full data sovereignty option | Deploy with self-hosted Llama 3.1 + self-hosted Supabase. Zero data leaves Cummins network. |
| Compliance posture | Supabase Cloud is SOC 2 Type II compliant. OpenAI API is SOC 2 Type II compliant. |
| Audit trail | All agent decisions logged to `decision_log` table with timestamps, inputs, outputs, and approval status. |

---

## Risk Summary

| Risk | Severity | Mitigation |
|---|---|---|
| OpenAI changes API terms | Low | Architecture supports model swap to Llama 3.1 or any OpenAI-compatible endpoint. No code changes required. |
| Supabase changes pricing | Low | Self-hosted Supabase is Apache 2.0. Migration path is documented. |
| Open-source component abandoned | Low | All components (Next.js, FastAPI, LangGraph) have large active communities and corporate backing. |
| License incompatibility discovered | Very Low | All licenses reviewed; no copyleft dependencies present. No linking or distribution concerns since this is an internal SaaS deployment. |

---

## Build vs Buy Recommendation

**Recommendation: Build.**

| Factor | Build (ProcureAI) | Buy (SaaS) |
|---|---|---|
| Licensing cost | $0 | $150K--250K/yr |
| Customization | Unlimited | Vendor-constrained |
| Data sovereignty | Full control | Vendor-dependent |
| AI model choice | Any (OpenAI, Llama, Claude, etc.) | Vendor-selected |
| Framework reusability | MCP + LangGraph pattern reusable across domains | Single-purpose license |
| Vendor lock-in risk | None | High |

The open-source stack carries zero licensing costs, provides full customization authority, ensures complete data sovereignty, and produces a reusable framework (MCP server pattern + LangGraph orchestration) that reduces the cost of future automation projects by approximately 60%. There is no technical or financial justification for a Buy approach given the requirements and scale of this application.
