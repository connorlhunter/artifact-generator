import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { ensureDirectory } from "../core/bun-native-fs.ts";
import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logSuccess } from "../core/script-logger.ts";

/**
 * Builds the public HTML URL that relative PDF links should use.
 *
 * @param project - Manifest project slug.
 * @param origin - Public artifact origin.
 * @returns Public docs URL when an origin is configured.
 */
export function publicDocsUrl(
  project: string,
  origin = process.env.VITE_PUBLIC_ARTIFACTS_ORIGIN,
): string | undefined {
  const normalizedOrigin = origin?.trim().replace(/\/+$/u, "");

  return normalizedOrigin ? `${normalizedOrigin}/docs/${project}/index.html` : undefined;
}

/**
 * Renders a standalone docs preview to a downloadable print PDF.
 *
 * @param input - HTML preview file to render.
 * @param output - PDF file written beside the preview assets.
 * @returns The generated PDF path.
 */
export async function renderDocsPdf(
  input = artifactPaths.docsPreview,
  output = artifactPaths.docsPreviewPdf,
  publicUrl?: string,
): Promise<string> {
  ensureDirectory(dirname(output));

  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.emulateMediaType("print");
    await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle0" });

    await page.evaluate((documentUrl) => {
      document.documentElement.dataset.scheme = "atlas";
      document.documentElement.style.colorScheme = "light";

      if (!documentUrl) return;

      const baseUrl = new URL(".", documentUrl);

      for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const href = link.getAttribute("href");

        if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(href)) continue;
        link.href = new URL(href, baseUrl).href;
      }
    }, publicUrl);

    await page.pdf({
      format: "A4",
      margin: {
        bottom: "0.55in",
        left: "0.55in",
        right: "0.55in",
        top: "0.55in",
      },
      path: output,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  logSuccess(`Rendered docs PDF: ${output}`);

  return output;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await renderDocsPdf(process.argv[2], process.argv[3], process.argv[4]);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
