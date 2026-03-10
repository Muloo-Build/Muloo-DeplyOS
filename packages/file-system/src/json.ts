import fs from "node:fs/promises";
import path from "node:path";

import { onboardingSpecSchema, type DryRunArtifact, type OnboardingSpec, type SpecFile } from "@muloo/core";

export async function loadJsonFile(filePath: string): Promise<{ absolutePath: string; raw: unknown }> {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(absolutePath, "utf8");

  return {
    absolutePath,
    raw: JSON.parse(content) as unknown
  };
}

export async function loadValidatedOnboardingSpec(filePath: string): Promise<SpecFile<OnboardingSpec>> {
  const { absolutePath, raw } = await loadJsonFile(filePath);
  const spec = onboardingSpecSchema.parse(raw);

  return {
    absolutePath,
    raw,
    spec
  };
}

function createArtifactFileName(clientSlug: string, generatedAt: string): string {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  return `${timestamp}-${clientSlug}-contact-properties-dry-run.json`;
}

export async function writeJsonArtifact(params: {
  artifactDir: string;
  artifact: DryRunArtifact;
}): Promise<string> {
  await fs.mkdir(params.artifactDir, { recursive: true });

  const fileName = createArtifactFileName(params.artifact.client.slug, params.artifact.generatedAt);
  const artifactPath = path.join(params.artifactDir, fileName);

  await fs.writeFile(artifactPath, `${JSON.stringify(params.artifact, null, 2)}\n`, "utf8");
  return artifactPath;
}
