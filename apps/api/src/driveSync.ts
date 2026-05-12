/**
 * Per-project Google Drive folder sync.
 *
 * Lists files in the linked Drive folder via the Drive REST API (reusing the
 * workspace Google OAuth connection that already powers Gmail/Calendar), pulls
 * text from supported formats (PDF / DOCX / PPTX / Google Doc / Sheet / Slides),
 * and upserts one DiscoveryEvidence row per file
 * (kind=context, evidenceType=uploaded-doc).
 *
 * Realtime updates come from Drive's `changes.watch` push notifications
 * (see webhook handler in app.ts). The scheduler below is a fallback heartbeat
 * for projects whose channel expired or whose webhooks were missed.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { refreshGoogleWorkspaceEmailAccessTokenIfNeeded } from "./server";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const MAX_EXTRACTED_CHARS = 50_000;

const FOLDER_MIME = "application/vnd.google-apps.folder";

// Drive caps push-notification channels at 7 days; we request 7 days and the
// scheduler rotates anything within 24h of expiry.
const WATCH_CHANNEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WATCH_CHANNEL_RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;
const FALLBACK_SWEEP_INTERVAL_MS = 30 * 60 * 1000;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: string;
}

export interface DriveSyncResultDetail {
  name: string;
  reason: string;
}

export interface DriveSyncResult {
  added: number;
  updated: number;
  skipped: number;
  skippedDetails: DriveSyncResultDetail[];
  errors: string[];
}

/**
 * Accepts any of:
 *  - https://drive.google.com/drive/folders/<id>
 *  - https://drive.google.com/drive/u/0/folders/<id>?usp=sharing
 *  - <id> on its own (alphanumeric + _ + -)
 */
export function parseDriveFolderId(input: string): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const folderMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch?.[1]) {
    return folderMatch[1];
  }

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

async function getAccessToken(): Promise<string> {
  const connection = await refreshGoogleWorkspaceEmailAccessTokenIfNeeded();
  if (!connection?.accessToken) {
    throw new Error(
      "Google workspace connection is not authorized — connect Google in Settings and re-consent so drive.readonly is granted."
    );
  }
  return connection.accessToken;
}

async function driveFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {}
) {
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Drive API ${response.status} ${response.statusText}: ${body.slice(0, 200)}`
    );
  }

  return response;
}

export async function validateDriveFolder(
  folderId: string
): Promise<{ id: string; name: string }> {
  const accessToken = await getAccessToken();
  const response = await driveFetch(
    `/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
    accessToken
  );
  const body = (await response.json()) as {
    id: string;
    name: string;
    mimeType: string;
  };

  if (body.mimeType !== FOLDER_MIME) {
    throw new Error("Drive item is not a folder");
  }

  return { id: body.id, name: body.name };
}

async function listFolderFiles(
  folderId: string,
  accessToken: string
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields:
      "files(id,name,mimeType,modifiedTime,md5Checksum,size),nextPageToken",
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
  });

  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) {
      params.set("pageToken", pageToken);
    } else {
      params.delete("pageToken");
    }
    const response = await driveFetch(`/files?${params.toString()}`, accessToken);
    const body = (await response.json()) as {
      files: DriveFile[];
      nextPageToken?: string;
    };
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return files;
}

async function downloadBinary(
  fileId: string,
  accessToken: string
): Promise<Buffer> {
  const response = await driveFetch(
    `/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    accessToken
  );
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function exportGoogleFile(
  fileId: string,
  mimeType: string,
  accessToken: string
): Promise<string> {
  const response = await driveFetch(
    `/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(mimeType)}&supportsAllDrives=true`,
    accessToken
  );
  return response.text();
}

type ExtractResult = string | { skipReason: string } | null;

function loadOfficeParser():
  | ((buf: Buffer | string, config?: Record<string, unknown>) => Promise<string>)
  | null {
  // officeparser v6 publishes both a CJS named export and an ESM default
  // export. Some bundlers / Node versions surface only one; check both.
  const mod = require("officeparser") as {
    parseOfficeAsync?: (
      buf: Buffer | string,
      config?: Record<string, unknown>
    ) => Promise<string>;
    default?: {
      parseOfficeAsync?: (
        buf: Buffer | string,
        config?: Record<string, unknown>
      ) => Promise<string>;
    };
  };
  const fn = mod.parseOfficeAsync ?? mod.default?.parseOfficeAsync;
  return typeof fn === "function" ? fn : null;
}

async function extractText(
  file: DriveFile,
  accessToken: string
): Promise<ExtractResult> {
  switch (file.mimeType) {
    case "application/pdf": {
      const buffer = await downloadBinary(file.id, accessToken);
      try {
        // pdf-parse executes a debug fixture-load on bare import in some
        // environments — require the implementation module directly to avoid it.
        const pdfParse: (data: Buffer) => Promise<{ text: string }> =
          require("pdf-parse/lib/pdf-parse.js");
        const parsed = await pdfParse(buffer);
        return parsed.text ?? "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[drive-sync] pdf parse failed for ${file.id} ${file.name}: ${message}`
        );
        return { skipReason: `PDF parse failed: ${message}` };
      }
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const buffer = await downloadBinary(file.id, accessToken);
      try {
        const mammoth = require("mammoth") as {
          extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
        };
        const parsed = await mammoth.extractRawText({ buffer });
        return parsed.value ?? "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[drive-sync] docx parse failed for ${file.id} ${file.name}: ${message}`
        );
        return { skipReason: `DOCX parse failed: ${message}` };
      }
    }
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      const buffer = await downloadBinary(file.id, accessToken);
      const parseOfficeAsync = loadOfficeParser();
      if (!parseOfficeAsync) {
        return {
          skipReason:
            "officeparser exported no parseOfficeAsync — install/upgrade may be needed"
        };
      }
      try {
        const text = await parseOfficeAsync(buffer);
        return text ?? "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[drive-sync] pptx parse failed for ${file.id} ${file.name}: ${message}`
        );
        return { skipReason: `PPTX parse failed: ${message}` };
      }
    }
    case "application/vnd.google-apps.document":
      return exportGoogleFile(file.id, "text/plain", accessToken);
    case "application/vnd.google-apps.spreadsheet":
      return exportGoogleFile(file.id, "text/csv", accessToken);
    case "application/vnd.google-apps.presentation":
      return exportGoogleFile(file.id, "text/plain", accessToken);
    case "text/plain":
    case "text/csv":
    case "text/markdown": {
      const buffer = await downloadBinary(file.id, accessToken);
      return buffer.toString("utf8");
    }
    default:
      return null;
  }
}

function fileViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function getPublicBaseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com"
  );
}

interface WatchChannelRegistration {
  channelId: string;
  resourceId: string;
  startPageToken: string;
  expiresAt: Date;
}

async function fetchStartPageToken(accessToken: string): Promise<string> {
  const response = await driveFetch(
    "/changes/startPageToken?supportsAllDrives=true",
    accessToken
  );
  const body = (await response.json()) as { startPageToken: string };
  if (!body.startPageToken) {
    throw new Error("Drive changes.startPageToken returned no token");
  }
  return body.startPageToken;
}

async function registerWatchChannel(
  projectId: string,
  accessToken: string
): Promise<WatchChannelRegistration> {
  const startPageToken = await fetchStartPageToken(accessToken);
  const channelId = randomUUID();
  const expiresAt = new Date(Date.now() + WATCH_CHANNEL_TTL_MS);

  const response = await driveFetch(
    `/changes/watch?pageToken=${encodeURIComponent(
      startPageToken
    )}&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        // The project id round-trips back to us via x-goog-channel-token so the
        // webhook handler can locate the project without an extra DB lookup.
        token: projectId,
        address: `${getPublicBaseUrl()}/api/integrations/google-drive/webhook`,
        expiration: expiresAt.getTime().toString()
      })
    }
  );

  const body = (await response.json()) as {
    id: string;
    resourceId: string;
    expiration?: string;
  };

  if (!body.resourceId) {
    throw new Error("Drive changes.watch response missing resourceId");
  }

  return {
    channelId: body.id ?? channelId,
    resourceId: body.resourceId,
    startPageToken,
    expiresAt: body.expiration
      ? new Date(Number(body.expiration))
      : expiresAt
  };
}

async function stopWatchChannel(
  channelId: string,
  resourceId: string,
  accessToken: string
): Promise<void> {
  await driveFetch("/channels/stop", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, resourceId })
  });
}

async function tryStopExistingChannel(
  channelId: string | null | undefined,
  resourceId: string | null | undefined
): Promise<void> {
  if (!channelId || !resourceId) return;
  try {
    const accessToken = await getAccessToken();
    await stopWatchChannel(channelId, resourceId, accessToken);
  } catch (error) {
    // Channels that have already expired return 404 — log and move on so we
    // never block link/unlink on a stale watch.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[drive-sync] stop channel ${channelId} failed: ${message}`);
  }
}

/**
 * Per-file fold of the sync loop. Reused by the folder-wide sync and by the
 * webhook handler (which only knows about one changed file at a time).
 */
async function applyDriveFileToProject(
  projectId: string,
  file: DriveFile,
  accessToken: string,
  result: DriveSyncResult
) {
  const sourceUrl = fileViewUrl(file.id);
  try {
    const existing = await prisma.discoveryEvidence.findFirst({
      where: { projectId, sourceUrl }
    });

    const fileModifiedAt = file.modifiedTime
      ? new Date(file.modifiedTime)
      : null;

    if (existing && fileModifiedAt && existing.updatedAt >= fileModifiedAt) {
      result.skipped += 1;
      result.skippedDetails.push({
        name: file.name,
        reason: "Already up-to-date"
      });
      return;
    }

    const extracted = await extractText(file, accessToken);
    if (extracted === null) {
      result.skipped += 1;
      result.skippedDetails.push({
        name: file.name,
        reason: `Unsupported file type: ${file.mimeType}`
      });
      return;
    }
    if (typeof extracted !== "string") {
      result.skipped += 1;
      result.skippedDetails.push({
        name: file.name,
        reason: extracted.skipReason
      });
      return;
    }

    const truncated = extracted.slice(0, MAX_EXTRACTED_CHARS);

    if (existing) {
      await prisma.discoveryEvidence.update({
        where: { id: existing.id },
        data: {
          sourceLabel: file.name,
          content: truncated,
          evidenceType: "uploaded-doc",
          kind: "context",
          resourceType: "drive_file",
          status: "linked"
        }
      });
      result.updated += 1;
    } else {
      await prisma.discoveryEvidence.create({
        data: {
          projectId,
          sessionNumber: 0,
          evidenceType: "uploaded-doc",
          sourceLabel: file.name,
          sourceUrl,
          content: truncated,
          kind: "context",
          resourceType: "drive_file",
          status: "linked"
        }
      });
      result.added += 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`${file.name}: ${message}`);
    console.warn(
      `[drive-sync] ${projectId} ${file.id} ${file.name}: ${message}`
    );
  }
}

async function removeDriveFileFromProject(projectId: string, fileId: string) {
  const sourceUrl = fileViewUrl(fileId);
  await prisma.discoveryEvidence.deleteMany({
    where: { projectId, sourceUrl, resourceType: "drive_file" }
  });
}

export async function linkProjectDriveFolder(
  projectId: string,
  folderUrl: string
) {
  const folderId = parseDriveFolderId(folderUrl);
  if (!folderId) {
    throw new Error(
      "folderUrl must be a Drive folder URL or folder ID (alphanumeric, _ and -)"
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      googleDriveChannelId: true,
      googleDriveResourceId: true
    }
  });
  if (!project) {
    throw new Error("Project not found");
  }

  // Surfaces a clear error if scope/auth is missing or the folder is not accessible.
  await validateDriveFolder(folderId);

  // Replace any existing watch — link() is also used to swap folders.
  await tryStopExistingChannel(
    project.googleDriveChannelId,
    project.googleDriveResourceId
  );

  let registration: WatchChannelRegistration | null = null;
  try {
    const accessToken = await getAccessToken();
    registration = await registerWatchChannel(projectId, accessToken);
  } catch (error) {
    // Push channels can fail for local dev (no public URL) — fall back to the
    // poll-only path rather than blocking the link entirely.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[drive-sync] watch channel setup failed for ${projectId}: ${message}`
    );
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      googleDriveFolderId: folderId,
      googleDriveFolderUrl: folderUrl.trim(),
      googleDriveLastSyncedAt: null,
      googleDriveChannelId: registration?.channelId ?? null,
      googleDriveResourceId: registration?.resourceId ?? null,
      googleDriveStartPageToken: registration?.startPageToken ?? null,
      googleDriveChannelExpiresAt: registration?.expiresAt ?? null
    },
    select: {
      id: true,
      googleDriveFolderId: true,
      googleDriveFolderUrl: true,
      googleDriveLastSyncedAt: true,
      googleDriveChannelExpiresAt: true
    }
  });

  return {
    id: updated.id,
    googleDriveFolderId: updated.googleDriveFolderId,
    googleDriveFolderUrl: updated.googleDriveFolderUrl,
    googleDriveLastSyncedAt:
      updated.googleDriveLastSyncedAt?.toISOString() ?? null,
    googleDriveChannelExpiresAt:
      updated.googleDriveChannelExpiresAt?.toISOString() ?? null
  };
}

export async function clearProjectDriveFolder(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      googleDriveChannelId: true,
      googleDriveResourceId: true
    }
  });
  if (!project) {
    throw new Error("Project not found");
  }

  await tryStopExistingChannel(
    project.googleDriveChannelId,
    project.googleDriveResourceId
  );

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      googleDriveFolderId: null,
      googleDriveFolderUrl: null,
      googleDriveLastSyncedAt: null,
      googleDriveChannelId: null,
      googleDriveResourceId: null,
      googleDriveStartPageToken: null,
      googleDriveChannelExpiresAt: null
    },
    select: {
      id: true,
      googleDriveFolderId: true,
      googleDriveFolderUrl: true,
      googleDriveLastSyncedAt: true
    }
  });

  return {
    id: updated.id,
    googleDriveFolderId: updated.googleDriveFolderId,
    googleDriveFolderUrl: updated.googleDriveFolderUrl,
    googleDriveLastSyncedAt:
      updated.googleDriveLastSyncedAt?.toISOString() ?? null
  };
}

export async function syncProjectDriveFolder(
  projectId: string
): Promise<DriveSyncResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, googleDriveFolderId: true }
  });

  if (!project) {
    throw new Error("Project not found");
  }
  if (!project.googleDriveFolderId) {
    throw new Error("Project has no linked Drive folder");
  }

  const accessToken = await getAccessToken();
  const files = await listFolderFiles(project.googleDriveFolderId, accessToken);

  const result: DriveSyncResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    skippedDetails: [],
    errors: []
  };

  for (const file of files) {
    await applyDriveFileToProject(projectId, file, accessToken, result);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { googleDriveLastSyncedAt: new Date() }
  });

  return result;
}

interface DriveChangeFile {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
}

interface DriveChange {
  fileId?: string;
  removed?: boolean;
  file?: DriveChangeFile;
}

/**
 * Drain Drive's changes feed for a project's linked folder since its stored
 * startPageToken, mirroring per-file evidence into Discovery and advancing the
 * token. Returns null if the project no longer has a folder linked.
 */
export async function processDriveChangesForProject(
  projectId: string
): Promise<DriveSyncResult | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      googleDriveFolderId: true,
      googleDriveStartPageToken: true
    }
  });

  if (!project?.googleDriveFolderId) {
    return null;
  }

  const accessToken = await getAccessToken();

  // No token usually means the channel setup failed at link time — bootstrap
  // it now so subsequent webhooks have a valid cursor.
  let pageToken =
    project.googleDriveStartPageToken ??
    (await fetchStartPageToken(accessToken));

  const result: DriveSyncResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    skippedDetails: [],
    errors: []
  };

  let nextStartPageToken: string | null = null;

  // changes.list pages until newStartPageToken is returned.
  for (let safety = 0; safety < 50; safety++) {
    const params = new URLSearchParams({
      pageToken,
      fields:
        "changes(fileId,file(id,name,mimeType,modifiedTime,parents,trashed),removed),newStartPageToken,nextPageToken",
      pageSize: "100",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      includeRemoved: "true"
    });
    const response = await driveFetch(
      `/changes?${params.toString()}`,
      accessToken
    );
    const body = (await response.json()) as {
      changes?: DriveChange[];
      newStartPageToken?: string;
      nextPageToken?: string;
    };

    for (const change of body.changes ?? []) {
      const fileId = change.fileId;
      if (!fileId) continue;

      const file = change.file;
      const isRemoved =
        change.removed === true ||
        file?.trashed === true ||
        !file?.parents?.includes(project.googleDriveFolderId);

      if (isRemoved) {
        await removeDriveFileFromProject(projectId, fileId);
        result.updated += 1;
        continue;
      }

      if (!file?.parents?.includes(project.googleDriveFolderId)) {
        result.skipped += 1;
        result.skippedDetails.push({
          name: file?.name ?? fileId,
          reason: "File moved out of folder"
        });
        continue;
      }

      const driveFile: DriveFile = {
        id: fileId,
        name: file.name ?? fileId,
        mimeType: file.mimeType ?? "application/octet-stream"
      };
      if (file.modifiedTime) {
        driveFile.modifiedTime = file.modifiedTime;
      }
      await applyDriveFileToProject(projectId, driveFile, accessToken, result);
    }

    if (body.newStartPageToken) {
      nextStartPageToken = body.newStartPageToken;
      break;
    }
    if (!body.nextPageToken) {
      break;
    }
    pageToken = body.nextPageToken;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      googleDriveStartPageToken: nextStartPageToken ?? pageToken,
      googleDriveLastSyncedAt: new Date()
    }
  });

  return result;
}

/**
 * Look up a project by the value Drive echoes back in the `x-goog-channel-id`
 * header. Returns the bare ID (or null) so the webhook handler can validate
 * before kicking off any expensive work.
 */
export async function findProjectIdByDriveChannelId(
  channelId: string
): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: { googleDriveChannelId: channelId },
    select: { id: true }
  });
  return project?.id ?? null;
}

async function rotateWatchChannel(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      googleDriveFolderId: true,
      googleDriveChannelId: true,
      googleDriveResourceId: true
    }
  });
  if (!project?.googleDriveFolderId) return;

  await tryStopExistingChannel(
    project.googleDriveChannelId,
    project.googleDriveResourceId
  );

  try {
    const accessToken = await getAccessToken();
    const registration = await registerWatchChannel(projectId, accessToken);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        googleDriveChannelId: registration.channelId,
        googleDriveResourceId: registration.resourceId,
        googleDriveStartPageToken: registration.startPageToken,
        googleDriveChannelExpiresAt: registration.expiresAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[drive-sync] channel rotation failed for ${projectId}: ${message}`
    );
  }
}

let intervalHandle: NodeJS.Timeout | null = null;
let inFlight = false;

async function runDueSweep() {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    // Heartbeat fallback: with push notifications doing the heavy lifting we
    // only need to catch projects whose channel expired or whose webhook was
    // missed. Anything synced within the last 30 minutes is left alone.
    const thirtyMinutesAgo = new Date(Date.now() - FALLBACK_SWEEP_INTERVAL_MS);
    const projects = await prisma.project.findMany({
      where: {
        googleDriveFolderId: { not: null },
        OR: [
          { googleDriveLastSyncedAt: null },
          { googleDriveLastSyncedAt: { lt: thirtyMinutesAgo } }
        ]
      },
      select: { id: true },
      take: 20
    });

    for (const project of projects) {
      try {
        await syncProjectDriveFolder(project.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[drive-sync] project ${project.id} sweep failed: ${message}`);
      }
    }

    // Renew channels approaching the 7-day Drive cap so webhooks don't lapse.
    const renewBefore = new Date(Date.now() + WATCH_CHANNEL_RENEW_BEFORE_MS);
    const expiring = await prisma.project.findMany({
      where: {
        googleDriveFolderId: { not: null },
        googleDriveChannelExpiresAt: { lt: renewBefore }
      },
      select: { id: true },
      take: 20
    });
    for (const project of expiring) {
      await rotateWatchChannel(project.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[drive-sync] sweep error: ${message}`);
  } finally {
    inFlight = false;
  }
}

export function startDriveSyncScheduler() {
  if (intervalHandle) {
    return;
  }
  intervalHandle = setInterval(() => {
    void runDueSweep();
  }, FALLBACK_SWEEP_INTERVAL_MS);
  // Don't block process exit on this timer.
  if (typeof intervalHandle.unref === "function") {
    intervalHandle.unref();
  }
  // Kick a first sweep shortly after boot so initial linkages sync quickly.
  setTimeout(() => {
    void runDueSweep();
  }, 30_000).unref?.();
}
