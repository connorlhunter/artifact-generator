import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

function renderPdfHtml(input: string, publicUrl?: string): string {
  const localBaseUrl = `${pathToFileURL(resolve(dirname(input))).href}/`;
  const html = readFileSync(input, "utf8").replace("<head>", `<head><base href="${localBaseUrl}">`);
  const themeScript =
    '<script>document.documentElement.dataset.scheme="atlas";document.documentElement.style.colorScheme="light";</script>';

  const withPublicLinks = publicUrl
    ? html.replace(/href=(['"])([^'"]+)\1/gu, (attribute, quote: string, href: string) => {
        if (href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(href)) return attribute;

        const baseUrl = new URL(".", publicUrl);
        const diagramMatch = /^diagrams\/(.+)\.html$/u.exec(href);
        const target = diagramMatch?.[1]
          ? new URL(`/diagrams/${diagramMatch[1]}.svg`, baseUrl)
          : new URL(href, baseUrl);

        return `href=${quote}${target.href}${quote}`;
      })
    : html;

  return withPublicLinks.includes("</body>")
    ? withPublicLinks.replace("</body>", `${themeScript}</body>`)
    : `${withPublicLinks}${themeScript}`;
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
    await page.setContent(renderPdfHtml(input, publicUrl), { waitUntil: "load" });

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
