import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError } from "../core/script-logger.ts";
import { renderDocsPdf } from "./render-docs-pdf.ts";
import { renderDocsPreview } from "./render-docs-preview.ts";

/** Testable actions used by the docs-preview PDF shortcut. */
export interface RenderDocsPreviewPdfActions {
  readonly renderPdf?: (input: string, output?: string) => Promise<string>;
  readonly renderPreview?: (args: string[]) => Promise<string>;
}

/**
 * Rebuilds a selected docs preview, then prints that exact preview as a PDF.
 *
 * @param args - Docs project and preview options after the script name.
 * @param actions - Optional render actions used by focused tests.
 * @returns Generated PDF path.
 */
export async function renderDocsPreviewPdf(
  args: string[],
  actions: RenderDocsPreviewPdfActions = {},
): Promise<string> {
  const preview = await (actions.renderPreview ?? renderDocsPreview)(args);
  return (actions.renderPdf ?? renderDocsPdf)(preview, artifactPaths.docsPreviewPdf);
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await renderDocsPreviewPdf(process.argv.slice(2));
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
