import { plainInline, type DocumentBlock } from "../content/document-model.ts";
import { contentWidth, ensureSpace, pdfStyle } from "./pdf-style.ts";
import { writeInline, type PdfLinks } from "./pdf-text.ts";
import { writeTable } from "./pdf-table.ts";

function heading(
  document: PDFKit.PDFDocument,
  block: Extract<DocumentBlock, { type: "heading" | "paragraph" }>,
  x: number,
): void {
  const size = (block.level ?? 2) <= 2 ? 16 : 12.5;
  const text = plainInline(block.content);
  document.font("strong").fontSize(size);
  const height = document.heightOfString(text, { width: contentWidth(document, x) });
  ensureSpace(document, height + 48);
  document.y += 10;
  document
    .fillColor(pdfStyle.ink)
    .text(text, x, document.y, { width: contentWidth(document, x), lineGap: 1 });
  document.y += 7;
}

function codeLines(document: PDFKit.PDFDocument, value: string, width: number): string[] {
  document.font("code").fontSize(8.6);
  const capacity = Math.max(1, Math.floor(width / document.widthOfString("M")));
  return value
    .replace(/\t/gu, "    ")
    .split("\n")
    .flatMap((line) => {
      const characters = [...line];
      if (!characters.length) return [""];
      const lines: string[] = [];
      for (let index = 0; index < characters.length; index += capacity)
        lines.push(characters.slice(index, index + capacity).join(""));
      return lines;
    });
}

function code(document: PDFKit.PDFDocument, value: string, x: number, language?: string): void {
  const width = contentWidth(document, x);
  const lines = codeLines(document, value, width - 24);
  const lineHeight = 13;
  const labelHeight = language ? 14 : 0;
  ensureSpace(document, Math.min(lines.length, 3) * lineHeight + 18 + labelHeight);
  for (let index = 0; index < lines.length;) {
    const available = document.page.height - document.page.margins.bottom - document.y;
    const count = Math.min(
      lines.length - index,
      Math.floor((available - 18 - labelHeight) / lineHeight),
    );
    if (count < 1) {
      document.addPage();
      continue;
    }
    const y = document.y;
    const height = count * lineHeight + 18 + labelHeight;
    document.rect(x, y, width, height).fill(pdfStyle.surface);
    if (language)
      document
        .font("strong")
        .fontSize(7.5)
        .fillColor(pdfStyle.muted)
        .text(language.toUpperCase(), x + 12, y + 7, { lineBreak: false });
    for (let row = 0; row < count; row += 1)
      document
        .font("code")
        .fontSize(8.6)
        .fillColor(pdfStyle.ink)
        .text(lines[index + row]!, x + 12, y + 9 + labelHeight + row * lineHeight, {
          lineBreak: false,
        });
    document.y = y + height + 10;
    index += count;
    if (index < lines.length) document.addPage();
  }
  document.x = x;
}

function list(
  document: PDFKit.PDFDocument,
  block: Extract<DocumentBlock, { type: "list" }>,
  links: PdfLinks,
  x: number,
): void {
  for (const [index, item] of block.items.entries()) {
    ensureSpace(document, 38);
    document
      .font("body")
      .fontSize(pdfStyle.bodySize)
      .fillColor(pdfStyle.muted)
      .text(block.ordered ? `${index + 1}.` : "•", x, document.y, { lineBreak: false });
    writeBlocks(document, item, links, x + 18);
    if (item.at(-1)?.type === "paragraph") document.y -= 3;
  }
  document.x = x;
  document.y += 3;
}

/** Renders the same safe Markdown block model consumed by the site. */
export function writeBlocks(
  document: PDFKit.PDFDocument,
  blocks: ReadonlyArray<DocumentBlock>,
  links: PdfLinks,
  x = document.page.margins.left,
): void {
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        heading(document, block, x);
        break;
      case "paragraph":
        ensureSpace(document, 32);
        writeInline(document, block.content, links, x, contentWidth(document, x));
        document.y += 6;
        break;
      case "code":
        code(document, block.value, x, block.language);
        break;
      case "list":
        list(document, block, links, x);
        break;
      case "table":
        writeTable(document, block.rows, links, x);
        break;
      case "quote":
        ensureSpace(document, 40);
        document
          .font("strong")
          .fontSize(20)
          .fillColor(pdfStyle.accent)
          .text("“", x, document.y, { lineBreak: false });
        writeBlocks(document, block.content, links, x + 18);
        break;
      case "rule":
        ensureSpace(document, 24);
        document
          .moveTo(x, document.y + 5)
          .lineTo(document.page.width - document.page.margins.right, document.y + 5)
          .lineWidth(0.5)
          .stroke(pdfStyle.rule);
        document.y += 18;
        break;
    }
  }
}
