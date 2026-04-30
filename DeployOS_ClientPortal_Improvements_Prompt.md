# DeployOS — Client Portal Improvements (Codex Prompt)

> **Codex role:** Product engineer with a sharp eye for client-facing trust signals. The portal already feels premium. Your job is to push it from "premium static surface" to "live operating window into the engagement" so clients stop emailing for status updates.

## Why this matters

Comparators: HubSpot's CMS-driven client portal, Proposify's client-facing approval surface, PandaDoc's signed-document tracking, Monday.com guest views. The shape DeployOS should land at: every client owns a single shareable URL that's their always-on view of the project. Approvals are unmissable. Communication is logged in one place.

## Out of scope

- Quote rendering / approval — already covered in `DeployOS_QuoteFlow_Unification_Prompt.md`.
- Milestones (rendered for clients but the build is in `DeployOS_ProjectFlow_Improvements_Prompt.md`).
- Email infrastructure for outbound notifications — flag dependency, build under Production Hardening.

---

## Improvement 1 — Shareable client status page (no-login URL)

**Comparator:** Proposify's "View as client" public links, DocSend's tracked URLs, Linear's public project pages.

**Problem:** Today, clients log in via `ClientPortalUser` to see status. That's a friction point for the business sponsor who doesn't want to manage another login. They want a link they can email up to a CFO.

### Schema

```prisma
model ProjectShareLink {
  id              String    @id @default(cuid())
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  token           String    @unique  // 32-char url-safe random
  createdAt       DateTime  @default(now())
  createdById     String
  expiresAt       DateTime?
  passwordHash    String?
  scope           String    @default("status")  // "status" | "delivery" | "full"
  revokedAt       DateTime?
  lastViewedAt    DateTime?
  viewCount       Int       @default(0)

  @@index([projectId])
  @@index([token])
}
```

### Backend

- `POST /api/projects/:projectId/share-links` — body: `{ scope, expiresAt?, password? }`.
- `DELETE /api/projects/:projectId/share-links/:id` — revoke (sets `revokedAt`).
- `GET /share/:token` (public, no auth) — renders `ClientStatusView` with the project data filtered by scope.

### UI

**Operator side:** Project page right sidebar gets "Share status" button. Modal: scope picker (Status snapshot only / Delivery view / Full portal), expiry picker (7d / 30d / never), optional password. After creating, copy-to-clipboard link.

**Client side (public):** `/share/[token]` route uses `PublicShell` (build it — like ClientShell but with no nav, no inbox, just header with Muloo branding + project title). Shows:
- Project name, client name, status pill
- Milestones strip (if Milestones improvement is shipped)
- Currently working on / Progress / Waiting on — same tiles as the logged-in portal
- Pending approvals (linked to actual approval URLs, password-protected with the same token)
- Last 5 visible activity events

Every view increments `viewCount` and updates `lastViewedAt`.

### Acceptance

- Operator creates a link, opens incognito, sees the status page without login.
- Revoking the link returns 410 on next view.
- Operator side shows "Last viewed 2h ago · 4 views" on each share-link row.

---

## Improvement 2 — Surfacing pending approvals

**Problem:** Clients don't always notice when something needs them. Currently approval signals scatter across messages, emails, and the quote portal.

### Approach

- New unified surface at `/client/approvals` (and the public-share equivalent).
- Aggregates **anything pending the client's action** across the platform:
  - Quotes in `Sent` status
  - `TaskApproval` records awaiting client sign-off
  - Findings/recommendations flagged for client review
  - Milestones marked client-visible needing acknowledgement
- Each row: title, project, type icon, age (days since requested), CTA button taking the client to the right surface.

### Schema

No new model. Build `loadClientApprovalQueue(clientPortalUserId | shareLinkScope)` that unions the existing tables and returns a normalised shape:

```ts
type ClientApproval = {
  id: string;
  type: "quote" | "task" | "finding" | "milestone";
  projectId: string;
  projectName: string;
  title: string;
  requestedAt: Date;
  requestedById: string;
  ctaUrl: string;
};
```

### UI

- **ClientShell:** add Approvals tab between Inbox and Support. Badge with count.
- **Public-share with `scope=status` or higher:** show the approvals strip on the status page.
- **Email digest:** when a new approval is created, send the client a notification email if their `ClientPortalUser.notificationsOptIn = true`. (Fall back: if no opt-in field exists yet, add it with default `true`.) Use existing email infra; if Nodemailer isn't wired in production, flag and stub for now.

### Acceptance

- Approvals tab counts match the union query result.
- Approving an item from the approvals list removes it from the list and writes an `AuditLog`.
- A client with three pending approvals sees three rows with sensible age labels ("3 days", "2 weeks").

---

## Improvement 3 — Comms log per project (unified communication timeline)

**Problem:** Communication trickles through `ProjectMessage`, manual emails, support tickets, agent execution outputs and runtime notes. There's no single timeline.

**Comparator:** HubSpot deal timeline (engagements section), Front's conversation timeline. The HubSpot model is the fit.

### Schema

`AuditLog` is the underlying store (it should already capture client-visible events from `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 4). Add a Communication category:

- `ProjectMessage` events (sent / received)
- Email events from outbound deliveries (quote sent, milestone notification, etc.) — write `AuditLog` rows with `entityType: "Email"`, `payload: { subject, recipient, deliveryStatus }`.
- Inbound email replies if email parsing is later wired.
- Support ticket events.

### UI

- **Operator side:** Project → Comms tab. Reverse chronological. Filter chips: All / Sent / Received / System / Approvals.
- **Client side:** Inbox tab (existing) gets a "Conversations" view showing the same timeline filtered to client-visible items.
- Each item is expandable: subject + body preview + delivery status + actor.

### Acceptance

- A real client message → operator reply → quote-sent email → quote-approved click all show up in the comms timeline in the right order with the right actor labels.
- A delivery failure (bounced email) shows a red marker.

---

## Improvement 4 — Email delivery of quotes (with tracking)

**Comparator:** PandaDoc's "Send via email" with read receipts, Proposify's tracked send.

**Why here, not in Quote Unification:** This is client-facing experience polish, not architectural unification.

### Implementation

1. New endpoint `POST /api/quotes/:quoteId/send` — body `{ to: string[], cc?: string[], message?: string }`.
2. Server composes:
   - Subject: `Quote #{quote.reference} from Muloo for {client.name}`
   - Body: short message (use `message` if provided, else default copy with quote total + valid-until date) + portal link (`/client/quotes/:id` or share-link).
3. Sends via existing Nodemailer / Workspace SMTP setup (`WorkspaceEmailSettings` model exists).
4. On send: `quote.status` transitions Draft → Sent (or stays Sent on resend), writes `AuditLog`, increments `sendCount`.
5. Tracks opens via a 1×1 pixel `/track/quote/:id/open` returning a transparent gif. Optional but useful for the UI.

### UI

- Quote detail toolbar: "Send via email" button (primary CTA when status is Draft).
- Send modal: recipient picker (default to client primary contact, autocomplete from `ClientContact` records), cc, custom message.
- After send: quote detail shows "Sent to tara@magnisol.com · 3 days ago · Opened 12 minutes ago" — open count tracked.

### Acceptance

- Sending a quote moves it to Sent, lands in the recipient inbox, comms log captures it.
- Opening the email pixel updates the operator UI within ~5s.

---

## Improvement 5 — Client portal navigation polish

The portal nav (Projects / Inbox / Support / Request Work) is good. Three small upgrades:

1. **Approvals badge** in the nav (from Improvement 2).
2. **Project switcher** in the header for clients with multiple projects — most don't, but the few who do get pushed to the projects list each time. Replace with a header dropdown.
3. **Search across all projects in the portal** — single Cmd+K palette like Linear. Searches messages, files, milestones, approvals across every project the client has access to via `ClientProjectAccess`.

### Acceptance

- Client with 3 projects can switch between them in 2 clicks max.
- Cmd+K returns results across messages, milestones, files, approvals within 200ms for a portfolio of 10 projects.

---

## Improvement 6 — Portal auto-inherit (cross-link with Project Flow)

This already lives in `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 5. The client-facing side: when a new project for an existing client launches, the client portal user already has access to the prior project's portal — they should land in the new project's portal automatically without needing a new invite.

**Implementation note:** On project creation, if `Client.id` already has a `ClientPortalUser`, auto-create a `ClientProjectAccess` row linking that user to the new project. Send a "New project added to your Muloo portal" notification email.

### Acceptance

- Creating a second project for Magnisol surfaces it in tara@magnisol.com's portal without operator intervention.

---

## Sequencing

1. **Comms log** (foundation — depends on Activity Log from Project Flow).
2. **Approvals surface** (high client-visible value, builds on schema already in place).
3. **Email delivery of quotes** (depends on email infra check).
4. **Shareable status page** (new schema + public route — slightly bigger).
5. **Portal nav polish** (small, can ship anytime).
6. **Portal auto-inherit** (small, ship with project flow improvements).

## Final acceptance gate

A client invited today should:
- See a single Approvals tab listing everything that needs them.
- Receive a tracked email when a quote is sent, click through to a polished portal view, approve in one click.
- Have a shareable status URL their CFO can open without login.
- See every project they're entitled to without a fresh invite per project.
