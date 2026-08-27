import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import PDFDocument from "pdfkit";

/** A compact section written into a generated artifact PDF. */
export interface PdfSection {
  readonly body?: ReadonlyArray<string>;
  readonly heading?: string;
}

/** Input shared by the direct artifact PDF writers. */
export interface WritePdfOptions {
  readonly output: string;
  readonly sections: ReadonlyArray<PdfSection>;
  readonly subtitle?: string;
  readonly title: string;
}

const pageMargin = 48;

/**
 * Writes a readable, paginated PDF without first generating a browser page.
 *
 * @param options - Title and section content for one artifact PDF.
 * @returns Written PDF path.
 */
export async function writePdf({
  output,
  sections,
  subtitle,
  title,
}: WritePdfOptions): Promise<string> {
  mkdirSync(dirname(output), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({
      info: { Title: title },
      margin: pageMargin,
      size: "LETTER",
    });
    const stream = createWriteStream(output);

    document.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);

    document.fillColor("#17202a").font("Helvetica-Bold").fontSize(22).text(title);

    if (subtitle) {
      document.moveDown(0.35).fillColor("#667085").font("Helvetica").fontSize(10).text(subtitle);
    }

    for (const section of sections) {
      document.moveDown(1.1);

      if (section.heading) {
        document.fillColor("#0f6b7a").font("Helvetica-Bold").fontSize(14).text(section.heading, {
          continued: false,
        });
      }

      for (const line of section.body ?? []) {
        document.moveDown(0.28).fillColor("#17202a").font("Helvetica").fontSize(10).text(line, {
          lineGap: 2,
        });
      }
    }

    document.end();
  });

  return output;
}
