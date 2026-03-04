# ProcureAI Governance and Safety Brief (1 page)

## Purpose

This brief defines governance controls for ProcureAI’s current multi-agent PO drafting workflow and highlights where controls already exist versus where hardening is required for pilot/production.

## Security Posture Summary

**Authentication:** Supabase Auth with email + password. JWTs issued per session; roles stored in `user_metadata.role`.

**Session storage:** Sessions are persisted as HTTP cookies (via `@supabase/ssr`), not localStorage. This allows Next.js edge middleware to enforce route access on the server side before any page is rendered.

**Encryption in transit:** All client-to-Supabase traffic uses HTTPS (TLS 1.2+ enforced by Supabase infrastructure). All backend-to-OpenAI API calls use HTTPS. There is no plaintext network path in the data flow.

**Secrets classification:**
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe for browser exposure; the anon key is scoped by RLS policies in production
- `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` — backend-only; never sent to the client; loaded from `.env` files excluded from version control
- No secrets are hardcoded in source files

**Demo compromises (clearly scoped to demo environment):**
- Supabase RLS is disabled for all tables in the demo schema to simplify seeding and querying
- Backend API endpoints do not independently verify JWT or role; access control relies on frontend middleware
- These are explicitly acknowledged limitations, not oversights

## 1) Human-in-the-Loop Rules

Current implemented rules:
- Pipeline runs in staged steps, requiring user confirmation between agents.
- Planner can override supplier choice before logistics/PO compilation.
- Final business action (PO approval/rejection) is explicit and human-triggered.

Required operational policy:
- No PO should be treated as committed until explicit human action is recorded.
- Human reviewers must verify quantity reasonableness, supplier suitability, freight reasonableness, and exceptions (open PO overlap, urgent stockout risk).

Escalation thresholds (recommended):
- Confidence < 0.70 from any agent: mandatory manager review note
- High-value PO (threshold set by business): mandatory dual approval
- Supplier switch from preferred contract vendor: mandatory rationale note

## 2) Audit and Traceability Strategy

Current traceability:
- Every agent writes an entry into `decision_log` with inputs, outputs, confidence, rationale, timestamp, and run reference.
- PO header and line items persist with approver identity/timestamp fields.

Minimum audit standard for pilot:
- Every approved/rejected PO should allow reconstruction of who initiated the run, what each agent decided, what user overrides occurred, and who approved/rejected with timestamp.

Recommended additions:
- Correlation ID propagation from UI request to all downstream logs
- Immutable event stream copy (append-only) for forensic review
- Automated daily audit digest for policy exceptions

## 3) Data Handling Assumptions

Assumptions in current implementation:
- Data is operational procurement data (inventory, forecast, supplier scoring, PO records)
- Demo environment uses Supabase service role and disabled RLS
- LLM prompts/responses may include operational fields and are logged

Data handling policy for pilot:
- Restrict prompts to minimum required operational fields (data minimization)
- Avoid sending sensitive supplier contract terms unless required
- Maintain environment-level separation (dev/stage/pilot)
- Apply retention policy to decision logs and PO notes

## 4) Fail-Safe Behaviors

Current fail-safe behaviors:
- Agent exceptions stop progression and surface explicit error
- Missing prerequisites short-circuit downstream stages
- Supplier open-PO context enriches demand stage to reduce duplicate ordering risk

Required fail-safe policy:
- On tool failure (MCP/DB/LLM), default to "no commit" path
- On confidence/validation anomalies, force manual review checkpoint
- On persistence failure, do not allow state transition to approved
- Keep retry actions explicit and operator-driven

## Governance Risks and Mitigations

Top observed risks:
- Backend authorization is not enforced independently of frontend route protection.
- RLS is disabled in schema for demo convenience.
- In-memory run state can be lost on process restart.
- Approval and total-value controls can be inconsistent (pipeline approval action broadly reachable; PO header total currently excludes freight estimate).

Immediate mitigations before pilot:
- Enforce backend JWT + role authorization on all PO and log endpoints
- Enable RLS with least-privilege policies
- Persist pipeline run state in durable storage

## Bottom Line

ProcureAI already has strong governance primitives for a hackathon system (human gate, trace logs, stage-by-stage review). To be pilot-ready, the priority is security enforcement at the backend and durable state/control guarantees.
