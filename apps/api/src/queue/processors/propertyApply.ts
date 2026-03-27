import { Prisma } from "@prisma/client";
import {
  HubSpotWriteClient,
  type HSProperty,
  type HSPropertySpec
} from "@muloo/hubspot-client";
import type { CoworkInstruction } from "@muloo/shared";
import { prisma } from "../../prisma";
import { JobPayload, JobResult } from "../jobRouter";

interface PropertyDiffEntry {
  objectType: string;
  name: string;
}

interface PropertyFailureEntry extends PropertyDiffEntry {
  error: string;
}

interface PropertyApplyOutput {
  status: "complete" | "partial" | "queued_for_cowork";
  summary: string;
  created?: PropertyDiffEntry[];
  updated?: PropertyDiffEntry[];
  skipped?: PropertyDiffEntry[];
  failed?: PropertyFailureEntry[];
  executionTier?: 2 | 3;
  coworkInstruction?: CoworkInstruction;
}

function buildCoworkInstruction(portalId: string): CoworkInstruction {
  return {
    id: `cowork-property-apply-${portalId}-${Date.now()}`,
    taskType: "hubspot_property_create",
    portalId,
    targetUrl: `https://app-eu1.hubspot.com/settings/${encodeURIComponent(portalId)}/properties`,
    steps: [
      {
        order: 1,
        action: "verify",
        target: "Portal Ops private app token",
        description: "Confirm a private app token has been saved for this portal."
      },
      {
        order: 2,
        action: "navigate",
        target: "HubSpot properties settings",
        description: "Open the properties area if manual follow-up is needed."
      }
    ],
    expectedOutcome:
      "Property apply job can be retried once the private app token is configured.",
    fallbackToManual: []
  };
}

function normalizeOptions(options?: HSProperty["options"] | HSPropertySpec["options"]) {
  return (options ?? [])
    .map((option) => `${option.label}:${option.value}`)
    .sort()
    .join("|");
}

function propertyMatchesSpec(existing: HSProperty, spec: HSPropertySpec) {
  return (
    existing.label === spec.label &&
    existing.type === spec.type &&
    existing.fieldType === spec.fieldType &&
    (existing.groupName ?? "") === (spec.groupName ?? "") &&
    normalizeOptions(existing.options) === normalizeOptions(spec.options)
  );
}

export async function runPropertyApply(data: JobPayload): Promise<JobResult> {
  if (!data.portalId) {
    throw new Error("portalId required for property_apply");
  }

  const rawProperties = Array.isArray(data.payload?.properties)
    ? (data.payload?.properties as HSPropertySpec[])
    : [];

  if (rawProperties.length === 0) {
    throw new Error("properties array is required for property_apply");
  }

  const [portalSession, hubspotPortal] = await Promise.all([
    prisma.portalSession.findFirst({
      where: { portalId: data.portalId, valid: true },
      orderBy: { capturedAt: "desc" }
    }),
    prisma.hubSpotPortal.findFirst({
      where: { portalId: data.portalId }
    })
  ]);

  // Use private app token if set, otherwise fall back to OAuth access token.
  // The OAuth connection already includes crm.schemas.*.write scopes.
  const resolvedToken =
    portalSession?.privateAppToken?.trim() ||
    hubspotPortal?.accessToken?.trim();

  if (!resolvedToken) {
    const output: PropertyApplyOutput = {
      status: "queued_for_cowork",
      summary: "No HubSpot token available. Reconnect the portal in Settings → Providers.",
      executionTier: 3,
      coworkInstruction: buildCoworkInstruction(data.portalId)
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

  const client = new HubSpotWriteClient({
    portalId: data.portalId,
    privateAppToken: resolvedToken
  });

  const created: PropertyDiffEntry[] = [];
  const updated: PropertyDiffEntry[] = [];
  const skipped: PropertyDiffEntry[] = [];
  const failed: PropertyFailureEntry[] = [];

  for (const property of rawProperties) {
    const objectType =
      typeof (property as unknown as Record<string, unknown>).objectType === "string"
        ? String((property as unknown as Record<string, unknown>).objectType)
        : "contacts";

    const entry = { objectType, name: property.name };

    try {
      const existing = await client.getProperty(objectType, property.name);

      if (!existing) {
        await client.createProperty(objectType, property);
        created.push(entry);
        continue;
      }

      if (propertyMatchesSpec(existing, property)) {
        skipped.push(entry);
        continue;
      }

      await client.updateProperty(objectType, property.name, {
        label: property.label,
        type: property.type,
        fieldType: property.fieldType,
        ...(property.groupName ? { groupName: property.groupName } : {}),
        ...(property.options ? { options: property.options } : {})
      });
      updated.push(entry);
    } catch (error) {
      failed.push({
        ...entry,
        error: error instanceof Error ? error.message : "Unknown property apply error"
      });
    }
  }

  const output: PropertyApplyOutput = {
    status: failed.length > 0 ? "partial" : "complete",
    summary: `Property apply finished: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped, ${failed.length} failed.`,
    created,
    updated,
    skipped,
    failed,
    executionTier: 2
  };

  await prisma.executionJob.update({
    where: { id: data.executionJobId },
    data: {
      outputSummary: output.summary,
      executionTier: 2
    }
  });

  return {
    success: true,
    dryRun: data.dryRun ?? false,
    output
  };
}
