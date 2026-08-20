import { describe, expect, test } from "bun:test";
import { renderDiagramPreviewPage } from "../../scripts/docs/preview/diagram-page-html.ts";
import { renderPageHtml } from "../../scripts/docs/preview/page-html.ts";
import {
  buildNavHeadingLinks,
  syncHeadingLinkState,
  type HeadingLinkState,
} from "../../scripts/docs/preview/browser/heading-links.ts";
import {
  loadDocsPreviewClientScript,
  resolveBrowserScriptDir,
  stripBrowserModuleSyntax,
  stripSourceMapComment,
} from "../../scripts/docs/preview/client.ts";
import { loadDocsPreviewStyles, resolveStylesPath } from "../../scripts/docs/preview/styles.ts";

interface FakeHeadingLink {
  attributes: Map<string, string>;
  classes: Set<string>;
  classList: {
    toggle(name: string, force?: boolean): boolean;
  };
  hash: string;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
}

function fakeHeadingLink(hash: string): FakeHeadingLink {
  const attributes = new Map<string, string>();
  const classes = new Set<string>();

  return {
    attributes,
    classes,
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
        return classes.has(name);
      },
    },
    hash,
    removeAttribute(name) {
      attributes.delete(name);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
}

describe("docs preview assets", () => {
  test("shows the latest document update date beneath the document count", () => {
    const html = renderPageHtml({
      articlesHtml: "<article>Docs</article>",
      clientScript: "",
      documentCount: 3,
      lastUpdated: "2026-08-18",
      navigationHtml: "",
      pageTitle: "Project docs",
      projectIcon: null,
      styles: "",
      title: "Project docs",
    });

    expect(html).toContain('class="nav-count" data-nav-count aria-live="polite">3 documents');
    expect(html).toContain(
      'class="nav-updated">Updated <time datetime="2026-08-18">August 18, 2026</time>',
    );
  });

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
      ".nav-controls-handle",
      ".is-nav-controls-collapsed",
      ".github-link",
      ".scheme-toggle",
      ".project-icon",
      ".nav-panel",
      ".nav-resize-handle",
      ".outline-resize-handle",
      ".is-nav-magnetized",
      ".is-desktop-nav-magnetized",
      ".is-desktop-outline-magnetized",
      ".is-nav-controls-magnetized",
      ".layout.is-desktop-nav-collapsed",
      ".layout.is-desktop-outline-collapsed",
      "--nav-drag-width",
      "--outline-drag-width",
      "--nav-inline-padding: 2.25rem",
      "--drawer-handle-thickness: 0.375rem",
      "--drawer-handle-side-thickness: 0.5rem",
      "--outline-inline-padding: 2.25rem",
      "width: var(--drawer-handle-side-thickness)",
      "height: var(--drawer-handle-thickness)",
      "opacity: 0",
      "overflow-x: hidden",
      "width: calc(var(--nav-column-width) - var(--nav-inline-padding))",
      "margin-left: calc(var(--nav-drag-width, var(--nav-column-width)) - var(--nav-column-width))",
      "width: calc(var(--outline-column-width) - var(--outline-inline-padding))",
      "grid-template-columns: 0 minmax(0, 1fr)",
      "height: 100dvh",
      "-webkit-overflow-scrolling: touch",
      "scrollbar-gutter: stable",
      "@media (prefers-reduced-motion: reduce)",
      "@media print",
      "break-before: page",
      "background: #f4f6f8",
      "color: #17202a",
      "background: #eef1f4",
      "--surface-interactive",
      "--search-match-bg",
      "--search-match-border",
      "--selection-bg",
      "::selection",
      ".search-highlight",
      ".nav-search-context",
      ".nav-section.is-active > h3",
      ".nav-heading-links",
      ".nav-heading-link.is-active",
      ".doc.is-search-match",
      "background: var(--table-heading-bg)",
      "border: 1px solid var(--code-border)",
    ].forEach((styleHook) => {
      expect(docsPreviewStyles).toContain(styleHook);
    });

    [':root[data-scheme="atlas"]', ':root[data-scheme="harbor"]'].forEach((schemeHook) => {
      expect(docsPreviewStyles).toContain(schemeHook);
    });

    expect(docsPreviewStyles).toContain(
      ".nav-controls.is-nav-controls-collapsed .nav-controls-content {\n    visibility: visible;",
    );
    expect(docsPreviewStyles).toContain(".nav-controls-handle {\n    display: none;");
    expect(docsPreviewStyles).toContain("nav.is-desktop-nav-collapsed > :not(.nav-resize-handle)");
    expect(docsPreviewStyles).toContain(".is-resizing-nav .nav-resize-handle");
    expect(docsPreviewStyles).toContain(".is-resizing-desktop-outline .outline-resize-handle");
    expect(docsPreviewStyles).toContain("opacity var(--motion-fast)");
    expect(docsPreviewStyles).toContain("nav:hover .nav-resize-handle");
    expect(docsPreviewStyles).toContain(".nav-controls:hover .nav-controls-handle");
    expect(docsPreviewStyles).toContain(".page-outline:hover + .outline-resize-handle");
    expect(docsPreviewStyles).toContain("background: transparent");
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
    expect(script).toContain("state.pendingFrame = 0");
    expect(script).toContain("state.signal.aborted");
    expect(script).toContain("pendingResizeFrame");
    expect(script).toContain("pendingSearchFrame");
    expect(script).toContain("cancelPendingMobileNavResize");
    expect(script).toContain("No matching docs");
    expect(script).toContain("Clear or change the search");
    expect(script).toContain("wireSchemeToggle");
    expect(script).toContain("wireFullscreenGesture");
    expect(script).toContain("connorhunter.file-viewer.enter-fullscreen");
    expect(script).toContain('addEventListener("dblclick"');
    expect(script).toContain('addEventListener("pointerup"');
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
    expect(script).toContain("trustedEmbeddingOrigin");
    expect(script).toContain("window.parent.postMessage");
    expect(script).toContain('addEventListener("message"');
    expect(script).toContain("event.source !== window.parent");
    expect(script).toContain("event.origin !== parentOrigin");
    expect(script).toContain('addEventListener("storage"');
    expect(script).toContain("wireMobileNavResize");
    expect(script).toContain("wireNavControlsResize");
    expect(script).toContain("wireDesktopNavResize");
    expect(script).toContain("wireDesktopOutlineResize");
    expect(script).toContain("desktopOutlineExpandedWidth");
    expect(script).toContain("cssVariableWidth");
    expect(script).toContain("hasDraggedOutlineWidth");
    expect(script).toContain("expandedWidth = usableExpandedWidth();");
    expect(script).toContain("updateActive = true");
    expect(script).toContain("if (updateActive)");
    expect(script).toContain("magneticPosition");
    expect(script).toContain("navMagnetDistance = 28");
    expect(script).toContain("navMagnetReleaseDistance = 44");
    expect(script).toContain("mobileNavSnapHeights");
    expect(script).toContain("nearestMobileNavSnapHeight");
    expect(script).toContain("nextMobileNavSnapHeight");
    expect(script).toContain("docs.preview.navigation.controls.collapsed");
    expect(script).toContain("docs.preview.navigation.collapsed");
    expect(script).toContain("docs.preview.outline.collapsed");
    expect(script).toContain("is-desktop-nav-collapsed");
    expect(script).toContain("is-desktop-outline-collapsed");
    expect(script).toContain("wireDocNavigation");
    expect(script).toContain("wireOutlineNavigation");
    expect(script).toContain("previewScrollBehavior");
    expect(script).toContain("scrollTargetIntoContainer");
    expect(script).toContain("mainReadingTop");
    expect(script).toContain("mainScrollAnchor");
    expect(script).toContain("isMainAtScrollEnd");
    expect(script).toContain("syncActiveNavigation");
    expect(script).toContain("buildNavHeadingLinks");
    expect(script).toContain("syncHeadingLinkState");
    expect(script).toContain("navHeadingLink");
    expect(script).toContain("state.navHeadingLinks");
    expect(script).toContain('section.classList.toggle("is-active"');
    expect(script).toContain('link.setAttribute("aria-current", "true")');
    expect(script).toContain("window.history.pushState");
    expect(script).toContain("activateHashTarget");
    expect(script).toContain("setPointerCapture");
    expect(script).toContain("hasPointerCapture");
    expect(script).toContain('window.addEventListener("pointermove"');
    expect(script).toContain('window.addEventListener("pointerup"');
    expect(script).toContain("requestMobileNavResize");
    expect(script).toContain("state.docNav.scrollTop = 0");
    expect(script).toContain("mobileNavCollapsedHeight");
    expect(script).toContain("is-nav-collapsed");
    expect(script).toContain("jumpMainToArticle");
    expect(script).toContain("jumpMainToTarget");
    expect(script).toContain("createPreviewSearchEntry");
    expect(script).toContain("searchByArticleId");
    expect(script).toContain("requestSearchUpdate");
    expect(script).toContain("highlightSearchTerms");
    expect(script).toContain("data-search-highlight");
    expect(script).toContain("data-doc-search-context");
    expect(script).toContain("of ${total} documents");
    expect(script).toContain("docs.preview.scheme");
    expect(script).toContain("portfolio.theme.scheme");
    expect(script).toContain("connorhunter.me");

    const listenerCount = script.match(/\.addEventListener\(/gu)?.length ?? 0;
    const listenerSignalCount = script.match(/signal: state\.signal/gu)?.length ?? 0;
    expect(listenerSignalCount).toBe(listenerCount);
  });

  test("keeps browser client behavior split by responsibility", async () => {
    const script = await loadDocsPreviewClientScript();

    expect(script).toContain("createState");
    expect(script).toContain("installCleanup");
    expect(script).toContain("buildOutline");
    expect(script).toContain("buildNavHeadingLinks");
    expect(script).toContain("requestActiveUpdate");
    expect(script).toContain("wireDocNavigation");
    expect(script).toContain("wireOutlineNavigation");
    expect(script).toContain("applySearch");
    expect(script).toContain("requestSearchUpdate");
    expect(script).toContain("wireSourceButtons");
    expect(script).toContain("wireFullscreenGesture");
    expect(script).toContain("wireSchemeToggle");
    expect(script).toContain("wireMobileNavResize");
    expect(script).toContain("wireDesktopOutlineResize");
    expect(script).toContain("startDocsPreviewClient");
  });

  test("moves active heading state between left navigation links", () => {
    const first = fakeHeadingLink("#first");
    const second = fakeHeadingLink("#second");
    const links = { querySelectorAll: () => [first, second] };

    expect(
      syncHeadingLinkState(links as unknown as HTMLElement, { id: "second" } as HTMLElement),
    ).toBe(second as unknown as HTMLAnchorElement);
    expect(first.classes.has("is-active")).toBe(false);
    expect(first.attributes.has("aria-current")).toBe(false);
    expect(second.classes.has("is-active")).toBe(true);
    expect(second.attributes.get("aria-current")).toBe("true");

    expect(
      syncHeadingLinkState(links as unknown as HTMLElement, { id: "first" } as HTMLElement),
    ).toBe(first as unknown as HTMLAnchorElement);
    expect(first.classes.has("is-active")).toBe(true);
    expect(second.classes.has("is-active")).toBe(false);
    expect(second.attributes.has("aria-current")).toBe(false);
  });

  test("builds active document headings beneath its left navigation link", () => {
    interface BuiltHeadingLink {
      className: string;
      dataset: Record<string, string>;
      href: string;
      textContent: string;
    }

    interface HeadingLinksContainer {
      append(link: BuiltHeadingLink): void;
      children: BuiltHeadingLink[];
      hidden: boolean;
      replaceChildren(): void;
      setAttribute(name: string, value: string): void;
    }

    const children: BuiltHeadingLink[] = [];
    const labels = new Map<string, string>();
    const container: HeadingLinksContainer = {
      append(link) {
        children.push(link);
      },
      children,
      hidden: true,
      replaceChildren() {
        children.length = 0;
      },
      setAttribute(name, value) {
        labels.set(name, value);
      },
    };
    const insertion: { links?: HeadingLinksContainer } = {};
    const state = {
      activeHeadings: [
        { id: "overview-heading-0", tagName: "H1", textContent: "Portfolio" },
        { id: "overview-heading-1", tagName: "H2", textContent: "What This App Owns" },
      ],
      navHeadingLinks: container,
      navLinks: [
        {
          after(links: HeadingLinksContainer) {
            insertion.links = links;
          },
          dataset: { docId: "overview" },
        },
      ],
    };

    buildNavHeadingLinks(
      state as unknown as HeadingLinkState,
      { dataset: { docTitle: "Overview" }, id: "overview" } as unknown as HTMLElement,
      () => ({ className: "", dataset: {}, href: "", textContent: "" }) as HTMLAnchorElement,
    );

    expect(insertion.links).toBe(container);
    expect(container.hidden).toBe(false);
    expect(labels.get("aria-label")).toBe("Sections in Overview");
    expect(children.map((link) => link.href)).toEqual([
      "#overview-heading-0",
      "#overview-heading-1",
    ]);
    expect(children.map((link) => link.className)).toEqual([
      "nav-heading-link depth-h1",
      "nav-heading-link depth-h2",
    ]);
    expect(children.every((link) => link.dataset.navHeadingLink === "")).toBe(true);
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
    expect(stripBrowserModuleSyntax("export function example() {}\n")).toBe(
      "function example() {}\n",
    );
  });
});
