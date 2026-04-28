# Partner Platform + Breeze Agent Tool Integration
## Muloo DeployOS — Product Spec

*Partner: Tusk (marketing agency)*
*Model: Tusk does the marketing strategy and client relationships. Muloo provides the HubSpot execution layer via AI agents. Tusk pays for access.*

---

## The product in plain English

Tusk is a marketing agency. They're good at strategy, content, social, and brand. They're not HubSpot people. Their clients are on HubSpot.

Without Muloo, Tusk either:
- Does HubSpot work manually and slowly, making mistakes
- Brings in a separate HubSpot person, which eats margin
- Doesn't offer HubSpot-native delivery, which limits their service

With the Partner Platform, Tusk logs in, submits a marketing brief ("launch a lead gen campaign for [client], targeting construction companies, 3 blog posts + email nurture + LinkedIn posts"), and DeployOS agents handle the HubSpot execution — building the emails, scheduling the blogs, setting up the campaign, creating the workflow, building the dashboard.

Tusk reviews. Tusk approves. Work goes live.

Muloo earns a monthly platform fee. Tusk earns better margins and a more complete service. Clients get faster delivery.

---

## What marketing work DeployOS can execute in HubSpot

### Full API — agents can do this autonomously

| Task | HubSpot API | Status |
|---|---|---|
| Create marketing email (template + content) | `POST /marketing/v3/emails` | ✅ Supported |
| Schedule marketing email | `POST /marketing/v3/emails/{id}/schedule` | ✅ Supported |
| Create blog post (draft) | `POST /cms/v3/blogs/posts` | ✅ Supported |
| Schedule blog post to publish | `POST /cms/v3/blogs/posts/{id}/schedule` | ✅ Supported |
| Create contact list (campaign audience) | `POST /crm/v3/lists` | ✅ Supported |
| Create campaign object | `POST /marketing/v3/campaigns` | ✅ Supported |
| Associate content to campaign | `PUT /marketing/v3/campaigns/{id}/assets` | ✅ Supported |
| Create workflow (email nurture sequence) | `POST /automation/v4/flows` | ✅ Supported |
| Create form (lead capture) | `POST /marketing/v3/forms` | ✅ Supported |
| Create contact properties | `POST /crm/v3/properties/contacts` | ✅ Supported (already built) |
| Create marketing dashboard | Internal v1 API (CSRF) | ✅ Supported (already built) |
| Create landing page (structured) | `POST /cms/v3/pages/landing-pages` | ✅ Supported |

### Needs browser (Cowork fallback)

| Task | Why |
|---|---|
| Social posts (LinkedIn, X, Facebook) | **No public HubSpot Social API** — only internal. Use Cowork to create + schedule in UI, or use native integrations (Buffer/Hootsuite) as a workaround |
| Page builder / visual email editor | Drag-and-drop is UI only |
| A/B test setup | UI configuration |

### Important social post note

HubSpot has no public Social API. Options:
1. **Best path**: Use Buffer or Hootsuite API alongside HubSpot. Agent creates the post content, publishes via Buffer/Hootsuite API, logs it against the campaign in HubSpot.
2. **Cowork path**: Desktop agent opens HubSpot Social, creates + schedules the post.
3. **Manual path**: Agent generates the copy + image prompt, outputs as a structured review package for Tusk to post.

Recommendation: **Option 3 for now** (output structured post package), **Option 1 as the proper integration** once Buffer/Hootsuite MCP or API is wired in.

---

## Partner Platform — what it looks like for Tusk

### Access model

Tusk has a dedicated login. They land on **their own dashboard** — not Muloo's internal platform. Same underlying system, different view.

Tusk's dashboard shows:
- Their client accounts (not all Muloo clients)
- Their submitted jobs + status (queued / running / needs review / complete)
- Their Inbox (agent-generated drafts waiting for approval)

They cannot see Muloo internal projects, pricing, or other clients.

### Tusk's job submission flow

```
1. Tusk opens "New Job" in their dashboard
2. Selects client (e.g. Acme Construction)
3. Selects job type:
   - Blog post
   - Email campaign
   - Nurture sequence
   - Social post package
   - Lead gen campaign (full build)
   - Custom brief
4. Fills in the brief (natural language — what they want, target audience, tone, goals)
5. Submits
6. DeployOS decomposes the brief → queues agent jobs
7. Agents execute in HubSpot
8. Outputs appear in Tusk's Inbox as drafts
9. Tusk reviews, edits, approves
10. Agent publishes / schedules
```

### Job types for the marketing partner

**Blog Post Agent**
- Input: topic, target audience, keywords, tone, word count
- Process: Claude generates blog post → creates draft in HubSpot CMS → returns preview URL
- Output: HubSpot blog draft link in Tusk's Inbox

**Marketing Email Agent**
- Input: campaign goal, audience, CTA, tone
- Process: Claude generates subject line + email body → creates in `/marketing/v3/emails` → links to campaign
- Output: HubSpot email draft link in Tusk's Inbox

**Email Nurture Sequence Agent**
- Input: persona, trigger event, sequence length, goal
- Process: Claude generates N emails → creates all in HubSpot → creates workflow to send them in sequence → sets enrolment criteria
- Output: Workflow link + preview of all emails

**Lead Gen Campaign Builder Agent**
- Input: campaign name, target persona, content themes, budget context
- Process:
  1. Create campaign object in HubSpot
  2. Create contact list for target audience
  3. Create landing page (if requested)
  4. Create form + embed in page
  5. Create thank-you email
  6. Create follow-up nurture sequence
  7. Create workflow to enrol form submitters
  8. Create campaign dashboard
  9. Generate social post copy package (structured, for manual posting)
- Output: Full campaign link in HubSpot + status report in Inbox

**Social Post Package Agent** (content only, no publishing)
- Input: topic, platform(s), tone, any images/assets
- Process: Claude generates 3-5 post variants per platform → structured output with copy, hashtags, recommended posting time, image brief
- Output: Formatted doc in Inbox for Tusk to review + post

---

## Breeze Agent Tool Integration

### What this is

Muloo publishes a **HubSpot app** with registered Agent Tools. Once installed on a client's HubSpot portal, Breeze (HubSpot's AI assistant) gains new capabilities:

- "Run a Muloo portal audit"
- "Create a lead nurture workflow for new MQL contacts"
- "Build me a marketing dashboard"
- "Create a blog post about [topic]"

Breeze calls Muloo's API. Muloo executes the job. Results come back into Breeze's response.

This means:
- Tusk's clients can trigger Muloo work from inside their HubSpot portal without logging into any Muloo platform
- The Muloo app becomes a HubSpot marketplace product (future revenue channel)
- Every client who installs the app is a potential platform subscriber

### How to build it — technical steps

**Step 1: Create a HubSpot Developer App**
- Go to developers.hubspot.com → Create App
- Set `platformVersion: 2025.2` in `hsproject.json`
- Required OAuth scopes: `crm.objects.contacts.read`, `crm.schemas.contacts.write`, `automation`, `content`, `e-commerce`

**Step 2: Create Agent Tool definitions**
Each tool lives in `workflow-actions/` directory as a `*-hsmeta.json` file.

```json
// workflow-actions/portal-audit-hsmeta.json
{
  "name": "Muloo Portal Audit",
  "description": "Audits the connected HubSpot portal for configuration gaps, missing properties, inactive workflows, and reporting blind spots. Returns a prioritised list of improvements.",
  "actionUrl": "https://api.muloo.co/breeze/tools/portal-audit",
  "supportedClients": ["AGENTS"],
  "toolType": "TAKE_ACTION",
  "inputFields": [
    {
      "name": "focus_area",
      "label": "Focus area (optional)",
      "description": "Specific area to audit: properties, workflows, pipelines, dashboards, or all",
      "fieldType": "text",
      "required": false
    }
  ],
  "outputFields": [
    {
      "name": "audit_summary",
      "label": "Audit summary",
      "fieldType": "text"
    },
    {
      "name": "quick_wins",
      "label": "Quick wins",
      "fieldType": "text"
    }
  ]
}
```

**Step 3: Build the Muloo API endpoints Breeze calls**

Create a new route group in `apps/api/src/app.ts`: `POST /breeze/tools/:toolName`

Each endpoint:
1. Validates the request is from HubSpot (signature verification)
2. Extracts portal ID from the HubSpot context
3. Queues the appropriate ExecutionJob
4. Waits for result (or returns a "job queued, check back" response)
5. Returns structured output to Breeze

```typescript
// apps/api/src/routes/breeze-tools.ts

router.post('/breeze/tools/portal-audit', async (req, res) => {
  const { portalId, inputFields } = req.body; // HubSpot sends this

  // Queue audit job
  const job = await queueJob('portal_audit', {
    portalId,
    focusArea: inputFields.focus_area || 'all',
    source: 'breeze'
  });

  // Wait up to 30s for result (Breeze has a timeout)
  const result = await waitForJobResult(job.id, 30_000);

  return res.json({
    outputFields: {
      audit_summary: result.summary,
      quick_wins: result.quickWins.slice(0, 5).join('\n')
    }
  });
});
```

**Step 4: Tools to expose via Breeze (phase 1)**

| Tool name | What it does | API complexity |
|---|---|---|
| `portal_audit` | Full portal health check | Medium — uses existing audit agent |
| `create_property_set` | Creates a standard property set (lead source, lifecycle dates, etc.) | Low — uses existing property builder |
| `build_marketing_dashboard` | Creates a marketing performance dashboard | Low — uses existing dashboard agent |
| `create_blog_post` | Drafts and creates a blog post in HubSpot CMS | Low — new, but simple CMS API call |
| `create_email` | Creates a marketing email draft | Low — marketing email API |
| `create_workflow` | Builds a workflow from description | High — workflow builder agent |

**Step 5: HubSpot App listing**
Once the tools are working internally:
- Submit Muloo app to HubSpot App Marketplace
- Listing: "Muloo AI Delivery — AI-powered HubSpot implementation and marketing execution"
- Free install, subscription required for usage (via Muloo platform)

---

## Platform access tiers

| Tier | Who | Access | Price |
|---|---|---|---|
| Internal | Muloo team (Jarrud) | Full platform — all agents, all projects, all portals | Internal |
| Partner | Tusk (and future partners) | Partner dashboard — their clients only, marketing job types, Inbox | Monthly SaaS fee |
| Client (future) | Tusk's clients / Muloo's clients | Client-facing delivery board, approval flows, status updates | Included in partner fee or direct |
| Breeze App | Any HubSpot portal | 6 core Breeze tools callable from inside HubSpot | Pay-per-use or subscription via HubSpot marketplace |

---

## Sprint plan

### Sprint 08 — HubSpot Write Client + Core Agents (Hawk builds)
*Spec: see agent-capability-roadmap.md Sprint 08 section*

- `packages/hubspot-client/` — HubSpotWriteClient with private app token
- Complete Portal Audit Agent processor
- Complete Property Builder Agent processor
- Complete Dashboard Build Agent processor
- Add `privateAppToken` to PortalSession schema

### Sprint 09 — Marketing Agent Pack (Hawk builds)
*New agents specifically for Tusk / Partner use*

- `processors/blogPostCreate.ts` — generate + create HubSpot blog draft
- `processors/emailCampaignCreate.ts` — generate + create marketing email
- `processors/nurturSequenceCreate.ts` — generate email sequence + automation workflow
- `processors/socialPostPackage.ts` — generate structured social content package (copy only)
- `processors/leadGenCampaignBuild.ts` — orchestrates multiple agents to build a full campaign
- New job types registered in `jobRouter.ts`
- New API endpoints: `POST /api/marketing-jobs` (takes brief + type + projectId, queues the right jobs)

### Sprint 10 — Partner Platform UI (Hawk builds)

- Multi-tenant auth: `workspace` concept — internal Muloo workspace vs. Tusk workspace
- `WorkspaceRole` model in Prisma: `OWNER`, `PARTNER`, `CLIENT`
- Partner dashboard: `/partner` route — scoped to their clients only
- Job submission form: select client → select job type → fill brief → submit
- Partner Inbox: review AI-generated content drafts, approve or request changes
- Approval flow: `approved` triggers publish job, `changes_requested` sends back to agent with notes

### Sprint 11 — Breeze Agent Tools (Hawk builds)

- Create HubSpot developer app (`apps/hubspot-app/`)
- Register 4 initial agent tools: `portal_audit`, `create_property_set`, `build_marketing_dashboard`, `create_blog_post`
- New route group in API: `POST /breeze/tools/:toolName`
- HubSpot request signature verification middleware
- Portal authentication via HubSpot OAuth context (app install provides portal token)
- Deploy and test using HubSpot's Developer Tool Testing Agent in Breeze Marketplace

---

## What to do this week

1. **Hawk**: Sprint 07 UX redesign (already specced — do this first)
2. **Jarrud**: Set up a HubSpot private app token for epiuse (test portal) — this unlocks Sprint 08
3. **Jarrud**: Confirm with Tusk what their first use case would be (blog posts? email campaign? full lead gen campaign?) — this sets the order in Sprint 09
4. **Me (next session)**: Write the full Codex prompts for Sprint 08, 09, 10, 11 and append to `codex-handoff-all-sprints.md`

---

## The commercial picture when all four sprints land

```
Tusk submits brief in Partner Platform
  → DeployOS agents build it in HubSpot
    → Tusk reviews in their Inbox
      → Published in client portal

Client opens HubSpot, asks Breeze:
"Run a Muloo audit on our portal"
  → Breeze calls Muloo API
    → Audit agent runs
      → Results surface in Breeze chat
        → Client sees the gaps, requests fixes
          → Muloo (via Tusk) delivers them
```

That's a full loop. Marketing delivery + technical execution + client visibility, all connected. Muloo is invisible infrastructure running the whole thing.

---

*Last updated: 26 Mar 2026*
