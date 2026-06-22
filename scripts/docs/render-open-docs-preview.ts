import { openDocsPreview } from "./open-docs-preview.ts";
import { renderDocsPreview } from "./render-docs-preview.ts";
import { isEntrypoint } from "../core/script-entry.ts";

/**
 * Renders and opens the Markdown docs preview.
 *
 * @param {string[]} args - CLI args after the script name.
 */
export async function renderOpenDocsPreview(args: string[]): Promise<void> {
  const output = await renderDocsPreview(args);

  await openDocsPreview(output);
}

if (isEntrypoint(import.meta.url)) {
  await renderOpenDocsPreview(process.argv.slice(2));
}
