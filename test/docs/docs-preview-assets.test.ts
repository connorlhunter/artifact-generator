import { describe, expect, test } from "bun:test";
import { renderDiagramPreviewPage } from "../../scripts/docs/preview/diagram-page-html.ts";
import {
  loadDocsPreviewClientScript,
  resolveBrowserScriptDir,
  stripSourceMapComment,
} from "../../scripts/docs/preview/client.ts";
import { loadDocsPreviewStyles, resolveStylesPath } from "../../scripts/docs/preview/styles.ts";

describe("docs preview assets", () => {
  test("renders diagram viewer pages with project favicon links", () => {
    const html = renderDiagramPreviewPage({
      href: "diagrams/artifact-generator/example.html",
      pageTarget: "dist/docs-preview/diagrams/artifact-generator/example.html",
      projectIcon: {
        href: "icons/artifact-generator/mark.svg",
        project: "artifact-generator",
        source: "icons/artifact-generator/mark.svg",
        target: "dist/docs-preview/icons/artifact-generator/mark.svg",
      },
      source: "diagrams/artifact-generator/example.svg",
      svgHref: "diagrams/artifact-generator/example.svg",
      target: "dist/docs-preview/diagrams/artifact-generator/example.svg",
      title: "Example",
    });

    expect(html).toContain("<title>Example</title>");
    expect(html).toContain('href="example.svg"');
    expect(html).toContain('href="../../icons/artifact-generator/mark.svg"');
  });

  test("defines responsive preview styles", async () => {
    const docsPreviewStyles = await loadDocsPreviewStyles();

    [
      'input[type="search"]::-webkit-search-cancel-button',
      "-webkit-appearance: none",
      "background: var(--muted)",
      "-webkit-mask:",
      "width: min(100%, 61.25rem)",
      "overflow-wrap: break-word",
      "@media (max-width: 860px)",
      ".nav-controls",
      ".github-link",
      ".scheme-toggle",
      ".project-icon",
      ".nav-resize-handle",
      "height: 100dvh",
      "-webkit-overflow-scrolling: touch",
      "scrollbar-gutter: stable",
      "@media (prefers-reduced-motion: reduce)",
    ].forEach((styleHook) => {
      expect(docsPreviewStyles).toContain(styleHook);
    });

    [':root[data-scheme="atlas"]', ':root[data-scheme="harbor"]'].forEach((schemeHook) => {
      expect(docsPreviewStyles).toContain(schemeHook);
    });

    expect(docsPreviewStyles).not.toContain("transition: all");
  });

  test("resolves CSS from source and compiled module locations", () => {
    expect(resolveStylesPath("file:///repo/scripts/docs/preview/styles.ts")).toBe(
      "/repo/scripts/docs/preview/styles.css",
    );
    expect(resolveStylesPath("file:///repo/dist/scripts/docs/preview/styles.js")).toBe(
      "/repo/scripts/docs/preview/styles.css",
    );
  });

  test("loads compiled browser client behavior", async () => {
    const script = await loadDocsPreviewClientScript();

    expect(script).toContain("<script>");
    expect(script).toContain('Symbol.for("docs.preview.cleanup")');
    expect(script).not.toContain("__docsPreviewCleanup");
    expect(script).toContain("new AbortController()");
    expect(script).toContain('addEventListener("pagehide", cleanup');
    expect(script).toContain("window.cancelAnimationFrame");
    expect(script).toContain("window.clearTimeout");
    expect(script).toContain("pendingResizeFrame");
    expect(script).toContain("cancelPendingMobileNavResize");
    expect(script).toContain("No matching docs");
    expect(script).toContain("Clear or change the search");
    expect(script).toContain("wireSchemeToggle");
    expect(script).toContain("applyProjectIcons");
    expect(script).toContain("tintProjectIconSvg");
    expect(script).toContain("themedProjectIconHref");
    expect(script).toContain("data:image/svg+xml;charset=utf-8");
    expect(script).toContain("window.getComputedStyle(document.documentElement)");
    expect(script).toContain("--accent");
    expect(script).toContain("[data-project-favicon]");
    expect(script).toContain("[data-project-icon]");
    expect(script).toContain("preferredScheme");
    expect(script).toContain("standardPreferenceScheme");
    expect(script).toContain('findPreviewScheme("atlas")');
    expect(script).toContain("dimPreferenceScheme");
    expect(script).toContain('findPreviewScheme("harbor")');
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain("connorhunter.theme.scheme");
    expect(script).toContain("schemeMessageType");
    expect(script).toContain("broadcastScheme");
    expect(script).toContain("window.parent.postMessage");
    expect(script).toContain('addEventListener("message"');
    expect(script).toContain('addEventListener("storage"');
    expect(script).toContain("wireMobileNavResize");
    expect(script).toContain("wireDocNavigation");
    expect(script).toContain("wireOutlineNavigation");
    expect(script).toContain("previewScrollBehavior");
    expect(script).toContain("scrollTargetIntoContainer");
    expect(script).toContain("window.history.pushState");
    expect(script).toContain("activateHashTarget");
    expect(script).toContain("setPointerCapture");
    expect(script).toContain("hasPointerCapture");
    expect(script).toContain("requestMobileNavResize");
    expect(script).toContain("mobileNavCollapsedHeight");
    expect(script).toContain("is-nav-collapsed");
    expect(script).toContain("jumpMainToArticle");
    expect(script).toContain("jumpMainToTarget");
    expect(script).toContain("docs.preview.scheme");
    expect(script).toContain("portfolio.theme.scheme");
    expect(script).toContain("connorhunter.me");
  });

  test("keeps browser client behavior split by responsibility", async () => {
    const script = await loadDocsPreviewClientScript();

    expect(script).toContain("createState");
    expect(script).toContain("installCleanup");
    expect(script).toContain("buildOutline");
    expect(script).toContain("requestActiveUpdate");
    expect(script).toContain("wireDocNavigation");
    expect(script).toContain("wireOutlineNavigation");
    expect(script).toContain("applySearch");
    expect(script).toContain("wireSourceButtons");
    expect(script).toContain("wireSchemeToggle");
    expect(script).toContain("wireMobileNavResize");
    expect(script).toContain("startDocsPreviewClient");
  });

  test("resolves and sanitizes compiled browser script assets", () => {
    expect(resolveBrowserScriptDir("file:///repo/dist/scripts/docs/preview/client.js")).toBe(
      "/repo/dist/scripts/docs/preview/browser",
    );
    expect(resolveBrowserScriptDir("file:///repo/scripts/docs/preview/client.ts")).toContain(
      "dist/scripts/docs/preview/browser",
    );
    expect(stripSourceMapComment("const value = 1;\n//# sourceMappingURL=value.js.map")).toBe(
      "const value = 1;",
    );
  });
});
