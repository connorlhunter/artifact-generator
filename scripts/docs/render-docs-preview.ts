import { existsSync } from "node:fs";
import { dirname } from "node:path";
import {
  docsPreviewOutput,
  findMarkdownDocs,
  orderedDocGroups,
  orderedDocsForPreview,
  type MarkdownDoc,
  type MermaidPreviewAsset,
  type ProjectIconPreviewAsset,
} from "./docs-utils.ts";
import { copyFile, ensureDirectory, writeText } from "../core/bun-native-fs.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logGroup, logHeading, logItem, logSuccess } from "../core/script-logger.ts";
import { renderDiagramPreviewPage } from "./preview/diagram-page-html.ts";
import { renderDocsPreviewPage } from "./preview/html.ts";
import { parseDocsPreviewOptions } from "./preview/options.ts";

export { parseDocsPreviewOptions } from "./preview/options.ts";

/**
 * Logs the Markdown files included in the preview.
 *
 * @param {MarkdownDoc[]} docs - Documents included in the preview.
 */
function logDocs(docs: MarkdownDoc[]): void {
  const orderedDocs = orderedDocsForPreview(docs);

  logHeading("Rendering Markdown preview", { count: orderedDocs.length });

  for (const [project, projectDocs] of orderedDocGroups(orderedDocs)) {
    logGroup(project, projectDocs.length);
    for (const doc of projectDocs) logItem(doc.input, 2);
  }
}

/**
 * Copies rendered diagram SVGs beside the generated preview HTML.
 *
 * @param {MermaidPreviewAsset[]} assets - Diagram assets referenced by docs.
 */
async function copyDiagramAssets(assets: MermaidPreviewAsset[]): Promise<void> {
  await Promise.all(assets.map(copyDiagramAsset));
}

/**
 * Copies one rendered diagram SVG and writes its viewer page.
 *
 * @param {MermaidPreviewAsset} asset - Diagram asset to copy.
 */
async function copyDiagramAsset(asset: MermaidPreviewAsset): Promise<void> {
  await copyPreviewAsset(asset);
  ensureDirectory(dirname(asset.pageTarget));
  await writeText(asset.pageTarget, renderDiagramPreviewPage(asset));
}

/**
 * Copies project icon SVGs beside the generated preview HTML.
 *
 * @param {ProjectIconPreviewAsset[]} assets - Project icon assets referenced by docs.
 */
async function copyProjectIconAssets(assets: ProjectIconPreviewAsset[]): Promise<void> {
  await Promise.all(assets.map(copyPreviewAsset));
}

/**
 * Copies one preview asset into the docs preview bundle.
 *
 * @param {MermaidPreviewAsset | ProjectIconPreviewAsset} asset - Preview asset to copy.
 */
async function copyPreviewAsset(
  asset: MermaidPreviewAsset | ProjectIconPreviewAsset,
): Promise<void> {
  if (!existsSync(asset.source)) {
    throw new Error(`Preview asset is missing: ${asset.source}`);
  }

  ensureDirectory(dirname(asset.target));
  await copyFile(asset.source, asset.target);
}

/**
 * Renders Markdown docs to a single browser-friendly HTML preview.
 *
 * @param {string[]} args - CLI args after the script name.
 * @returns {Promise<string>} Generated HTML preview path.
 */
export async function renderDocsPreview(args: string[]): Promise<string> {
  const options = parseDocsPreviewOptions(args);

  if (options.roots.length === 0) {
    logError("Pass a documentation project to render.");
    logItem("Example: bun run docs:render -- cipher", 1);
    process.exit(1);
  }

  const docs = findMarkdownDocs(options.roots);

  if (docs.length === 0) {
    logError("No Markdown docs found.");
    process.exit(1);
  }

  logDocs(docs);
  ensureDirectory(dirname(docsPreviewOutput));
  const preview = await renderDocsPreviewPage(docs, options);
  await copyDiagramAssets(preview.diagramAssets);
  await copyProjectIconAssets(preview.projectIconAssets);
  await writeText(docsPreviewOutput, preview.html);
  logSuccess(`Rendered Markdown preview: ${docsPreviewOutput}`);

  return docsPreviewOutput;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  const args: string[] = process.argv.slice(2);
  await renderDocsPreview(args);
}
