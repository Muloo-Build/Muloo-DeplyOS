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
import { prisma } from "./prisma";
import { refreshGoogleWorkspaceEmailAccessTokenIfNeeded } from "./server";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const MAX_EXTRACTED_CHARS = 50_000;

const FOLDER_MIME = "application/vnd.google-apps.folder";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: string;
}

export interface DriveSyncResult {
  added: number;
  updated: number;
  skipped: number;
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

async function extractText(
  file: DriveFile,
  accessToken: string
): Promise<string | null> {
  switch (file.mimeType) {
    case "application/pdf": {
      const buffer = await downloadBinary(file.id, accessToken);
      // pdf-parse executes a debug fixture-load on bare import in some
      // environments — require the implementation module directly to avoid it.
      const pdfParse: (data: Buffer) => Promise<{ text: string }> =
        require("pdf-parse/lib/pdf-parse.js");
      const parsed = await pdfParse(buffer);
      return parsed.text ?? "";
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const buffer = await downloadBinary(file.id, accessToken);
      const mammoth = require("mammoth") as {
        extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
      };
      const parsed = await mammoth.extractRawText({ buffer });
      return parsed.value ?? "";
    }
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      const buffer = await downloadBinary(file.id, accessToken);
      // officeparser also handles docx/xlsx/odt; we keep the explicit mimetype
      // switch so unsupported binary types still fall through to `null` and are
      // skipped rather than producing noisy partial extracts.
      const { parseOfficeAsync } = require("officeparser") as {
        parseOfficeAsync: (
          buffer: Buffer | string,
          config?: Record<string, unknown>
        ) => Promise<string>;
      };
      try {
        const text = await parseOfficeAsync(buffer);
        return text ?? "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[drive-sync] pptx parse failed for ${file.id} ${file.name}: ${message}`
        );
        return null;
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
    select: { id: true }
  });
  if (!project) {
    throw new Error("Project not found");
  }

  // Surfaces a clear error if scope/auth is missing or the folder is not accessible.
  await validateDriveFolder(folderId);

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      googleDriveFolderId: folderId,
      googleDriveFolderUrl: folderUrl.trim(),
      googleDriveLastSyncedAt: null
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

export async function clearProjectDriveFolder(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      googleDriveFolderId: null,
      googleDriveFolderUrl: null,
      googleDriveLastSyncedAt: null
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
    errors: []
  };

  for (const file of files) {
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
        continue;
      }

      const text = await extractText(file, accessToken);
      if (text === null) {
        result.skipped += 1;
        continue;
      }

      const truncated = text.slice(0, MAX_EXTRACTED_CHARS);

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
      console.warn(`[drive-sync] ${projectId} ${file.id} ${file.name}: ${message}`);
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { googleDriveLastSyncedAt: new Date() }
  });

  return result;
}

let intervalHandle: NodeJS.Timeout | null = null;
let inFlight = false;

async function runDueSweep() {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const projects = await prisma.project.findMany({
      where: {
        googleDriveFolderId: { not: null },
        OR: [
          { googleDriveLastSyncedAt: null },
          { googleDriveLastSyncedAt: { lt: fiveMinutesAgo } }
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
  }, 5 * 60 * 1000);
  // Don't block process exit on this timer.
  if (typeof intervalHandle.unref === "function") {
    intervalHandle.unref();
  }
  // Kick a first sweep shortly after boot so initial linkages sync quickly.
  setTimeout(() => {
    void runDueSweep();
  }, 30_000).unref?.();
}
