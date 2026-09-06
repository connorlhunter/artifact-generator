import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import PDFDocument from "pdfkit";
import type { DocumentBlock } from "../content/document-model.ts";
import { writeBlocks } from "./pdf-blocks.ts";
import { contentWidth, ensureSpace, pdfStyle, registerPdfFonts } from "./pdf-style.ts";

export interface PdfSection {
  readonly blocks: ReadonlyArray<DocumentBlock>;
  readonly heading: string;
  readonly id?: string;
  readonly subtitle?: string;
}

/** Shared print layout for docs, coverage, and changelogs. */
export interface WritePdfOptions {
  readonly output: string;
  readonly sections: ReadonlyArray<PdfSection>;
  readonly subtitle?: string;
  readonly title: string;
  readonly contents?: boolean;
  readonly projectUrl?: string;
}

function pageFurniture(document: PDFKit.PDFDocument, title: string): void {
  const { start, count } = document.bufferedPageRange();
  for (let index = start; index < start + count; index += 1) {
    document.switchToPage(index);
    const x = document.page.margins.left;
    const width = contentWidth(document);
    document
      .font("body")
      .fontSize(8)
      .fillColor(pdfStyle.muted)
      .text(title, x, 32, { width, lineBreak: false });
    document
      .moveTo(x, 48)
      .lineTo(x + width, 48)
      .lineWidth(0.5)
      .stroke(pdfStyle.rule);
    const footerY = document.page.height - 35;
    document
      .font("body")
      .fontSize(8)
      .fillColor(pdfStyle.muted)
      .text("Connor Hunter", x, footerY, { lineBreak: false });
    const label = `${index + 1} / ${count}`;
    document.text(label, x + width - document.widthOfString(label), footerY, { lineBreak: false });
  }
}

function render(document: PDFKit.PDFDocument, options: WritePdfOptions): void {
  registerPdfFonts(document);
  const links = {
    destinations: new Set(options.sections.flatMap((section) => (section.id ? [section.id] : []))),
    ...(options.projectUrl ? { projectUrl: options.projectUrl } : {}),
  };
  document.font("strong").fontSize(28).fillColor(pdfStyle.ink).text(options.title, { lineGap: 1 });
  if (options.subtitle)
    document
      .moveDown(0.35)
      .font("body")
      .fontSize(10)
      .fillColor(pdfStyle.muted)
      .text(options.subtitle, { lineGap: 2 });
  document.y += 18;
  if (options.contents) {
    document.font("strong").fontSize(12).fillColor(pdfStyle.ink).text("Contents");
    document.y += 8;
    for (const [index, section] of options.sections.entries()) {
      ensureSpace(document, 28);
      document
        .font("body")
        .fontSize(11)
        .fillColor(pdfStyle.accent)
        .text(`${String(index + 1).padStart(2, "0")}   ${section.heading}`, {
          goTo: section.id,
          lineGap: 3,
        });
      document.y += 5;
    }
  }
  for (const [index, section] of options.sections.entries()) {
    if (options.contents && index === 0) document.addPage();
    else {
      ensureSpace(document, options.contents ? 180 : 100);
      if (document.y > document.page.margins.top) document.y += options.contents ? 24 : 12;
    }
    document
      .font("strong")
      .fontSize(options.contents ? 24 : 18)
      .fillColor(pdfStyle.ink)
      .text(section.heading, { destination: section.id, lineGap: 1 });
    document.outline.addItem(section.heading);
    if (section.subtitle)
      document
        .moveDown(0.3)
        .font("body")
        .fontSize(9)
        .fillColor(pdfStyle.muted)
        .text(section.subtitle);
    document.y += 14;
    writeBlocks(document, section.blocks, links);
  }
  pageFurniture(document, options.title);
}

/** Replaces an output only after the complete PDF has been written successfully. */
export async function writePdf(options: WritePdfOptions): Promise<string> {
  await mkdir(dirname(options.output), { recursive: true });
  const staged = await mkdtemp(join(dirname(options.output), ".pdf-"));
  const temporary = join(staged, "document.pdf");
  try {
    const document = new PDFDocument({
      bufferPages: true,
      info: { Title: options.title, Author: "Connor Hunter" },
      margins: pdfStyle.margins,
      size: "LETTER",
    });
    const writing = pipeline(document, createWriteStream(temporary));
    // Observe stream failures immediately, including while synchronous layout is running.
    void writing.catch(() => undefined);
    try {
      render(document, options);
      document.end();
      await writing;
    } catch (error) {
      document.destroy();
      await writing.catch(() => undefined);
      throw error;
    }
    await rename(temporary, options.output);
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
  return options.output;
}
