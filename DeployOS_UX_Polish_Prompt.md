# DeployOS — UX Polish (Codex Prompt)

> **Codex role:** Senior front-end engineer with a designer's instincts. The platform is functional. Your job is to push it from "functional" to "feels considered" — empty states, loading patterns, mobile, navigation consistency, form polish.

## Scope rules

- Visual language is set. Don't redesign brand colours, fonts or core component patterns. Tweak, don't rewrite.
- Tailwind v3 (post `DeployOS_BugFixes_Prompt.md` Bug 1 unification). Use existing brand tokens (`bg-background-primary`, brand gradient classes, the cyan accent `#7be2ef`/`rgba(73,205,225,...)`).
- Every change ships with at least one before/after screenshot in PR description.

## Out of scope

- New features. Anything that's a new capability lives in another prompt.
- Component-library swap. Keep the current stack.

---

## Polish 1 — Empty states (every list, every tab)

**Audit pass:** for every list view in `apps/web/app/`, check what renders when the underlying data is empty. Most hit "[]" or a faint "No data" string today.

**Pattern:** every empty state should have:
1. A relevant icon (lucide-react, 32px, half-opacity).
2. A one-line headline ("No quotes yet").
3. One sentence of context ("Quotes will show up here once you send your first one.").
4. A primary CTA where there's an obvious next action ("Create your first quote →" linking to `/quotes/new`).

**Reusable component:** `apps/web/app/components/EmptyState.tsx`

```tsx
type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
};
export default function EmptyState({ icon, title, description, cta }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-background-card px-8 py-14 text-center">
      <div className="opacity-50 mb-3">{icon}</div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-white/60 max-w-md">{description}</p>
      {cta && (
        <Link href={cta.href} className="mt-5 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
```

**List of surfaces to update (non-exhaustive — sweep `apps/web/app/`):**

- `/quotes` — no quotes
- `/projects` — no projects
- `/clients` — no clients
- `/retainers` — no retainers
- `/invoices` — no invoices
- `/runs` — no runs
- `/templates` — no templates
- `/inbox` — no items
- `/products` — no products
- Project Activity tab — no activity
- Project Messages tab — no messages
- Project Tasks (Delivery Board) — no tasks (with "Generate blueprint" CTA)
- Client portal Approvals tab — no pending approvals (positive-tone copy: "All caught up.")

### Acceptance
- Every list has an `EmptyState` when its data is empty.
- Copy is friendly, specific, and points to the next action.

---

## Polish 2 — Loading states

**Audit pass:** every page and major panel that fetches data should show a skeleton, not a flicker.

**Pattern:** Two skeleton primitives.

```tsx
// SkeletonRow — for list items
<div className="h-12 animate-pulse rounded-xl bg-white/5" />
// SkeletonBlock — for cards/panels
<div className="h-32 animate-pulse rounded-2xl bg-white/5" />
```

**Rules:**
- No spinners unless the action is < 500ms (button submit). For data fetches, skeletons.
- Skeletons should match the rough shape of the content (count of rows ≈ expected count).
- Fade in real content; no abrupt swap.

**Surfaces to update:** Command Centre tiles, projects list, quotes list, project landing right column (sidebar context), Delivery Board, Activity feed, client portal overview, retainer detail, invoice detail.

### Acceptance
- Every page that triggers a data fetch shows a content-shaped skeleton until data arrives.
- No layout shift when content lands.

---

## Polish 3 — Mobile responsiveness

**Audit:** the platform is desktop-first. Operators are mostly on desktop, but Jarrud on the road and clients on phones hit the portal frequently. Specifically:

- Sidebar collapses to a top-bar burger on `lg:` breakpoints (this is partially in place — verify and complete).
- Tables on mobile: convert to stacked card view.
- Modals: full-screen on mobile, never crop.
- Touch targets: minimum 44×44px.

**Priority surfaces:**
1. Client portal — every screen, mobile-first.
2. Command Centre — at least usable on tablet (operator on the road).
3. Quote detail (`/quotes/[id]` and `/client/quotes/[id]`) — mobile clean. Approve flow especially.
4. Project landing — secondary.

**Approach:** Sweep with a tester (Playwright or real device) at three viewports: 375px (phone), 768px (tablet), 1280px (desktop). Fix any layout that breaks.

### Acceptance
- Client portal is fully usable on a 375px viewport.
- Quote approval works on mobile with no horizontal scroll.
- Command Centre tiles wrap cleanly at 768px.

---

## Polish 4 — Navigation consistency

**Audit findings:**
- `ProjectWorkflowNav` and `Sidebar` use slightly different active-state styling.
- Some pages still have inline back-links instead of breadcrumbs.
- `ClientShell` and `AppShell` have visual drift in spacing.

**Fixes:**
1. **Active state contract:** active nav items use `bg-[rgba(73,205,225,0.12)] text-[#7be2ef] border-[rgba(73,205,225,0.28)]`. Apply consistently across `Sidebar`, `ProjectWorkflowNav`, `SettingsShell`, `ClientShell`.
2. **Breadcrumbs:** add a `Breadcrumb.tsx` component. Use on every page deeper than two clicks from root. Pattern: `Projects › Magnisol Phase 1 › Delivery`.
3. **Page title contract:** every page has an `<h1>` with the same scale (`text-2xl font-semibold`) and a one-line subtitle (`text-sm text-white/60`). Sweep and align.

### Acceptance
- A user navigating between three deep pages (`/projects/[id]/delivery`, `/quotes/[id]`, `/financials`) feels visual continuity.
- Breadcrumbs are present on every page deeper than `/section`.

---

## Polish 5 — Forms

**Issues:**
- Inputs have inconsistent border radii and padding across the app.
- Field-level errors don't always show.
- Submit buttons don't always show a busy state.
- Required indicators (`*`) are inconsistent.
- Long forms don't auto-save drafts.

**Fixes:**

1. **Component contract:** `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Checkbox.tsx`, `Switch.tsx` standardised in `apps/web/app/components/ui/`. Use them across the app. Sweep and replace ad-hoc inputs.
2. **Field error pattern:** label + input + helper text + error text. Helper text shows when no error; error replaces helper in the same slot.
3. **Required indicator:** small red dot beside the label, not an asterisk. Consistent.
4. **Busy buttons:** use a `<Button busy={...}>` pattern. Disable + spinner + label change ("Saving..."). Already implemented on the Mark Won button — propagate the pattern.
5. **Auto-save** for the wizard, the quote builder, and the Prepare workspace. Debounce 1.5s. Show "Saved · 3s ago" in the corner.

### Acceptance
- A side-by-side of three random forms (project wizard, quote builder, retainer log-hours) shows visual and behavioural consistency.
- Submitting any form shows a busy state, no double-submission possible.
- Closing and reopening the wizard mid-edit restores draft state.

---

## Polish 6 — Toast/notification system

**Current state:** ad-hoc inline messages, sometimes a banner, sometimes nothing.

**Pattern:** single toast provider. `react-hot-toast` is the easiest swap-in. Mount once in `AppShell` and `ClientShell`.

```tsx
import toast from "react-hot-toast";
toast.success("Quote sent to Magnisol");
toast.error("Couldn't reach HubSpot. Try again in a minute.");
```

**Rules:**
- Success toasts auto-dismiss in 3s.
- Error toasts persist until clicked. Include "View details" link to logs where relevant.
- Don't toast for navigation events (browser handles that).

### Acceptance
- Every mutating action that succeeds emits a toast.
- Errors come with friendly copy + actionable detail.

---

## Polish 7 — Inline help and tooltips

**Pattern:** every non-obvious field gets a small `(?)` info icon next to its label opening a tooltip on hover/focus.

**Examples:**
- "Engagement type" in the wizard.
- "Execution tier" on a Delivery Board task.
- "Rollover bucket" on retainer detail.

**Library:** Radix UI Tooltip (consistent with the codebase if already used) or a minimal custom one.

### Acceptance
- Tooltips don't shift layout.
- Keyboard-accessible (focus shows tooltip).

---

## Polish 8 — Dark mode polish

The app is dark-only by design. Sweep for accidental light-mode leakage:
- Form controls with default browser styling.
- PDF/print views needing light backgrounds (intentional — leave alone).
- Selection colour, focus ring colour.

### Acceptance
- A pixel-pass across 10 randomly selected pages shows no light-mode artefacts.

---

## Sequencing

1. **EmptyState component + sweep** (high visible value, low risk).
2. **Skeleton/loading sweep** (next-most-visible).
3. **Forms sweep** (component contract first, then auto-save).
4. **Toast system** (small infra, lots of small wins).
5. **Navigation polish** (breadcrumbs + active states).
6. **Mobile sweep** (most effortful, do last).
7. **Tooltips** (cross-cuts; can ship in slices).
8. **Dark-mode polish** (final pass).

## Final acceptance gate

Take screenshots of: Command Centre, /projects, /quotes, /quotes/[id], /retainers, /invoices, /financials, /client (portal home), /client/quotes/[id], /share/[token]. Compare against the pre-sweep set. Each should look and feel a step more considered.
