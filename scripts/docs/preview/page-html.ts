import type { ProjectIconPreviewAsset } from "../docs-utils.ts";
import { escapeHtml } from "./html-escape.ts";

/**
 * Complete standalone page inputs for the docs preview.
 */
export interface DocsPreviewPageHtml {
  /**
   * Rendered Markdown articles.
   */
  articlesHtml: string;
  /**
   * Script tag containing preview browser behavior.
   */
  clientScript: string;
  /**
   * Number of Markdown documents in the preview.
   */
  documentCount: number;
  /**
   * Rendered sidebar navigation.
   */
  navigationHtml: string;
  /**
   * Browser title for the generated preview page.
   */
  pageTitle: string;
  /**
   * Optional project icon used as the generated preview favicon.
   */
  projectIcon: ProjectIconPreviewAsset | null;
  /**
   * CSS to inline into the standalone HTML page.
   */
  styles: string;
  /**
   * Visible title shown in the preview navigation chrome.
   */
  title: string;
}

/**
 * Renders the complete standalone preview HTML document.
 *
 * @param {DocsPreviewPageHtml} page - Pre-rendered page fragments.
 * @returns {string} Standalone preview HTML.
 */
export function renderPageHtml(page: DocsPreviewPageHtml): string {
  return `<!doctype html>
<html lang="en" data-scheme="atlas">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.pageTitle)}</title>
  ${projectFaviconHtml(page.projectIcon)}
  <style>
${page.styles}
  </style>
  <!-- Inline first-paint theme bootstrap prevents a light/dark flash before the preview client loads. -->
  <script>
${themeBootstrapScript()}
  </script>
</head>
<body>
  <div class="layout" data-doc-layout>
    <nav aria-label="Documentation" data-doc-nav>
      <div class="nav-panel">
        <div class="nav-controls" data-nav-controls>
          <div class="nav-controls-content" id="navigation-controls" data-nav-controls-content>
            <div class="nav-header">
              <div class="nav-title-row">
                <div class="nav-brand">
                  ${titleProjectIconHtml(page.projectIcon)}
                  <h1>${escapeHtml(page.title)}</h1>
                </div>
                <button class="scheme-toggle" type="button" data-scheme-toggle aria-label="Use Paper color scheme">
                  <span class="scheme-toggle-dot" aria-hidden="true"></span>
                </button>
              </div>
              <p class="nav-count" data-nav-count aria-live="polite">${page.documentCount} documents</p>
            </div>
            <label class="nav-search">
              <span>Search</span>
              <input type="search" data-doc-search-input placeholder="Search documentation" autocomplete="off">
            </label>
            <p class="search-empty" data-search-empty hidden>No matching docs</p>
          </div>
          <button class="nav-controls-handle" type="button" data-nav-controls-handle aria-label="Hide navigation controls" aria-controls="navigation-controls" aria-expanded="true" title="Hide navigation controls">
            <span aria-hidden="true"></span>
          </button>
        </div>
        ${page.navigationHtml}
        <div class="nav-heading-links" data-nav-heading-links role="group" aria-label="Sections in current document" hidden></div>
      </div>
      <button class="nav-resize-handle" type="button" data-nav-resize-handle aria-label="Resize navigation panel" aria-expanded="true" title="Resize navigation panel">
        <span aria-hidden="true"></span>
      </button>
    </nav>
    <main data-doc-main>
      ${page.articlesHtml}
    </main>
    <aside class="page-outline" aria-label="On this page" data-page-outline>
      <div class="outline-panel" id="page-outline-panel">
        <p class="outline-kicker">On this page</p>
        <h2 class="outline-title" data-outline-title>Current doc</h2>
        <div class="outline-links" data-outline-links></div>
      </div>
    </aside>
    <button class="outline-resize-handle" type="button" data-outline-resize-handle aria-label="Collapse on this page panel" aria-controls="page-outline-panel" aria-expanded="true" title="Collapse on this page panel">
      <span aria-hidden="true"></span>
    </button>
  </div>
  ${page.clientScript}
</body>
</html>`;
}

/**
 * Renders the first-paint theme bootstrap shared with product pages.
 *
 * This runs before the generated preview client so `data-scheme` matches the
 * saved or OS-preferred theme before the browser paints the page. The script is
 * intentionally inline and built from repo-owned constants only.
 *
 * @returns {string} Inline browser script.
 */
function themeBootstrapScript(): string {
  return `(() => {
  const supportedThemes = ["atlas","paper","citrine","harbor","midnight","onyx","rose","tide","ember","quartz"];
  const storageKey = "connorhunter.theme.scheme";
  const legacyKeys = ["docs.preview.scheme","portfolio.theme.scheme"];
  const cookieName = storageKey;

  function validTheme(value) {
    return supportedThemes.includes(value) ? value : null;
  }

  function storedTheme(key) {
    try {
      return validTheme(localStorage.getItem(key));
    } catch (error) {
      return null;
    }
  }

  function cookieTheme() {
    try {
      const prefix = cookieName + "=";
      const rows = document.cookie ? document.cookie.split("; ") : [];

      for (const row of rows) {
        if (row.startsWith(prefix)) {
          return validTheme(decodeURIComponent(row.slice(prefix.length)));
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function legacyTheme() {
    for (const key of legacyKeys) {
      const theme = storedTheme(key);
      if (theme) return theme;
    }

    return null;
  }

  function preferredTheme() {
    try {
      return matchMedia("(prefers-color-scheme: dark)").matches ? "harbor" : "atlas";
    } catch (error) {
      return "atlas";
    }
  }

  document.documentElement.dataset.scheme =
    storedTheme(storageKey) || cookieTheme() || legacyTheme() || preferredTheme();
})();`;
}

/**
 * Renders the project favicon link for the generated preview page.
 *
 * @param {ProjectIconPreviewAsset | null} icon - Primary project icon.
 * @returns {string} Favicon HTML when a project icon exists.
 */
function projectFaviconHtml(icon: ProjectIconPreviewAsset | null): string {
  if (!icon) return "";

  return `<link rel="icon" type="image/svg+xml" href="${escapeHtml(icon.href)}" data-project-favicon data-icon-standard="${escapeHtml(icon.href)}">`;
}

/**
 * Renders the project icon beside the preview title.
 *
 * @param {ProjectIconPreviewAsset | null} icon - Primary project icon.
 * @returns {string} Title icon HTML when a project icon exists.
 */
function titleProjectIconHtml(icon: ProjectIconPreviewAsset | null): string {
  if (!icon) return "";

  return `<img class="project-icon title-project-icon" src="${escapeHtml(icon.href)}" data-project-icon data-icon-standard="${escapeHtml(icon.href)}" alt="" aria-hidden="true">`;
}
