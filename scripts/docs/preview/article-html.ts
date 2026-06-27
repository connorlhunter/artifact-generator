import { marked, Renderer, type Token, type Tokens } from "marked";
import {
  docLinkLabel,
  localMarkdownTargetId,
  localMermaidTarget,
  markdownSourcePath,
  projectIconAsset,
  type MermaidPreviewAsset,
  type MarkdownDoc,
  type ProjectIconPreviewAsset,
} from "../docs-utils.ts";
import { readText } from "../../core/bun-native-fs.ts";
import { escapeHtml } from "./html-escape.ts";
import { docEyebrow, docSearchText } from "./labels.ts";
import { githubSourceUrl, type DocsPreviewOptions } from "./options.ts";

/**
 * Returns true when a Marked token has an href that can be rewritten.
 *
 * @param {Token} token - Marked token.
 * @returns {boolean} Whether the token is a link or image token.
 */
function isHrefToken(token: Token): token is Tokens.Link | Tokens.Image {
  return token.type === "link" || token.type === "image";
}

/**
 * Returns true when an href points to a bundled diagram viewer page.
 *
 * @param {string} href - Link target.
 * @returns {boolean} Whether the link points at a preview diagram page.
 */
function isPreviewDiagramHref(href: string): boolean {
  return href.startsWith("diagrams/") && href.endsWith(".html");
}

/**
 * Returns true when an href points to an external web page.
 */
function isExternalWebHref(href: string): boolean {
  return /^https?:\/\//iu.test(href);
}

/**
 * Creates a Marked renderer that opens diagram and external links in a new tab.
 *
 * @returns Marked renderer.
 */
function docsPreviewRenderer(): Renderer {
  const renderer = new Renderer();
  const defaultLinkRenderer = renderer.link.bind(renderer);

  renderer.link = (token: Tokens.Link): string => {
    const linkHtml = defaultLinkRenderer(token);
    if (!isPreviewDiagramHref(token.href) && !isExternalWebHref(token.href)) return linkHtml;

    return linkHtml.replace(/^<a /, '<a target="_blank" rel="noopener" ');
  };

  return renderer;
}

/**
 * Rendered article HTML plus any diagram assets it references.
 */
export interface RenderedDocArticle {
  /**
   * Article HTML.
   */
  html: string;
  /**
   * Rendered SVG assets needed by this article.
   */
  diagramAssets: MermaidPreviewAsset[];
}

/**
 * Renders one Markdown doc to HTML and rewrites selected local doc links.
 *
 * @param {MarkdownDoc} doc - Document to render.
 * @param {Map<string, string>} knownIds - Document ids keyed by path.
 * @param {DocsPreviewOptions} options - Render options.
 * @returns {Promise<RenderedDocArticle>} Rendered HTML article and diagram assets.
 */
export async function renderDocArticle(
  doc: MarkdownDoc,
  knownIds: Map<string, string>,
  options: DocsPreviewOptions,
): Promise<RenderedDocArticle> {
  const markdown = await readText(markdownSourcePath(doc));
  const githubUrl = githubSourceUrl(doc, options.github);
  const icon = projectIconAsset(doc.project);
  const diagramAssets: MermaidPreviewAsset[] = [];
  const body = marked.parse(markdown, {
    async: false,
    gfm: true,
    renderer: docsPreviewRenderer(),
    walkTokens(token: Token): void {
      if (!isHrefToken(token)) return;

      const targetId = localMarkdownTargetId(doc, token.href, knownIds);
      if (targetId) token.href = `#${targetId}`;

      const diagramTarget = localMermaidTarget(doc, token.href);
      if (diagramTarget) {
        token.href = diagramTarget.href;
        diagramAssets.push(diagramTarget);
      }
    },
  });

  return {
    diagramAssets,
    html: `
    <article
      id="${doc.id}"
      class="doc${githubUrl ? " has-github" : ""}${icon ? " has-project-icon" : ""}"
      data-doc-title="${escapeHtml(docLinkLabel(doc))}"
      data-doc-search="${escapeHtml(docSearchText(doc))}"
      ${projectIconDataAttrs(icon)}
    >
      <header class="doc-header">
        ${projectIconHtml(icon)}
        <div class="doc-heading">
          <p class="doc-eyebrow">${escapeHtml(docEyebrow(doc))}</p>
          <h2>${escapeHtml(docLinkLabel(doc))}</h2>
          <p class="doc-path">${escapeHtml(doc.input)}</p>
        </div>
        ${githubLinkHtml(githubUrl)}
      </header>
      <details class="doc-source">
        <summary><span>Open source</span></summary>
        <div class="source-toolbar">
          <span>Markdown</span>
          <button type="button" data-copy-source>Copy</button>
        </div>
        <pre><code>${escapeHtml(markdown)}</code></pre>
      </details>
      <div class="doc-body">
        ${body}
      </div>
    </article>
  `,
  };
}

function projectIconDataAttrs(icon: ProjectIconPreviewAsset | null): string {
  if (!icon) return "";

  return `data-icon-standard="${escapeHtml(icon.href)}"`;
}

function projectIconHtml(icon: ProjectIconPreviewAsset | null): string {
  if (!icon) return "";

  return `<img class="project-icon doc-project-icon" src="${escapeHtml(icon.href)}" data-project-icon data-icon-standard="${escapeHtml(icon.href)}" alt="" aria-hidden="true">`;
}

function githubLinkHtml(githubUrl: string | null): string {
  if (!githubUrl) return "";

  return `<a class="github-link" href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener">GitHub</a>`;
}
