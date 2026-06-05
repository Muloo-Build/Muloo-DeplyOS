// Text extraction for uploaded project files.
//
// Heavy native parsers are loaded via dynamic import so that a missing
// optional dependency (e.g. officeparser not installed yet) cannot crash
// boot — extraction simply returns null and the file is still stored and
// linked to discovery evidence. Downstream synthesis can still use the
// sourceLabel + Notes content.

const MAX_OUTPUT_CHARS = 50_000;

function truncate(value: string): string {
  if (value.length <= MAX_OUTPUT_CHARS) return value.trim();
  return value.slice(0, MAX_OUTPUT_CHARS).trim();
}

// Dynamic require so TypeScript does not statically resolve these optional
// modules — they're only needed at runtime and degrade gracefully when
// absent (the file is still stored, sourceLabel + notes still feed
// synthesis).
function tryRequire(moduleName: string): unknown {
  try {
     
    return (eval("require") as NodeRequire)(moduleName);
  } catch {
    return null;
  }
}

async function extractFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    const mod = tryRequire("pdf-parse") as
      | ((buf: Buffer) => Promise<{ text?: string }>)
      | { default?: (buf: Buffer) => Promise<{ text?: string }> }
      | null;
    if (!mod) return null;
    const fn =
      typeof mod === "function"
        ? mod
        : ((mod as { default?: unknown }).default as (
            buf: Buffer
          ) => Promise<{ text?: string }>);
    if (typeof fn !== "function") return null;
    const result = await fn(buffer);
    const text = typeof result?.text === "string" ? result.text : "";
    return text ? truncate(text) : null;
  } catch (error) {
    process.stderr.write(
      `[textExtraction] pdf-parse failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    return null;
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string | null> {
  try {
    const mod = tryRequire("mammoth") as {
      extractRawText?: (input: { buffer: Buffer }) => Promise<{
        value?: string;
      }>;
    } | null;
    if (!mod?.extractRawText) return null;
    const result = await mod.extractRawText({ buffer });
    const text = typeof result?.value === "string" ? result.value : "";
    return text ? truncate(text) : null;
  } catch (error) {
    process.stderr.write(
      `[textExtraction] mammoth failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    return null;
  }
}

async function extractFromPptx(buffer: Buffer): Promise<string | null> {
  try {
    const mod = tryRequire("officeparser") as {
      parseOfficeAsync?: (buf: Buffer) => Promise<string>;
      default?: { parseOfficeAsync?: (buf: Buffer) => Promise<string> };
    } | null;
    if (!mod) return null;
    const fn = mod.parseOfficeAsync ?? mod.default?.parseOfficeAsync;
    if (typeof fn !== "function") return null;
    const text = await fn(buffer);
    if (typeof text !== "string") return null;
    return text ? truncate(text) : null;
  } catch (error) {
    process.stderr.write(
      `[textExtraction] officeparser failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    return null;
  }
}

function extractFromPlainText(buffer: Buffer): string | null {
  const text = buffer.toString("utf8");
  if (!text) return null;
  return truncate(text);
}

export async function extractTextFromBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<string | null> {
  const mime = input.mimeType.toLowerCase();
  const lowerName = input.originalName.toLowerCase();

  if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return extractFromPdf(input.buffer);
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return extractFromDocx(input.buffer);
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    lowerName.endsWith(".pptx")
  ) {
    return extractFromPptx(input.buffer);
  }

  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "text/csv" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv")
  ) {
    return extractFromPlainText(input.buffer);
  }

  return null;
}
