import Link from "next/link";

import ProjectWorkspaceView from "../../../components/ProjectWorkspaceView";
import ProjectSkippyCommandPanel from "../../../components/project/panels/ProjectSkippyCommandPanel";
import { PageHead } from "../../../components/ui/PageHead";

export default function ProjectSkippyCommandPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ProjectWorkspaceView projectId={params.id} activeTab="command">
      <div className="space-y-6">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${params.id}`}
              className="hover:text-text-1 transition-colors"
            >
              ← Project workspace
            </Link>
          }
          title="Skippy command centre"
          lede="Project intelligence, Gemini meeting import, execution queue and approval guardrails in one operator surface."
        />
        <ProjectSkippyCommandPanel projectId={params.id} />
      </div>
    </ProjectWorkspaceView>
  );
}
