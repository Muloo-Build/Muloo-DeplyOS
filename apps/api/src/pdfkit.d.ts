declare module "pdfkit" {
  interface PDFDocumentOptions {
    size?: string | [number, number];
    margin?: number;
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
    [key: string]: unknown;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    y: number;
    fontSize(size: number): this;
    fillColor(color: string): this;
    text(text: string, x?: number, y?: number, options?: Record<string, unknown>): this;
    text(text: string, options?: Record<string, unknown>): this;
    moveDown(lines?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    strokeColor(color: string): this;
    stroke(): this;
    end(): void;
    on(event: "data", callback: (chunk: Buffer) => void): this;
    on(event: "end", callback: () => void): this;
    on(event: "error", callback: (err: Error) => void): this;
    on(event: string, callback: (...args: unknown[]) => void): this;
  }

  export default PDFDocument;
}
