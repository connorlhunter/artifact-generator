import {
  docsPreviewTitle,
  orderedDocsForPreview,
  primaryProjectIconAsset,
  projectIconAssetsForDocs,
  type MarkdownDoc,
  type MermaidPreviewAsset,
  type ProjectIconPreviewAsset,
} from "../docs-utils.ts";
import { readDocumentMetadata } from "../doc-metadata.ts";
import { renderDocArticle, type RenderedDocArticle } from "./article-html.ts";
import { loadDocsPreviewClientScript } from "./client.ts";
import { renderNavigation } from "./navigation-html.ts";
import type { DocsPreviewOptions } from "./options.ts";
import { renderPageHtml } from "./page-html.ts";
import { loadDocsPreviewStyles } from "./styles.ts";

/**
 * Rendered preview HTML plus static assets required beside it.
 */
export interface RenderedDocsPreviewPage {
  /**
   * Complete standalone HTML document.
   */
  html: string;
  /**
   * Rendered SVG assets referenced by the HTML.
   */
  diagramAssets: MermaidPreviewAsset[];
  /**
   * Project icon assets referenced by the HTML.
   */
  projectIconAssets: ProjectIconPreviewAsset[];
}

/**
 * Renders a complete standalone HTML preview page.
 *
 * @param {MarkdownDoc[]} docs - Documents included in the preview.
 * @param {DocsPreviewOptions} options - Render options.
 * @returns {Promise<RenderedDocsPreviewPage>} Standalone HTML document and assets.
 */
export async function renderDocsPreviewPage(
  docs: MarkdownDoc[],
  options: DocsPreviewOptions,
): Promise<RenderedDocsPreviewPage> {
  const orderedDocs = orderedDocsForPreview(docs);
  const knownIds = idsByPath(orderedDocs);
  const metadataByPath = await documentMetadataByPath(orderedDocs);
  const title = docsPreviewTitle(orderedDocs);
  const [styles, clientScript, renderedDocs] = await Promise.all([
    loadDocsPreviewStyles(),
    loadDocsPreviewClientScript(),
    Promise.all(
      orderedDocs.map((doc): Promise<RenderedDocArticle> =>
        renderDocArticle(doc, knownIds, options, metadataByPath.get(doc.metadataPath ?? "")),
      ),
    ),
  ]);

  return {
    diagramAssets: uniqueDiagramAssets(renderedDocs.flatMap((article) => article.diagramAssets)),
    html: renderPageHtml({
      articlesHtml: renderedDocs.map((article) => article.html).join(""),
      clientScript,
      documentCount: orderedDocs.length,
      navigationHtml: renderNavigation(orderedDocs),
      pageTitle: title.endsWith("Preview") ? title : `${title} Preview`,
      projectIcon: primaryProjectIconAsset(orderedDocs),
      styles,
      title,
    }),
    projectIconAssets: projectIconAssetsForDocs(orderedDocs),
  };
}

/** Loads each centralized document metadata file once for the selected preview. */
async function documentMetadataByPath(
  docs: MarkdownDoc[],
): Promise<Map<string, Awaited<ReturnType<typeof readDocumentMetadata>>>> {
  const paths = [...new Set(docs.flatMap((doc) => (doc.metadataPath ? [doc.metadataPath] : [])))];
  const entries = await Promise.all(
    paths.map(async (path) => [path, await readDocumentMetadata(path)] as const),
  );

  return new Map(entries);
}

/**
 * Builds the path-to-anchor lookup used to rewrite local Markdown links.
 *
 * @param {MarkdownDoc[]} docs - Docs included in the preview.
 * @returns {Map<string, string>} Document ids keyed by repo-relative path.
 */
function idsByPath(docs: MarkdownDoc[]): Map<string, string> {
  return new Map(docs.map((doc) => [doc.input, doc.id]));
}

/**
 * Removes duplicate diagram asset copies.
 *
 * @param {MermaidPreviewAsset[]} assets - Diagram assets discovered while rendering.
 * @returns {MermaidPreviewAsset[]} Assets keyed by preview target.
 */
function uniqueDiagramAssets(assets: MermaidPreviewAsset[]): MermaidPreviewAsset[] {
  return [...new Map(assets.map((asset) => [asset.target, asset])).values()];
}
