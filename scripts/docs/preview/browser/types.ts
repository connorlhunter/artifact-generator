/**
 * Cleanup callback installed on the preview window.
 */
type CleanupFn = () => void;

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
  navLinks: HTMLAnchorElement[];
  navSections: HTMLElement[];
  pageOutline: HTMLElement | null;
  outlineLinks: HTMLElement | null;
  outlineTitle: HTMLElement | null;
  mobileNavMagnetLockHeight: number | null;
  pendingFrame: number;
  pendingMobileNavMagnet: boolean;
  pendingMobileNavHeight: number | null;
  pendingResizeFrame: number;
  projectFavicon: HTMLLinkElement | null;
  projectIcons: HTMLImageElement[];
  resetTimers: Set<number>;
  searchEmpty: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  signal: AbortSignal;
  schemeToggle: HTMLButtonElement | null;
}
