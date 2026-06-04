import Link from "next/link";
import { ClipboardCheck, FileText, ShieldCheck } from "lucide-react";

import ProjectWorkspaceView from "../../../components/ProjectWorkspaceView";

export default function ProjectApprovalsPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ProjectWorkspaceView projectId={params.id} activeTab="approvals">
      <div className="space-y-5">
        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-warning">
            Approval control
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Approvals</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-2">
            One place for decisions that need a human before Muloo or Skippy changes
            client-visible work, HubSpot configuration, scope, quotes, or delivery status.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href={`/projects/${params.id}/proposal`}
            className="rounded-[16px] border border-ink-4 bg-ink-2 p-5 transition hover:border-status-warning/60 hover:bg-white/[0.04]"
          >
            <FileText size={18} className="text-status-warning" />
            <h3 className="mt-3 text-sm font-semibold text-white">Proposal and scope</h3>
            <p className="mt-2 text-sm text-text-2">
              Review scoped work, commercial framing, and proposal evidence before approval.
            </p>
          </Link>

          <Link
            href={`/projects/${params.id}/audit`}
            className="rounded-[16px] border border-ink-4 bg-ink-2 p-5 transition hover:border-status-warning/60 hover:bg-white/[0.04]"
          >
            <ClipboardCheck size={18} className="text-status-warning" />
            <h3 className="mt-3 text-sm font-semibold text-white">Audit trail</h3>
            <p className="mt-2 text-sm text-text-2">
              Check the decisions, evidence, and history behind approval requests.
            </p>
          </Link>

          <Link
            href={`/projects/${params.id}/command`}
            className="rounded-[16px] border border-ink-4 bg-ink-2 p-5 transition hover:border-status-warning/60 hover:bg-white/[0.04]"
          >
            <ShieldCheck size={18} className="text-status-warning" />
            <h3 className="mt-3 text-sm font-semibold text-white">Skippy guardrails</h3>
            <p className="mt-2 text-sm text-text-2">
              See which actions are safe, blocked, or approval-gated before execution.
            </p>
          </Link>
        </div>
      </div>
    </ProjectWorkspaceView>
  );
}
