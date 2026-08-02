type CleanupWindow = Window & Record<symbol, CleanupFn | undefined>;

/**
 * Compacts rendered text while preserving its display casing.
 */
function compactPreviewSearchText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * Builds the full-text index entry for one rendered document.
 */
function createPreviewSearchEntry(article: HTMLElement): PreviewSearchEntry {
  const headingText = compactPreviewSearchText(
    article.querySelector<HTMLElement>(".doc-heading")?.textContent ?? "",
  );
  const bodyText = compactPreviewSearchText(
    article.querySelector<HTMLElement>(".doc-body")?.textContent ?? "",
  );
  const searchableText = compactPreviewSearchText(
    [article.dataset.docSearch ?? "", headingText, bodyText].join(" "),
  );

  return {
    bodyText: compactPreviewSearchText([headingText, bodyText].join(" ")),
    normalizedText: searchableText.toLowerCase(),
  };
}

/**
 * Collects DOM references and shared mutable state for the preview client.
 */
function createState(): PreviewState {
  const cleanupKey = Symbol.for("docs.preview.cleanup");
  const previousCleanup = (window as unknown as CleanupWindow)[cleanupKey];
  if (typeof previousCleanup === "function") previousCleanup();

  const controller = new AbortController();
  const articles = Array.from(document.querySelectorAll<HTMLElement>("[data-doc-title]"));
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-doc-link]"));
  const searchByArticleId = new Map(
    articles.map((article): [string, PreviewSearchEntry] => [
      article.id,
      createPreviewSearchEntry(article),
    ]),
  );

  return {
    activeArticleId: "",
    activeHeadings: [],
    articleById: new Map(articles.map((article) => [article.id, article])),
    articles,
    cleanupKey,
    controller,
    docLayout: document.querySelector<HTMLElement>("[data-doc-layout]"),
    docNav: document.querySelector<HTMLElement>("[data-doc-nav]"),
    main: document.querySelector<HTMLElement>("[data-doc-main]"),
    navControls: document.querySelector<HTMLElement>("[data-nav-controls]"),
    navControlsHandle: document.querySelector<HTMLButtonElement>("[data-nav-controls-handle]"),
    navResizeHandle: document.querySelector<HTMLButtonElement>("[data-nav-resize-handle]"),
    navGroups: Array.from(document.querySelectorAll<HTMLElement>("[data-nav-group]")),
    navCount: document.querySelector<HTMLElement>("[data-nav-count]"),
    navLinks,
    navSections: Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]")),
    pageOutline: document.querySelector<HTMLElement>("[data-page-outline]"),
    outlineLinks: document.querySelector<HTMLElement>("[data-outline-links]"),
    outlineResizeHandle: document.querySelector<HTMLButtonElement>("[data-outline-resize-handle]"),
    outlineTitle: document.querySelector<HTMLElement>("[data-outline-title]"),
    mobileNavMagnetLockHeight: null,
    pendingFrame: 0,
    pendingMobileNavMagnet: false,
    pendingMobileNavHeight: null,
    pendingResizeFrame: 0,
    pendingSearchFrame: 0,
    projectFavicon: document.querySelector<HTMLLinkElement>("[data-project-favicon]"),
    projectIcons: Array.from(document.querySelectorAll<HTMLImageElement>("[data-project-icon]")),
    resetTimers: new Set(),
    searchEmpty: document.querySelector<HTMLElement>("[data-search-empty]"),
    searchByArticleId,
    searchInput: document.querySelector<HTMLInputElement>("[data-doc-search-input]"),
    signal: controller.signal,
    schemeToggle: document.querySelector<HTMLButtonElement>("[data-scheme-toggle]"),
  };
}

/**
 * Stores the active cleanup function under a symbol to avoid global-name leaks.
 */
function setWindowCleanup(state: PreviewState, cleanup: CleanupFn): void {
  (window as unknown as CleanupWindow)[state.cleanupKey] = cleanup;
}

/**
 * Removes the stored cleanup function when it still belongs to this client.
 */
function clearWindowCleanup(state: PreviewState, cleanup: CleanupFn): void {
  const cleanupWindow = window as unknown as CleanupWindow;
  if (cleanupWindow[state.cleanupKey] === cleanup) {
    delete cleanupWindow[state.cleanupKey];
  }
}
