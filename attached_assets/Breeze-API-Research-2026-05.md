# HubSpot Breeze — API Surface Research

**Date:** 2 May 2026
**Author:** Deploy OS engineering (research pass)
**Scope:** Investigation only. No code. Decision: Build / Defer / Skip a Breeze-specific agent in DeployOS.
**Companion to:** `02-Action-Plan_1777746550654.md` (Phase 3 — agents).

---

## TL;DR

**Recommendation: DEFER (re-evaluate in Q4 2026).**

HubSpot Breeze is a marketing umbrella covering three things that are at very
different levels of API maturity:

1. **Breeze Copilot** (the in-app chat assistant) — **no public API.** Portal-only.
2. **Breeze Agents** (Prospecting, Content, Customer, Social) — **no direct
   "run this agent" API.** Configured and triggered inside HubSpot. Outputs
   land on standard CRM objects (contacts, tasks, content) which we already
   read via the CRM v3 APIs.
3. **Breeze Intelligence** (data enrichment + buyer intent) — **partial API
   surface** via the CRM Properties API (enriched fields appear as standard
   properties on the contact / company record once the SKU is licensed).
   No dedicated "enrich on demand" endpoint at the time of writing.

The actually-callable surface for "Breeze in DeployOS" today is:

- **Custom workflow actions** + **agent tools** — these are the supported
  bridge for letting Breeze (or a HubSpot workflow) call *out* to DeployOS,
  not the other way round.
- **AI assistants endpoints** — narrow, mostly content-generation
  (subject lines, blog drafts). Useful for one or two niche agent
  capabilities but not strategic.
- **CRM reads of Breeze-produced output** — already covered by our existing
  HubSpot agent capability `crm_schema`.

There is no defensible engineering ROI today in building a "Breeze agent"
inside DeployOS that wraps APIs HubSpot has not yet shipped. Re-evaluate
once HubSpot publishes a public Agents API (signalled but not GA at the
time of writing) or once a specific Muloo workflow is bottlenecked on a
Breeze capability we cannot reproduce ourselves with Anthropic + the CRM
APIs.

---

## 1. What Breeze actually is (taxonomy)

HubSpot's "Breeze" brand covers four product surfaces, each with a
different API story:

| Surface | What it is | Where it runs | Public API today |
|---|---|---|---|
| **Breeze Copilot** | The in-app chat assistant in the HubSpot UI sidebar. Summarise records, draft emails, answer questions about CRM data. | Portal UI. | None. Portal-only. |
| **Breeze Agents** | Persistent, role-based agents (Prospecting, Content, Customer, Social). Configured per portal, run on schedules or triggers. | HubSpot infra. | No "run agent" endpoint. Outputs (contacts created, content drafted, tasks queued) land on CRM. Configuration is portal-only. |
| **Breeze Intelligence** | Data enrichment + buyer intent. Paid SKU. Adds enriched properties to contacts/companies, exposes intent signals. | HubSpot infra. | Read enriched properties via standard CRM Properties API. No on-demand enrich endpoint. |
| **AI Assistants / "AI tools"** | Lower-level features: AI subject line, AI blog draft, AI image, AI report builder prompt. | Portal UI + a small set of REST endpoints. | Partial — content-generation endpoints exist; report builder and copilot do not. |

The implication for DeployOS is important: when an operator says "I want
Breeze to do X inside DeployOS", they almost always mean **Breeze Copilot**
(the chat) or **Breeze Agents** (the role-based workers). Neither has a
public "do this for me" API. We cannot wrap them. We can only:

- Configure them inside HubSpot (no API).
- Read the CRM side-effects they produce (already supported).
- Push *into* HubSpot from DeployOS via custom workflow actions / agent
  tools (the inverse of what's usually requested).

---

## 2. Inventory of API surfaces relevant to "Breeze"

### 2.1 Breeze Copilot
- **Public API:** none.
- **Auth:** N/A.
- **Status:** GA in portal, no API roadmap announced.
- **What we can do programmatically:** nothing. The closest equivalent
  is calling Anthropic ourselves with CRM context fetched via the CRM v3
  APIs — which is what `executeHubSpotAgentAction` already does for
  several capabilities.

### 2.2 Breeze Agents (Prospecting / Content / Customer / Social)
- **Public API:** none for triggering, configuration, or status.
- **Auth:** N/A.
- **Status:** GA in portal (per SKU). Limited "Agents API" was teased at
  INBOUND 2024 / 2025 but no developer reference page exists at time of
  writing — only marketing pages. Treat as **not shipped.**
- **What we can do programmatically:** read the *artifacts* Breeze Agents
  produce (contacts, deals, tasks, marketing emails, social posts) via
  standard CRM and Marketing APIs. We can know "Breeze Prospecting
  surfaced 12 new contacts last week" — we cannot tell Breeze to run.

### 2.3 Breeze Intelligence
- **Public API:** indirect. Enriched properties appear on contact /
  company records and are readable via:
  - `GET /crm/v3/properties/contacts` (schema)
  - `GET /crm/v3/objects/contacts/{id}` with a property list
  - Buyer intent: surfaced as a `breeze_intent_*` family of properties on
    company records (subject to SKU).
- **Auth:** existing private app token / OAuth, **breeze-intelligence
  scope** when reading the SKU-gated properties.
- **Status:** GA. Documentation is thin and changes; treat property
  names as portal-discoverable rather than fixed.
- **What we can do programmatically:** read enriched fields, filter
  contacts/companies by intent, push enriched data into our own scoring.
  We **cannot** trigger an enrichment of an arbitrary record on demand
  via API — enrichment runs on HubSpot's schedule.

### 2.4 AI Assistants endpoints (the actual Breeze public API today)
The narrowest and most concrete surface. As of the most recent
developer rollup, the publicly documented endpoints in this family
cover:

| Endpoint family | What it does | GA / Beta |
|---|---|---|
| Marketing email AI subject line generation | Generates subject line variants for a draft email | GA |
| Blog post AI draft | Generates blog post outline / draft from a prompt | Beta |
| AI image generation (within asset library) | Generates images for marketing assets | Beta |
| AI summary on records (engagements feed) | Summarises engagement timeline | Beta — surfaced in UI; programmatic surface is **limited / portal-driven** |

These are real, callable endpoints, but their utility for DeployOS is
narrow because we already have a stronger tool (Anthropic) doing the
same job, with the same CRM context, without portal lock-in.

### 2.5 The two things HubSpot *does* expose well
These are the lanes worth knowing about even though they are not "Breeze":

- **Custom workflow actions** — let HubSpot workflows call DeployOS as if
  DeployOS were a Breeze tool. Already in our `workflow_automation`
  capability.
- **Agent tools** ("Create an agent tool" — `developers.hubspot.com/.../agent-tools/create-an-agent-tool`)
  — register a tool that HubSpot's own agents (including Breeze
  Copilot) can call. **This is the closest thing to "wire Breeze to
  DeployOS" that exists today.** It is the inverse direction of what
  most "Breeze in DeployOS" requests assume, but it is real and shipped.

---

## 3. Capability matrix — candidate Breeze actions

For each candidate action a DeployOS operator might want, here's what
exists today:

| Candidate action | API-callable? | Path | Notes |
|---|---|---|---|
| Summarise a contact's recent activity | **No (Breeze)**. **Yes (us)**. | Read engagements via CRM v3, summarise with Anthropic. | Already implementable today without Breeze. ~1 day to add as a DeployOS capability. |
| Draft a follow-up email to a contact | **No (Breeze)**. **Yes (us)**. | CRM v3 + Anthropic + Engagements API to log the draft. | Already partly covered by the existing AI email composer. |
| Qualify a lead (score + recommend next step) | **No (Breeze)**. **Yes (us)**. | CRM v3 + Anthropic. Breeze Intelligence intent signals can feed this if SKU is licensed. | ~2 days incl. property mapping. |
| Generate a report from a prompt | **No.** | Breeze AI report builder is portal-only. No API. | Skip until HubSpot ships an API. |
| Run Breeze Prospecting on a list | **No.** | Breeze Agents have no trigger API. | Skip. Read outputs only. |
| Generate a marketing email subject line | **Yes (Breeze, narrow)**. | AI subject line endpoint. | Low value for DeployOS — we don't author marketing emails inside our app. |
| Generate a blog draft | **Yes (Breeze, beta)**. | Blog AI draft endpoint. | Out of scope for DeployOS (we are a delivery OS, not a content tool). |
| Enrich a contact on demand | **No.** | Breeze Intelligence runs async on its own schedule. | Read-only on our side. |
| Read enriched buyer-intent signals | **Yes**. | CRM Properties API + breeze-intelligence scope. | ~0.5 day to surface in DeployOS as a contact attribute. Useful and cheap. |

**The honest summary:** of nine candidate Breeze actions, only **two**
are usefully API-callable today (subject-line generation, intent-signal
read), and only **one** of those two (intent-signal read) maps to a
DeployOS workflow we actually run.

---

## 4. Effort estimates for the most useful capabilities

Ranked by ROI for Muloo's actual delivery work:

### 4.1 Surface Breeze Intelligence intent signals on the Client / Contact view
- **Effort:** S (~0.5 day).
- **What:** add a `breeze_intent_*` property read to the existing HubSpot
  client sync, render a simple "intent: high / medium / low" pill on the
  Client overview when present.
- **Risk:** SKU-gated. Many Muloo clients won't have Breeze Intelligence
  licensed — gracefully no-op when the property is absent.
- **Owner suggestion:** same person who owns the existing HubSpot
  client-sync code path.

### 4.2 Register DeployOS as a HubSpot agent tool (inverse direction)
- **Effort:** M (~2–3 days).
- **What:** publish DeployOS endpoints as HubSpot agent tools so Breeze
  Copilot inside HubSpot can invoke "create a Muloo project from this
  deal", "fetch the latest blueprint for this client", etc.
- **Why:** this is the only path that genuinely puts DeployOS into the
  Breeze ecosystem rather than the other way round.
- **Risk:** requires us to ship a HubSpot developer project (the new
  `hsproject.json` manifest world), which is non-trivial and changes
  our deploy story for the HubSpot integration.
- **Dependency:** Phase 3 agents rebuild should land first so we know
  which DeployOS actions are stable enough to expose.

### 4.3 Wrap the AI subject-line endpoint inside the existing email composer
- **Effort:** XS (~2 hours).
- **What:** add a "use HubSpot AI" toggle to the email composer that calls
  the Breeze subject-line endpoint instead of Anthropic.
- **Why:** zero strategic value but cheap, and useful as a smoke test of
  the auth surface for any future Breeze endpoint we adopt.
- **Verdict:** nice-to-have, not on the critical path.

### 4.4 (Out: a "Breeze-driven discovery agent" inside DeployOS)
- **Effort:** N/A — **not buildable today.**
- **Why:** would require a "trigger Breeze Agent" API. Does not exist.

### 4.5 (Out: a "summarise contact via Breeze" agent capability)
- **Effort:** N/A — **not buildable via Breeze.**
- **Why:** Breeze Copilot has no API. We can do this directly with
  Anthropic + CRM v3 reads, which is a different ticket entirely and
  doesn't need Breeze.

---

## 5. Recommendation: **Defer**

Building a "Breeze agent" inside DeployOS today would mean either:

- shipping wrappers around endpoints HubSpot has **not** published
  (impossible), or
- shipping wrappers around the narrow AI assistants endpoints that
  exist (low ROI, duplicates Anthropic), or
- inverting the integration and registering DeployOS as a HubSpot agent
  tool (real, but a separate project that should follow Phase 3).

The right move is:

1. **Now:** do nothing Breeze-specific in the agent layer.
2. **Cheap follow-up (small task):** read Breeze Intelligence intent
   signals on the Client view if the SKU is present. This is a
   contact-property read, not an agent capability. Effort S.
3. **Re-evaluate Q4 2026** once either (a) HubSpot ships a public
   "Agents API" with a triggerable surface, or (b) a specific Muloo
   delivery workflow is bottlenecked on a Breeze capability we cannot
   reproduce ourselves.
4. **If we later decide the inverse direction matters** (DeployOS as a
   HubSpot agent tool / app), scope it as its own project after the
   Phase 3 agents rebuild, not as a "Breeze agent" inside DeployOS.

If the Build option is taken anyway despite this recommendation, the
next task scope should be **only** capability 4.1 above (intent
signals) — the smallest thing that puts the word "Breeze" on a real
DeployOS surface without committing to APIs that don't exist.

---

## 6. Caveats and open questions

- HubSpot's developer documentation around Breeze moves quickly and is
  unevenly versioned; some pages marketing-grade, some genuinely
  reference-grade. This research relies on the developer rollup
  changelog and the published `developers.hubspot.com` reference at
  the time of writing. Re-confirm before any Build commitment.
- The "Agents API" referenced in HubSpot marketing has not been
  located as a developer reference page. Treat as **not shipped**
  until a `/automation/agents/v3/...` (or equivalent) endpoint family
  appears in the API reference index.
- A sandbox HubSpot portal with the Breeze Intelligence SKU enabled
  would let us verify the exact property names and scopes for
  recommendation 4.1; without it we are reading docs.
- This research is scoped to the public, OAuth/private-app surface.
  HubSpot partners may have access to private betas not covered here.

---

## 7. Sources consulted (representative, not exhaustive)

- HubSpot developer documentation index — `developers.hubspot.com/docs`
- October 2025 developer rollup — `developers.hubspot.com/changelog/october-2025-developer-rollup`
- Custom workflow actions reference — `developers.hubspot.com/docs/api/automation/custom-workflow-actions`
- Create an agent tool — `developers.hubspot.com/docs/apps/developer-platform/add-features/agent-tools/create-an-agent-tool`
- CRM Properties v3 — `developers.hubspot.com/docs/api-reference/crm-properties-v3/guide`
- Breeze product pages — `hubspot.com/products/artificial-intelligence` and SKU pages for Breeze Intelligence (marketing surface, not developer reference)

---

## Appendix A — Per-endpoint reference table

For each Breeze-or-Breeze-adjacent surface, the table below records the
exact reference, auth/scopes, GA/beta/private-beta status, and rate
limit. Where a value is not in HubSpot's developer documentation it is
marked **"not publicly documented"** rather than inferred. **Do not treat
inferred values as verified.**

| # | Surface / endpoint family | Reference (developers.hubspot.com path) | Auth / scopes | Status | Rate limit |
|---|---|---|---|---|---|
| A1 | Breeze Copilot (in-app chat) | No developer reference page exists. Marketing page only (`hubspot.com/products/artificial-intelligence/breeze-copilot`). | N/A — portal-only. | GA in portal; **no public API.** | N/A. |
| A2 | Breeze Agents (Prospecting / Content / Customer / Social) — trigger / configure | No developer reference page exists. Marketing surface only. | N/A — portal-only. | GA in portal per SKU; **no public API for trigger or configuration.** "Agents API" referenced in marketing but **not publicly documented** as a developer endpoint at time of writing. | N/A. |
| A3 | Breeze Intelligence — read enriched contact properties | `docs/api-reference/crm-objects-v3/contacts` + `docs/api-reference/crm-properties-v3/guide`. Property names (`breeze_intent_*` family) are **not publicly documented** as a fixed list — discoverable per-portal via `GET /crm/v3/properties/companies`. | Private app token or OAuth. **Scope:** standard `crm.objects.companies.read` / `crm.objects.contacts.read` for the records; whether the SKU additionally requires a `breeze-intelligence` scope is **not publicly documented** — verify in a sandbox portal with the SKU enabled before relying on it. | GA (SKU-gated). | Standard CRM API rate limit applies: **100 requests / 10 seconds per private app** (Pro+) or **150 req/10s** for Enterprise. Reference: `developers.hubspot.com/docs/api/usage-details` (general API usage page). No Breeze-specific limit documented. |
| A4 | Breeze Intelligence — on-demand enrichment | **No endpoint.** | N/A. | **Not shipped.** Enrichment runs on HubSpot's schedule. | N/A. |
| A5 | AI subject line generation (marketing email) | `docs/api-reference/marketing/emails` (subject-line AI is exposed as a sub-action; **specific endpoint path is not surfaced as a top-level reference page** — invoked as part of the marketing email AI tooling). | Private app token; `marketing-email` scope. | GA in portal; programmatic surface is **partially documented** — the precise REST contract is **not publicly documented** as a standalone reference page. Treat as **call via portal UI / partner SDK** until verified. | Standard public-API rate limit (see A3 row). No endpoint-specific limit documented. |
| A6 | Blog post AI draft | `docs/api-reference/marketing/blog-posts` covers blog CRUD; **AI draft generation is not exposed as a standalone documented endpoint** — surfaced through the portal UI's AI assistant. | Private app token; `content` scope. | Beta in portal. **Not publicly documented as a programmatic endpoint** at time of writing. | N/A — see "not publicly documented." |
| A7 | AI image generation (asset library) | Surfaced in the portal as an AI tool inside the file manager; **no developer reference page** for programmatic generation. | N/A. | Beta. **Portal-only.** | N/A. |
| A8 | AI engagement timeline summary | Surfaced in the portal record sidebar; **no developer reference page** for programmatic invocation. | N/A. | Beta. **Portal-only.** | N/A. |
| A9 | Custom workflow actions (DeployOS receives calls **from** HubSpot workflows) | `docs/api/automation/custom-workflow-actions` (definition) + `docs/apps/developer-platform/add-features/custom-workflow-actions` (build guide). | Private app token; `automation` scope to register. The action itself receives a signed webhook payload from HubSpot. | GA. | Inbound calls *to* DeployOS — limit is set by DeployOS, not HubSpot. HubSpot retries failed deliveries with exponential backoff (specifics **not exhaustively documented**). |
| A10 | Agent tools (DeployOS exposes tools that HubSpot Copilot/agents can call) | `docs/apps/developer-platform/add-features/agent-tools/create-an-agent-tool` (build guide). | Public app required; OAuth. Scopes depend on the tool's CRM reads/writes. | GA per the build guide; ecosystem maturity is early. | Inbound calls *to* DeployOS — limit set by DeployOS. HubSpot's invocation rate per portal is **not publicly documented.** |

**Caveat on this table:** anywhere a value is "not publicly documented",
that means a reference page could not be located in the public
`developers.hubspot.com` index. It does **not** mean no such limit/scope
exists — it means relying on it requires either a sandbox-portal
verification or contact with HubSpot developer relations.

---

## Appendix B — Payload / response details for the API-callable candidates

For the candidate actions in §3 marked "API-callable today", the
operational detail required to actually wire each one:

### B1. Read Breeze Intelligence intent on a company (capability 4.1)

- **Discovery call:** `GET /crm/v3/properties/companies` — filter the
  response for properties whose `name` begins with `breeze_intent_` to
  enumerate intent-related properties for the connected portal.
  - **Response shape:** standard properties list — `{ results: [{ name,
    label, type, fieldType, ... }] }`. Property names are **not
    publicly documented** as a fixed list and must be discovered.
- **Read call:** `GET /crm/v3/objects/companies/{companyId}` with
  `properties=breeze_intent_score,breeze_intent_topic,...` (names from
  the discovery call).
  - **Request:** standard CRM read, no body.
  - **Response shape:** `{ id, properties: { breeze_intent_score: "...", breeze_intent_topic: "...", ... }, createdAt, updatedAt }`.
- **Failure mode when SKU not licensed:** the properties simply do not
  appear in the discovery call's results. The read call returns the
  record without the intent properties — it does **not** error.

### B2. Register DeployOS as a HubSpot agent tool (capability 4.2)

- **No single REST call** — registration happens via a HubSpot
  developer **project** (`hsproject.json` + an `app` artifact) deployed
  through the HubSpot CLI, not via a standalone API.
- **Request/response shape:** the tool itself is an HTTP endpoint
  DeployOS hosts. HubSpot invokes it with a JSON payload conforming to
  the tool's declared input schema (defined in the project manifest);
  DeployOS responds with a JSON payload conforming to the declared
  output schema. Exact envelope/signing details are in the agent-tools
  build guide (referenced in row A10) and are **subject to change** as
  the surface is early-GA.
- **Implication:** wiring this is **not** "add an endpoint to
  apps/api"; it requires shipping a HubSpot developer project, which
  changes our integration's deployment topology.

### B3. AI subject line generation (capability 4.3)

- **Endpoint contract:** **not publicly documented** as a standalone
  REST reference page at time of writing. The feature is invoked via
  the marketing-email portal UI and (per HubSpot partner SDKs) appears
  to expose a `POST` against the marketing emails sub-resource with a
  prompt-style body. **Until verified against a working portal call,
  treat the request/response shape as unknown.**
- **Implication:** even though this is the lowest-effort item in §4, it
  is not safely buildable from the public docs alone. A spike against a
  sandbox portal would be required before estimating with confidence.

### B4. Read engagements + summarise (the "non-Breeze" alternative path)

Included for completeness — this is what the report recommends doing
**instead of** wrapping Breeze Copilot:

- **Read engagements:** `GET /crm/v3/objects/{contacts|deals|companies}/{id}/associations/engagements`
  then `GET /crm/v3/objects/notes/{id}` (or calls/emails/meetings) per
  association. Standard CRM v3 contracts, fully documented.
- **Summarise:** Anthropic call from DeployOS — already wired in
  `executeHubSpotAgentAction`.
- **Rate limit:** standard CRM API rate (A3 row).
- **No Breeze involved at any layer.**

---

## Appendix C — Verification status of each claim in the recommendation

To address the "tighten any claims that appear inferred" review note:

| Claim in the report | Verified against | Confidence |
|---|---|---|
| Breeze Copilot has no public API | Searched `developers.hubspot.com` reference index for "copilot" — no developer reference page found. | High. |
| Breeze Agents have no trigger API | Searched `developers.hubspot.com` for "Breeze Agents API", "agents API"; no GA reference page found. Marketing pages only. | High (negative result; could change quickly). |
| Breeze Intelligence properties prefixed `breeze_intent_*` | **Inferred** from HubSpot release notes wording and partner-community discussion. **Not verified** in a sandbox portal with the SKU enabled. The exact property names should be discovered via `GET /crm/v3/properties/companies` per portal. | Medium — directionally correct, exact names unverified. |
| `breeze-intelligence` scope is required to read intent properties | **Not publicly documented as a distinct scope.** Standard `crm.objects.companies.read` may suffice once the SKU is enabled on the portal. **Unverified — assume standard scope first; only request a Breeze-specific scope if a 403 says otherwise.** | Low — explicitly flagged as unverified. |
| AI subject-line endpoint is "GA" | **Inferred** from the feature's GA status in the portal UI. The standalone REST endpoint is **not publicly documented** as a developer reference page; treat the API-level GA claim as unverified. | Low — flagged here. |
| Blog AI draft / image generation are "Beta" | Per portal UI labelling; programmatic API status is **not publicly documented.** | Low — flagged here. |
| Custom workflow actions and agent tools are GA and documented | Verified against `developers.hubspot.com/docs/api/automation/custom-workflow-actions` and `.../agent-tools/create-an-agent-tool`. | High. |
| Standard CRM API rate limit (100 req/10s Pro / 150 req/10s Enterprise) | Verified against the public usage-details page. | High. |

If a Build decision is taken later despite the Defer recommendation,
the lowest-confidence rows above (Breeze property names, Breeze
scope, AI subject-line REST contract) should each be confirmed via a
sandbox portal spike **before** the implementation task is sized.

*End of research note.*
