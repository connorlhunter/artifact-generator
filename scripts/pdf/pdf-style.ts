import { fileURLToPath } from "node:url";

export const pdfStyle = {
  accent: "#A64C30",
  ink: "#242527",
  muted: "#61666C",
  rule: "#DADDE0",
  surface: "#F4F5F6",
  bodySize: 10.5,
  lineGap: 2.5,
  margins: { top: 64, right: 50, bottom: 56, left: 50 },
} as const;

/** Registers bundled fonts for source and compiled entrypoints. */
export function registerPdfFonts(document: PDFKit.PDFDocument): void {
  for (const [name, filename] of Object.entries({
    body: "SourceSans3-Regular.otf",
    strong: "SourceSans3-Semibold.otf",
    emphasis: "SourceSans3-It.otf",
    code: "SourceCodePro-Regular.otf",
  })) {
    document.registerFont(
      name,
      fileURLToPath(new URL(`../../resources/pdf-fonts/${filename}`, import.meta.url)),
    );
  }
}

export function contentWidth(document: PDFKit.PDFDocument, x = document.page.margins.left): number {
  return document.page.width - document.page.margins.right - x;
}

export function remainingHeight(document: PDFKit.PDFDocument): number {
  return document.page.height - document.page.margins.bottom - document.y;
}

/** Keeps short blocks and their following line on the same page. */
export function ensureSpace(document: PDFKit.PDFDocument, height: number): void {
  if (remainingHeight(document) < height && document.y > document.page.margins.top)
    document.addPage();
}
