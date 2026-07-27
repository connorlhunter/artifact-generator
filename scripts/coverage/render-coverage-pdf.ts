import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { ensureDirectory } from "../core/bun-native-fs.ts";
import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logSuccess } from "../core/script-logger.ts";

/**
 * Renders the standalone coverage report as a downloadable PDF.
 *
 * @param input - HTML coverage report to render.
 * @param output - PDF file written beside the coverage report.
 * @returns The generated PDF path.
 */
export async function renderCoveragePdf(
  input = artifactPaths.coverageReport,
  output = artifactPaths.coverageReportPdf,
): Promise<string> {
  ensureDirectory(dirname(output));

  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.emulateMediaType("print");
    await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle0" });
    await page.pdf({
      format: "Letter",
      landscape: true,
      margin: {
        bottom: "0.45in",
        left: "0.45in",
        right: "0.45in",
        top: "0.45in",
      },
      path: output,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  logSuccess(`Rendered coverage PDF: ${output}`);

  return output;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await renderCoveragePdf(process.argv[2], process.argv[3]);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
