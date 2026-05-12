import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { randomUUID, createHash } from "node:crypto";

const VOLUME_ROOT = process.env.FILE_STORAGE_ROOT ?? "/data";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv"
};

const SAFE_EXTS = new Set([".pdf", ".docx", ".pptx", ".txt", ".md", ".csv"]);

function pickExt(originalName: string, mimeType: string): string {
  const fromMime = MIME_TO_EXT[mimeType];
  if (fromMime) return fromMime;

  const fromName = extname(originalName).toLowerCase();
  if (fromName && SAFE_EXTS.has(fromName)) return fromName;

  return "";
}

function ensureInsideVolume(fullPath: string): void {
  const root = resolve(VOLUME_ROOT);
  const normalized = resolve(fullPath);

  if (normalized !== root && !normalized.startsWith(root + sep)) {
    throw new Error("Invalid storage path");
  }
}

export async function storeProjectFile(input: {
  projectId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ storagePath: string; checksum: string; sizeBytes: number }> {
  const ext = pickExt(input.originalName, input.mimeType);
  const id = randomUUID();
  // Relative path stored in DB; never contains absolute prefix.
  const relPath = join("projects", input.projectId, `${id}${ext}`);
  const fullPath = resolve(VOLUME_ROOT, relPath);

  ensureInsideVolume(fullPath);

  await mkdir(resolve(VOLUME_ROOT, "projects", input.projectId), {
    recursive: true
  });
  await writeFile(fullPath, input.buffer);

  const checksum = createHash("sha256").update(input.buffer).digest("hex");

  return {
    storagePath: relPath,
    checksum,
    sizeBytes: input.buffer.length
  };
}

export function streamProjectFile(storagePath: string): NodeJS.ReadableStream {
  const fullPath = resolve(VOLUME_ROOT, storagePath);
  ensureInsideVolume(fullPath);
  return createReadStream(fullPath);
}

export async function deleteProjectFile(storagePath: string): Promise<void> {
  const fullPath = resolve(VOLUME_ROOT, storagePath);
  ensureInsideVolume(fullPath);

  try {
    await unlink(fullPath);
  } catch (error) {
    // File missing on disk shouldn't block DB cleanup.
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code !== "ENOENT") throw error;
  }
}

export function getVolumeRoot(): string {
  return VOLUME_ROOT;
}
