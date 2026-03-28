"use client";

import ProjectOverview from "./ProjectOverview";

export default function ProjectWorkspaceLanding({
  projectId
}: {
  projectId: string;
}) {
  return <ProjectOverview projectId={projectId} />;
}
