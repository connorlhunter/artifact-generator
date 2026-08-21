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
import {
  formatUpdatedDate,
  type VersionedArtifactMetadata,
} from "../../core/versioned-artifact-metadata.ts";
import { parseCentralizedDocSource, parseDocSource } from "../doc-metadata.ts";
import { escapeHtml } from "./html-escape.ts";
import { docEyebrow, docSearchText } from "./labels.ts";
import { githubSourceUrl, type DocsPreviewOptions } from "./options.ts";

/**
 * Returns true when a Marked token has an href that can be rewritten.
 *
 * @param {Token} token - Marked token.
 * @returns {boolean} Whether the token is a link or image token.
 */
function isLinkToken(token: Token): token is Tokens.Link {
  return token.type === "link";
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
 * Returns true when a rendered Markdown destination uses an allowed local or external form.
 */
function isSafeMarkdownHref(href: string, image = false): boolean {
  if (/[\u0000-\u001f\u007f\\]/u.test(href) || href.startsWith("//")) return false;
  if (/^(?:\/|#|\?|\.\.?\/)/u.test(href)) return true;
  if (!/^[a-z][a-z\d+.-]*:/iu.test(href)) return true;

  return image ? /^https?:/iu.test(href) : /^(?:https?:|mailto:|tel:)/iu.test(href);
}

/**
 * Creates a Marked renderer that opens diagram and external links in a new tab.
 *
 * @returns Marked renderer.
 */
function docsPreviewRenderer(): Renderer {
  const renderer = new Renderer();

  renderer.html = ({ text }: Tokens.HTML | Tokens.Tag): string => escapeHtml(text);

  renderer.link = (token: Tokens.Link): string => {
    if (!isSafeMarkdownHref(token.href)) return renderer.parser.parseInline(token.tokens);

    const text = renderer.parser.parseInline(token.tokens);
    const titleAttribute = token.title ? ` title="${escapeHtml(token.title)}"` : "";
    const targetAttributes =
      isPreviewDiagramHref(token.href) || isExternalWebHref(token.href)
        ? ' target="_blank" rel="noopener"'
        : "";

    return `<a${targetAttributes} href="${escapeHtml(token.href)}"${titleAttribute}>${text}</a>`;
  };

  renderer.image = (token: Tokens.Image): string => {
    if (!isSafeMarkdownHref(token.href, true)) return escapeHtml(token.text);

    const titleAttribute = token.title ? ` title="${escapeHtml(token.title)}"` : "";

    return `<img src="${escapeHtml(token.href)}" alt="${escapeHtml(token.text)}"${titleAttribute}>`;
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
  /** ISO date shown for this document page. */
  lastUpdated: string;
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
  documentMetadata?: VersionedArtifactMetadata,
): Promise<RenderedDocArticle> {
  const sourcePath = markdownSourcePath(doc);
  const sourceMarkdown = await readText(sourcePath);
  const parsedSource = documentMetadata
    ? { body: parseCentralizedDocSource(sourceMarkdown, doc.input), metadata: documentMetadata }
    : parseDocSource(sourceMarkdown, doc.input);
  const { body: markdown, metadata } = parsedSource;
  const githubUrl = githubSourceUrl(doc, options.github);
  const icon = projectIconAsset(doc.project);
  const diagramAssets: MermaidPreviewAsset[] = [];
  const body = marked.parse(markdown, {
    async: false,
    gfm: true,
    renderer: docsPreviewRenderer(),
    walkTokens(token: Token): void {
      if (!isLinkToken(token)) return;

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
    lastUpdated: metadata.lastUpdated,
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
          <p class="doc-metadata"><span>Updated <time datetime="${escapeHtml(metadata.lastUpdated)}">${escapeHtml(formatUpdatedDate(metadata.lastUpdated))}</time></span></p>
        </div>
        ${githubLinkHtml(githubUrl)}
      </header>
      <details class="doc-source">
        <summary><span>Open source</span></summary>
        <div class="source-toolbar">
          <span>Markdown</span>
          <button type="button" data-copy-source>Copy</button>
        </div>
        <pre><code>${escapeHtml(sourceMarkdown)}</code></pre>
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
