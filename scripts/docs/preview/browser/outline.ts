/**
 * Clears active sidebar and outline state when no article should be selected.
 */
function clearActiveArticle(state: PreviewState): void {
  state.activeArticleId = "";
  state.activeHeadings = [];
  state.navLinks.forEach((link) => {
    link.classList.remove("is-active");
    link.removeAttribute("aria-current");
  });
  state.navSections.forEach((section) => section.classList.remove("is-active"));
  if (state.navHeadingLinks) {
    state.navHeadingLinks.replaceChildren();
    state.navHeadingLinks.hidden = true;
  }
}

/**
 * Replaces the current outline with a short empty-state message.
 */
function showOutlineMessage(state: PreviewState, title: string, message: string): void {
  if (!state.outlineTitle || !state.outlineLinks) return;

  state.outlineTitle.textContent = title;
  state.outlineLinks.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "outline-empty";
  empty.textContent = message;
  state.outlineLinks.append(empty);
}

/**
 * Builds the right-side heading outline for the active article.
 */
function buildOutline(
  state: PreviewState,
  article: HTMLElement,
  behavior: ScrollBehavior = previewScrollBehavior(),
): void {
  state.activeHeadings = Array.from(
    article.querySelectorAll<HTMLElement>(".doc-body h1, .doc-body h2, .doc-body h3"),
  );
  state.activeHeadings.forEach((heading, index) => {
    if (!heading.id) heading.id = `${article.id}-heading-${index}`;
  });
  buildNavHeadingLinks(state, article);

  if (state.outlineTitle) {
    state.outlineTitle.textContent = article.dataset.docTitle || "Current doc";
  }
  state.outlineLinks?.replaceChildren();

  if (state.activeHeadings.length === 0) {
    showOutlineMessage(state, article.dataset.docTitle || "Current doc", "No headings");
    return;
  }

  state.activeHeadings.forEach((heading) => {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent || "Section";
    link.className = `outline-link depth-${heading.tagName.toLowerCase()}`;
    state.outlineLinks?.append(link);
  });

  updateActiveHeading(state, behavior);
}

/**
 * Keeps the active right-outline heading visible while the main pane scrolls.
 */
function scrollOutlineToActiveLink(
  state: PreviewState,
  link: HTMLAnchorElement,
  behavior: ScrollBehavior = previewScrollBehavior(),
): void {
  if (!state.pageOutline || state.pageOutline.scrollHeight <= state.pageOutline.clientHeight) {
    return;
  }

  if (link === state.outlineLinks?.querySelector("a")) {
    scrollContainerTo(state.pageOutline, 0, behavior);
    return;
  }

  scrollTargetIntoContainer(state.pageOutline, link, {
    align: "center",
    behavior,
  });
}

/**
 * Wires one heading-link collection to the main docs scroll container.
 */
function wireHeadingNavigation(state: PreviewState, links: HTMLElement | null): void {
  links?.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>("a[href^='#']");
      if (!link) return;

      const heading = document.getElementById(link.hash.slice(1));
      if (!heading) return;

      event.preventDefault();
      window.history.pushState(null, "", link.hash);
      jumpMainToTarget(state, heading);
      updateActiveHeading(state);
    },
    { signal: state.signal },
  );
}

/**
 * Wires both left and right heading navigation without duplicating click behavior.
 */
function wireOutlineNavigation(state: PreviewState): void {
  wireHeadingNavigation(state, state.navHeadingLinks);
  wireHeadingNavigation(state, state.outlineLinks);
}
