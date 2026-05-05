"use client";

interface ProjectChampionCardProps {
  championName: string | null;
  championEmail: string | null;
  championRole: string | null;
}

export default function ProjectChampionCard(props: ProjectChampionCardProps) {
  const hasChampion = Boolean(props.championName || props.championEmail);

  if (!hasChampion) {
    return (
      <div className="brand-surface-soft rounded-[14px] border border-dashed border-ink-4 p-4 text-center">
        <p className="text-sm font-medium text-white">No champion set yet</p>
        <p className="mt-1 text-xs text-text-2">
          Add a champion in the contributors list below by setting their role
          to <strong className="text-white">client_champion</strong>. The
          champion will see workbooks marked &quot;Client champion review&quot;
          in their portal.
        </p>
      </div>
    );
  }

  return (
    <div className="brand-surface-soft rounded-[14px] border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {props.championName ?? props.championEmail}
          </p>
          <p className="mt-0.5 text-xs text-text-2">
            {props.championEmail
              ? props.championEmail
              : "No email on record"}
            {props.championRole ? ` · ${props.championRole}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">
          Client champion
        </span>
      </div>
    </div>
  );
}
