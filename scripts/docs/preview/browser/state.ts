type CleanupWindow = Window & Record<symbol, CleanupFn | undefined>;

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

  return {
    activeArticleId: "",
    activeHeadings: [],
    articleById: new Map(articles.map((article) => [article.id, article])),
    articles,
    cleanupKey,
    controller,
    docNav: document.querySelector<HTMLElement>("[data-doc-nav]"),
    main: document.querySelector<HTMLElement>("[data-doc-main]"),
    navControls: document.querySelector<HTMLElement>("[data-nav-controls]"),
    navResizeHandle: document.querySelector<HTMLButtonElement>("[data-nav-resize-handle]"),
    navGroups: Array.from(document.querySelectorAll<HTMLElement>("[data-nav-group]")),
    navLinks,
    navSections: Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]")),
    pageOutline: document.querySelector<HTMLElement>("[data-page-outline]"),
    outlineLinks: document.querySelector<HTMLElement>("[data-outline-links]"),
    outlineTitle: document.querySelector<HTMLElement>("[data-outline-title]"),
    pendingFrame: 0,
    pendingMobileNavHeight: null,
    pendingResizeFrame: 0,
    projectFavicon: document.querySelector<HTMLLinkElement>("[data-project-favicon]"),
    projectIcons: Array.from(document.querySelectorAll<HTMLImageElement>("[data-project-icon]")),
    resetTimers: new Set(),
    searchEmpty: document.querySelector<HTMLElement>("[data-search-empty]"),
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
