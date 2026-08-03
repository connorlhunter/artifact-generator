/**
 * Cleanup callback installed on the preview window.
 */
type CleanupFn = () => void;

/**
 * Searchable text collected from one rendered document.
 */
interface PreviewSearchEntry {
  bodyText: string;
  normalizedText: string;
}

/**
 * Shared state used by the inlined docs preview browser client.
 */
interface PreviewState {
  activeArticleId: string;
  activeHeadings: HTMLElement[];
  articleById: Map<string, HTMLElement>;
  articles: HTMLElement[];
  cleanupKey: symbol;
  controller: AbortController;
  docLayout: HTMLElement | null;
  docNav: HTMLElement | null;
  main: HTMLElement | null;
  navControls: HTMLElement | null;
  navControlsHandle: HTMLButtonElement | null;
  navResizeHandle: HTMLButtonElement | null;
  navGroups: HTMLElement[];
  navHeadingLinks: HTMLElement | null;
  navCount: HTMLElement | null;
  navLinks: HTMLAnchorElement[];
  navSections: HTMLElement[];
  pageOutline: HTMLElement | null;
  outlineLinks: HTMLElement | null;
  outlineResizeHandle: HTMLButtonElement | null;
  outlineTitle: HTMLElement | null;
  mobileNavMagnetLockHeight: number | null;
  pendingFrame: number;
  pendingMobileNavMagnet: boolean;
  pendingMobileNavHeight: number | null;
  pendingResizeFrame: number;
  pendingSearchFrame: number;
  projectFavicon: HTMLLinkElement | null;
  projectIcons: HTMLImageElement[];
  resetTimers: Set<number>;
  searchEmpty: HTMLElement | null;
  searchByArticleId: Map<string, PreviewSearchEntry>;
  searchInput: HTMLInputElement | null;
  signal: AbortSignal;
  schemeToggle: HTMLButtonElement | null;
}
