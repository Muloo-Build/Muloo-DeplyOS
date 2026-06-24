import { Prisma } from "@prisma/client";
import type { CoworkInstruction } from "@muloo/shared";
import { prisma } from "../../prisma";
import type { JobPayload, JobResult } from "../jobTypes";

interface MissingTokenOutput {
  status: "queued_for_cowork";
  summary: string;
  executionTier: 3;
  coworkInstruction: CoworkInstruction;
}

export async function handleMissingHubSpotToken(
  data: JobPayload,
  coworkInstruction: CoworkInstruction
): Promise<JobResult> {
  const output: MissingTokenOutput = {
    status: "queued_for_cowork",
    summary:
      "No HubSpot token available. Reconnect the portal in Settings → Providers.",
    executionTier: 3,
    coworkInstruction
  };

  await prisma.executionJob.update({
    where: { id: data.executionJobId },
    data: {
      outputSummary: output.summary,
      executionTier: 3,
      coworkInstruction: output.coworkInstruction as Prisma.InputJsonValue
    }
  });

  return {
    success: true,
    dryRun: data.dryRun ?? false,
    output
  };
}
