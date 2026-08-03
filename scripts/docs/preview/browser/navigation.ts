interface ActiveArticleOptions {
  navBehavior?: ScrollBehavior;
  outlineBehavior?: ScrollBehavior;
}

const articleActivationOffset = 180;
const headingActivationOffset = 130;
const scrollEndTolerance = 2;

/**
 * Returns documents that are currently visible after filtering.
 */
function visibleArticles(state: PreviewState): HTMLElement[] {
  return state.articles.filter((article) => !article.hidden);
}

/**
 * Returns the top edge of the visible reading area inside the main pane.
 */
function mainReadingTop(state: PreviewState): number {
  if (!state.main) return 0;

  const mainRect = state.main.getBoundingClientRect();
  const nav = state.docNav;
  if (!nav || nav.classList.contains("is-nav-collapsed")) return mainRect.top;

  const navRect = nav.getBoundingClientRect();
  const horizontalOverlap =
    Math.min(navRect.right, mainRect.right) - Math.max(navRect.left, mainRect.left);
  if (horizontalOverlap <= 1 || navRect.bottom <= mainRect.top) return mainRect.top;

  return Math.min(mainRect.bottom, Math.max(mainRect.top, navRect.bottom));
}

/**
 * Places a stable activation line inside the currently visible reading area.
 */
function mainScrollAnchor(state: PreviewState, preferredOffset: number): number {
  if (!state.main) return preferredOffset;

  const mainRect = state.main.getBoundingClientRect();
  const readingTop = mainReadingTop(state);
  const visibleHeight = Math.max(0, mainRect.bottom - readingTop);
  const offset = Math.min(preferredOffset, visibleHeight * 0.35);

  return readingTop + offset;
}

/**
 * Returns whether the main reading surface is at its final scroll position.
 */
function isMainAtScrollEnd(state: PreviewState): boolean {
  if (state.main) {
    const maxScrollTop = state.main.scrollHeight - state.main.clientHeight;
    return (
      maxScrollTop > scrollEndTolerance && state.main.scrollTop >= maxScrollTop - scrollEndTolerance
    );
  }

  const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
  return maxScrollY > scrollEndTolerance && window.scrollY >= maxScrollY - scrollEndTolerance;
}

/**
 * Keeps document and section navigation states in sync.
 */
function syncActiveNavigation(state: PreviewState, id: string): void {
  let activeSection: HTMLElement | null = null;

  state.navLinks.forEach((link) => {
    const active = link.dataset.docId === id;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "true");
      activeSection = link.closest<HTMLElement>("[data-nav-section]");
    } else link.removeAttribute("aria-current");
  });

  state.navSections.forEach((section) => {
    section.classList.toggle("is-active", section === activeSection);
  });
}

/**
 * Updates the active sidebar item and rebuilds the outline for one article.
 */
function setActiveArticle(
  state: PreviewState,
  id: string,
  options: ActiveArticleOptions = {},
): void {
  const article = state.articleById.get(id);
  if (!article || article.hidden) return;

  syncActiveNavigation(state, id);

  if (state.activeArticleId !== id) {
    state.activeArticleId = id;
    syncProjectFavicon(state);
    scrollNavToActiveLink(state, id, options.navBehavior);
    buildOutline(state, article, options.outlineBehavior ?? options.navBehavior);
  }
}

/**
 * Scrolls an active nav link into the visible drawer area without hiding it
 * under the sticky mobile resize handle.
 */
function scrollNavLinkIntoView(
  state: PreviewState,
  link: HTMLAnchorElement,
  behavior: ScrollBehavior = previewScrollBehavior(),
): void {
  if (!state.docNav) return;

  const controlsHeight = state.navControls?.getBoundingClientRect().height ?? 0;
  const handleHeight = state.navResizeHandle?.getBoundingClientRect().height ?? 0;

  scrollTargetIntoContainer(state.docNav, link, {
    align: "center",
    behavior,
    bottomPadding: handleHeight + 12,
    topPadding: controlsHeight + 12,
  });
}

/**
 * Keeps active-link auto-scroll scoped to layouts that actually have a
 * separate sidebar scroll area, such as the mobile constrained nav panel.
 */
function scrollNavToActiveLink(
  state: PreviewState,
  id: string,
  behavior: ScrollBehavior = previewScrollBehavior(),
): void {
  if (!state.docNav || state.docNav.scrollHeight <= state.docNav.clientHeight) return;

  if (id === state.articles[0]?.id) {
    scrollContainerTo(state.docNav, 0, behavior);
    return;
  }

  const activeLink = state.navLinks.find((link) => link.dataset.docId === id);
  if (activeLink) scrollNavLinkIntoView(state, activeLink, behavior);
}

/**
 * Jumps the main pane to a document selected by nav or search.
 */
function jumpMainToArticle(
  state: PreviewState,
  article: HTMLElement,
  options: MainJumpOptions = {},
): void {
  jumpMainToTarget(state, article, options);
}

/**
 * Finds the document closest to the current main scroll position.
 */
function currentArticle(state: PreviewState): HTMLElement | undefined {
  const visible = visibleArticles(state);
  if (isMainAtScrollEnd(state)) return visible.at(-1);

  const activationLine = mainScrollAnchor(state, articleActivationOffset);
  let current = visible[0];

  for (const article of visible) {
    if (article.getBoundingClientRect().top <= activationLine) current = article;
    else break;
  }

  return current;
}

/**
 * Syncs the active document from the current scroll position.
 */
function updateActiveArticle(state: PreviewState): void {
  const article = currentArticle(state);
  if (article) setActiveArticle(state, article.id);
  state.pendingFrame = 0;
}

/**
 * Activates and scrolls to the document named by the current URL hash.
 */
function activateHashTarget(state: PreviewState): boolean {
  const hashId = window.location.hash.slice(1);
  const article = state.articleById.get(hashId);
  if (article && !article.hidden) {
    setActiveArticle(state, article.id);
    jumpMainToArticle(state, article);
    return true;
  }

  const heading = document.getElementById(hashId);
  const headingArticle = heading?.closest<HTMLElement>("[data-doc-title]");
  if (!heading || !headingArticle || headingArticle.hidden) return false;

  setActiveArticle(state, headingArticle.id);
  jumpMainToTarget(state, heading);
  updateActiveHeading(state);
  return true;
}

/**
 * Highlights the current heading inside the active document outline.
 */
function updateActiveHeading(
  state: PreviewState,
  behavior: ScrollBehavior = previewScrollBehavior(),
): void {
  if (!state.outlineLinks) return;

  const atScrollEnd = isMainAtScrollEnd(state);
  let current = atScrollEnd ? state.activeHeadings.at(-1) : state.activeHeadings[0];
  if (!atScrollEnd) {
    const activationLine = mainScrollAnchor(state, headingActivationOffset);
    for (const heading of state.activeHeadings) {
      if (heading.getBoundingClientRect().top <= activationLine) current = heading;
      else break;
    }
  }

  let activeLink: HTMLAnchorElement | undefined;

  Array.from(state.outlineLinks.querySelectorAll<HTMLAnchorElement>("a")).forEach((link) => {
    const active = Boolean(current) && link.hash === `#${current?.id}`;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "true");
      activeLink = link;
    } else link.removeAttribute("aria-current");
  });

  if (activeLink) scrollOutlineToActiveLink(state, activeLink, behavior);
}

/**
 * Batches scroll work into one animation frame.
 */
function requestActiveUpdate(state: PreviewState): void {
  if (state.pendingFrame) return;
  state.pendingFrame = window.requestAnimationFrame(() => {
    state.pendingFrame = 0;
    updateActiveArticle(state);
    updateActiveHeading(state);
  });
}

/**
 * Wires sidebar document links without letting URL hashes pin active state.
 */
function wireDocNavigation(state: PreviewState): void {
  state.navLinks.forEach((link) => {
    link.addEventListener(
      "click",
      (event) => {
        const id = link.dataset.docId;
        const article = id ? state.articleById.get(id) : undefined;
        if (!id || !article || article.hidden) return;

        event.preventDefault();
        window.history.pushState(null, "", `#${id}`);
        setActiveArticle(state, id);
        jumpMainToArticle(state, article);
        updateActiveHeading(state);
      },
      { signal: state.signal },
    );
  });
}
