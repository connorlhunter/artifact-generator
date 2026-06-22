/**
 * Returns whether a nav section/group still contains visible doc links.
 */
function sectionHasVisibleLink(section: HTMLElement): boolean {
  return Array.from(section.querySelectorAll<HTMLElement>("[data-doc-link]")).some(
    (link) => !link.hidden,
  );
}

/**
 * Applies the sidebar search query to articles, nav links, sections, and outline.
 */
function applySearch(state: PreviewState): void {
  const query = (state.searchInput?.value || "").trim().toLowerCase();
  let visibleCount = 0;

  state.articles.forEach((article) => {
    const visible = !query || (article.dataset.docSearch || "").includes(query);
    article.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  state.navLinks.forEach((link) => {
    const article = state.articleById.get(link.dataset.docId || "");
    link.hidden = Boolean(article?.hidden);
  });

  state.navSections.forEach((section) => {
    section.hidden = !sectionHasVisibleLink(section);
  });

  state.navGroups.forEach((group) => {
    group.hidden = !sectionHasVisibleLink(group);
  });

  if (state.searchEmpty) state.searchEmpty.hidden = visibleCount > 0;
  clampExistingMobileNavHeight(state);

  if (visibleCount === 0) {
    clearActiveArticle(state);
    showOutlineMessage(
      state,
      "No matching docs",
      "Clear or change the search to restore the outline.",
    );
    return;
  }

  const firstVisible = visibleArticles(state)[0];
  if (!query && firstVisible) {
    setActiveArticle(state, firstVisible.id);
    jumpMainToArticle(state, firstVisible);
    if (state.docNav) scrollContainerTo(state.docNav, 0);
  } else if (query && firstVisible) {
    setActiveArticle(state, firstVisible.id);
    jumpMainToArticle(state, firstVisible, { skipIfVisible: true });
  } else updateActiveArticle(state);
}
