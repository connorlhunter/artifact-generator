import type { DocumentInline } from "../content/document-model.ts";
import { pdfStyle } from "./pdf-style.ts";

export interface PdfLinks {
  readonly destinations: ReadonlySet<string>;
  readonly projectUrl?: string;
}

interface TextRun {
  readonly font: string;
  readonly value: string;
  readonly link?: string;
  readonly goTo?: string;
}

/** Allows web and email destinations without passing executable or local URLs into a PDF. */
export function pdfLink(
  item: Extract<DocumentInline, { type: "link" }>,
  links: PdfLinks,
): { readonly link?: string; readonly goTo?: string } {
  if (item.target?.kind === "document" && links.destinations.has(item.target.id))
    return { goTo: item.target.id };
  if (item.target?.kind === "diagram" && links.projectUrl)
    return { link: `${links.projectUrl}/diagrams/${encodeURIComponent(item.target.id)}` };
  if (item.href && /^(?:https?:\/\/|mailto:)/iu.test(item.href)) return { link: item.href };
  return {};
}

function textRuns(items: ReadonlyArray<DocumentInline>, links: PdfLinks): TextRun[] {
  return items.flatMap((item): TextRun[] => {
    if (item.type === "link") {
      const destination = pdfLink(item, links);
      return textRuns(item.children, links).map((run) => ({ ...run, ...destination }));
    }
    return [{ font: item.type === "text" ? "body" : item.type, value: item.value }];
  });
}

/** Writes styled spans as one wrapping paragraph, preserving clickable links. */
export function writeInline(
  document: PDFKit.PDFDocument,
  items: ReadonlyArray<DocumentInline>,
  links: PdfLinks,
  x: number,
  width: number,
  size: number = pdfStyle.bodySize,
): void {
  const runs = textRuns(items, links).filter((run) => run.value.length > 0);
  if (!runs.length) return;
  document.x = x;
  for (const [index, run] of runs.entries()) {
    document
      .font(run.font)
      .fontSize(run.font === "code" ? size * 0.88 : size)
      .fillColor(run.link || run.goTo ? pdfStyle.accent : pdfStyle.ink)
      .text(run.value, {
        width,
        lineGap: pdfStyle.lineGap,
        continued: index < runs.length - 1,
        link: run.link ?? null,
        goTo: run.goTo,
      });
  }
  document.x = x;
}
