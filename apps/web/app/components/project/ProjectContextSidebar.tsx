"use client";

function SidebarSection(props: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
        {props.label}
      </p>
      <div className="text-sm text-zinc-200">{props.children}</div>
    </section>
  );
}

export default function ProjectContextSidebar(props: {
  clientName: string;
  clientContactEmail?: string | null;
  portalUrl?: string | null;
  hubTier?: string | null;
  connectionReady: boolean;
  contactsCount?: number | null;
  dealsCount?: number | null;
  propertiesCount?: number | null;
  customObjectsCount?: number | null;
  ownerName: string;
  ownerEmail: string;
  hubsInScope: string[];
  platformName?: string | null;
  platformDescription?: string | null;
  quickWins: {
    total: number;
    open: number;
    resolved: number;
  };
  onRefreshSnapshot: () => void;
  refreshingSnapshot?: boolean;
}) {
  return (
    <aside className="sticky top-0 max-h-screen space-y-4 overflow-y-auto rounded-lg bg-zinc-800 p-4">
      <SidebarSection label="CLIENT">
        <p className="font-medium text-white">{props.clientName}</p>
        <p className="mt-1 text-zinc-400">
          {props.clientContactEmail ?? "No contact email linked"}
        </p>
      </SidebarSection>

      <SidebarSection label="PORTAL">
        <p className="font-medium text-white">
          {props.portalUrl ? (
            <a href={props.portalUrl} target="_blank" rel="noreferrer" className="hover:text-white">
              {props.portalUrl}
            </a>
          ) : (
            "No portal linked"
          )}
        </p>
        <p className="mt-1 flex items-center gap-2 text-zinc-400">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              props.connectionReady ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
          {props.connectionReady ? "Connected" : "Disconnected"}
          {props.hubTier ? ` · ${props.hubTier}` : ""}
        </p>
      </SidebarSection>

      <SidebarSection label="SNAPSHOT">
        <div className="grid gap-2 text-zinc-400">
          <p>Contacts: {props.contactsCount ?? "—"}</p>
          <p>Deals: {props.dealsCount ?? "—"}</p>
          <p>Properties: {props.propertiesCount ?? "—"}</p>
          <p>Custom objects: {props.customObjectsCount ?? "—"}</p>
        </div>
      </SidebarSection>

      <SidebarSection label="OWNER">
        <p className="font-medium text-white">{props.ownerName}</p>
        <p className="mt-1 text-zinc-400">{props.ownerEmail}</p>
      </SidebarSection>

      <SidebarSection label="HUBS IN SCOPE">
        <div className="flex flex-wrap gap-2">
          {props.hubsInScope.length > 0 ? (
            props.hubsInScope.map((hub) => (
              <span
                key={hub}
                className="rounded-full bg-zinc-700 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-zinc-200"
              >
                {hub}
              </span>
            ))
          ) : (
            <p className="text-zinc-400">No hubs selected</p>
          )}
        </div>
      </SidebarSection>

      <SidebarSection label="PLATFORM">
        <p className="font-medium text-white">
          {props.platformName ?? "No platform selected"}
        </p>
        {props.platformDescription ? (
          <p className="mt-1 text-zinc-400">{props.platformDescription}</p>
        ) : null}
      </SidebarSection>

      <SidebarSection label="QUICK WINS">
        <p className="text-zinc-400">
          {props.quickWins.total} total · {props.quickWins.open} open ·{" "}
          {props.quickWins.resolved} resolved
        </p>
      </SidebarSection>

      <button
        type="button"
        onClick={props.onRefreshSnapshot}
        disabled={props.refreshingSnapshot}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
      >
        {props.refreshingSnapshot ? "Refreshing..." : "Refresh Snapshot"}
      </button>
    </aside>
  );
}
