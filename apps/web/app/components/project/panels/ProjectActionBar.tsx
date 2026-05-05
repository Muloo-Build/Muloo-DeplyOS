"use client";

import type { ReactNode } from "react";
import {
  CalendarPlus,
  ClipboardList,
  ExternalLink,
  Link2,
  Sparkles,
  UserPlus
} from "lucide-react";

type ActionBarProps = {
  projectId: string;
  busyClientPortal?: boolean;
  onAddMeeting: () => void;
  onCreateWorkbook: () => void;
  onAddContributor: () => void;
  onAddResource: () => void;
  onOpenClientPortal: () => void;
  onGenerateNextActions?: () => void;
};

export default function ProjectActionBar(props: ActionBarProps) {
  const actions: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    primary?: boolean;
    busy?: boolean;
    disabled?: boolean;
  }> = [
    {
      key: "meeting",
      label: "Add latest meeting",
      icon: <CalendarPlus size={16} />,
      onClick: props.onAddMeeting,
      primary: true
    },
    {
      key: "workbook",
      label: "Create workbook",
      icon: <ClipboardList size={16} />,
      onClick: props.onCreateWorkbook
    },
    {
      key: "contributor",
      label: "Add contributor",
      icon: <UserPlus size={16} />,
      onClick: props.onAddContributor
    },
    {
      key: "resource",
      label: "Add resource",
      icon: <Link2 size={16} />,
      onClick: props.onAddResource
    },
    {
      key: "portal",
      label: "Open client portal",
      icon: <ExternalLink size={16} />,
      onClick: props.onOpenClientPortal,
      busy: props.busyClientPortal
    },
    {
      key: "next-actions",
      label: "Generate next actions",
      icon: <Sparkles size={16} />,
      onClick: props.onGenerateNextActions ?? (() => {}),
      disabled: !props.onGenerateNextActions
    }
  ];

  return (
    <section
      aria-label="Project quick actions"
      className="brand-surface rounded-[14px] border border-ink-4 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-2">
          Next actions
        </p>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.busy || action.disabled}
            title={
              action.disabled ? "Coming soon" : undefined
            }
            className={
              action.primary
                ? "inline-flex items-center gap-2 rounded-xl bg-brand-teal px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                : "inline-flex items-center gap-2 rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
