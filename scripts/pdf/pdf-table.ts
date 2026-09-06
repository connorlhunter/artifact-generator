import { plainInline, type DocumentInline } from "../content/document-model.ts";
import { contentWidth, ensureSpace, pdfStyle, remainingHeight } from "./pdf-style.ts";
import { pdfLink, type PdfLinks } from "./pdf-text.ts";

type Row = ReadonlyArray<ReadonlyArray<DocumentInline>>;
const size = 9.3;
const padding = 8;

function columnWidths(rows: ReadonlyArray<Row>, width: number): number[] {
  const count = Math.max(...rows.map((row) => row.length));
  const weights = Array.from({ length: count }, (_, index) => {
    const average =
      rows.reduce((sum, row) => sum + plainInline(row[index] ?? []).length, 0) / rows.length;
    return Math.sqrt(Math.max(15, Math.min(100, average)));
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => (width * value) / total);
}

function rowHeight(
  document: PDFKit.PDFDocument,
  row: Row,
  widths: number[],
  header: boolean,
): number {
  document.font(header ? "strong" : "body").fontSize(size);
  return (
    Math.max(
      ...widths.map((width, index) =>
        document.heightOfString(plainInline(row[index] ?? []), {
          width: width - padding * 2,
          lineGap: 2,
        }),
      ),
      size,
    ) +
    padding * 2
  );
}

function cell(
  items: ReadonlyArray<DocumentInline>,
  header: boolean,
  links: PdfLinks,
): PDFKit.Mixins.CellOptions {
  const target = items.length === 1 && items[0]?.type === "link" ? pdfLink(items[0], links) : {};
  return {
    text: plainInline(items),
    font: { src: header ? "strong" : "body", size },
    type: header ? "TH" : "TD",
    textOptions: { lineGap: 2, ...target },
    ...(header ? { backgroundColor: pdfStyle.surface } : {}),
  };
}

/** Paginates real table cells and repeats the header for each new group of rows. */
export function writeTable(
  document: PDFKit.PDFDocument,
  rows: ReadonlyArray<Row>,
  links: PdfLinks,
  x: number,
): void {
  const header = rows[0];
  if (!header?.length) return;
  const width = contentWidth(document, x);
  const widths = columnWidths(rows, width);
  const headerHeight = rowHeight(document, header, widths, true);
  let index = 1;
  do {
    ensureSpace(
      document,
      headerHeight + (rows[index] ? rowHeight(document, rows[index]!, widths, false) : 0),
    );
    const data = [header.map((value) => cell(value, true, links))];
    let height = headerHeight;
    while (index < rows.length) {
      const row = rows[index]!;
      const nextHeight = rowHeight(document, row, widths, false);
      if (height + nextHeight > remainingHeight(document) && data.length > 1) break;
      data.push(row.map((value) => cell(value, false, links)));
      height += nextHeight;
      index += 1;
    }
    document
      .font("body")
      .fontSize(size)
      .fillColor(pdfStyle.ink)
      .table({
        position: { x, y: document.y },
        maxWidth: width,
        columnStyles: widths,
        defaultStyle: {
          padding,
          border: [0, 0, 0.5, 0],
          borderColor: pdfStyle.rule,
          textColor: pdfStyle.ink,
        },
        data,
      });
    if (index < rows.length) document.addPage();
  } while (index < rows.length);
  document.x = x;
  document.y += 10;
}
