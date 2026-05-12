"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ProjectWorkspaceView from "../../../components/ProjectWorkspaceView";
import ProjectMeetingsPanel from "../../../components/project/panels/ProjectMeetingsPanel";
import { Btn } from "../../../components/ui/Btn";
import { PageHead } from "../../../components/ui/PageHead";

interface ProjectSummary {
  id: string;
  name: string;
  client?: { name?: string };
  deliveryWorkstreams?: Array<{ id: string; name: string }>;
}

export default function ProjectMeetingsPage({
  params
}: {
  params: { id: string };
}) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const r = await fetch(`/api/projects/${encodeURIComponent(params.id)}`);
        if (!r.ok) return;
        const body = await r.json();
        if (cancelled) return;
        setProject((body?.project ?? body) as ProjectSummary);
      } catch {
        // ignore
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <ProjectWorkspaceView projectId={params.id} activeTab="comms">
      <div className="space-y-6">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${params.id}`}
              className="hover:text-text-1 transition-colors"
            >
              ← {project?.name ?? "Project workspace"}
            </Link>
          }
          title="Meeting notes & summaries"
          lede="Capture meeting outcomes, attendees, and AI-extracted actions/decisions/risks against this project."
          actions={
            <Btn variant="primary" size="md" onClick={() => setModalOpen(true)}>
              + Add meeting note
            </Btn>
          }
        />
        <ProjectMeetingsPanel
          projectId={params.id}
          workstreams={project?.deliveryWorkstreams ?? []}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
        />
      </div>
    </ProjectWorkspaceView>
  );
}
