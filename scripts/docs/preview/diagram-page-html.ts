import { dirname, relative } from "node:path";
import { normalizeRepoPath, type MermaidPreviewAsset } from "../docs-utils.ts";
import { escapeHtml } from "./html-escape.ts";

/**
 * Renders a static diagram viewer page for one copied SVG.
 *
 * Raw SVG documents cannot reliably set a project favicon. The viewer page
 * keeps the SVG as the primary artifact while giving browser tabs normal HTML
 * document chrome.
 *
 * @param {MermaidPreviewAsset} asset - Diagram asset copied into the preview.
 * @returns {string} Standalone diagram viewer HTML.
 */
export function renderDiagramPreviewPage(asset: MermaidPreviewAsset): string {
  const svgHref = normalizeRepoPath(relative(dirname(asset.pageTarget), asset.target));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(asset.title)}</title>
  ${diagramFaviconHtml(asset)}
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f6f8;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #667085;
      --border: #d8dee8;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #06111a;
        --panel: #0b1a24;
        --text: #eaf6ff;
        --muted: #89a6b8;
        --border: #163041;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 0.9375rem/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      min-height: 100vh;
      padding: clamp(1rem, 3vw, 2rem);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 0 auto 1rem;
      max-width: 90rem;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.125rem, 2vw, 1.5rem);
      line-height: 1.2;
    }

    a {
      color: inherit;
      text-underline-offset: 0.2em;
    }

    .diagram-frame {
      min-height: calc(100vh - 7rem);
      max-width: 90rem;
      margin: 0 auto;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--panel);
      overflow: auto;
    }

    img {
      display: block;
      width: 100%;
      min-width: min(52rem, 100%);
      height: auto;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(asset.title)}</h1>
      <a href="${escapeHtml(svgHref)}" target="_blank" rel="noopener">Open SVG</a>
    </header>
    <div class="diagram-frame">
      <img src="${escapeHtml(svgHref)}" alt="${escapeHtml(asset.title)} diagram">
    </div>
  </main>
</body>
</html>`;
}

function diagramFaviconHtml(asset: MermaidPreviewAsset): string {
  if (!asset.projectIcon) return "";

  const standardHref = normalizeRepoPath(
    relative(dirname(asset.pageTarget), asset.projectIcon.target),
  );

  return `<link rel="icon" type="image/svg+xml" href="${escapeHtml(standardHref)}" data-icon-standard="${escapeHtml(standardHref)}">`;
}
