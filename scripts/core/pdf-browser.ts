import type { LaunchOptions } from "puppeteer";

/**
 * Returns browser options for rendering locally generated PDFs.
 *
 * Hosted Ubuntu runners isolate the job and block Chrome's nested sandbox, so
 * only that trusted CI workload uses the compatible launch flags.
 *
 * @param continuousIntegration - Whether the renderer runs in continuous integration.
 * @returns Puppeteer options for the PDF-rendering browser.
 */
export function pdfBrowserLaunchOptions(continuousIntegration: boolean): LaunchOptions {
  return {
    args: continuousIntegration ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
    headless: true,
  };
}
