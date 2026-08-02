const searchExcerptLength = 96;

/**
 * Returns whether a nav section/group still contains visible doc links.
 */
function sectionHasVisibleLink(section: HTMLElement): boolean {
  return Array.from(section.querySelectorAll<HTMLElement>("[data-doc-link]")).some(
    (link) => !link.hidden,
  );
}

/**
 * Splits a search query into unique lowercase terms.
 */
function previewSearchTokens(value: string): string[] {
  return [...new Set(compactPreviewSearchText(value).toLowerCase().split(" ").filter(Boolean))];
}

/**
 * Escapes one search term for use in a regular expression.
 */
function escapeSearchPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Removes highlights added by the current search.
 */
function clearSearchHighlights(root: ParentNode): void {
  const parents = new Set<Node>();

  root.querySelectorAll<HTMLElement>("mark[data-search-highlight]").forEach((mark) => {
    if (mark.parentNode) parents.add(mark.parentNode);
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  });

  parents.forEach((parent) => parent.normalize());
}

/**
 * Highlights every matching search term below one rendered element.
 */
function highlightSearchTerms(root: HTMLElement, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node): number {
      const parent = node.parentElement;
      const value = node.nodeValue?.toLowerCase() ?? "";
      if (!parent || parent.closest("mark, script, style, svg")) return NodeFilter.FILTER_REJECT;

      return tokens.some((token) => value.includes(token))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text);
  }

  const expression = new RegExp(
    [...tokens]
      .sort((left, right) => right.length - left.length)
      .map(escapeSearchPattern)
      .join("|"),
    "giu",
  );
  let highlightCount = 0;

  textNodes.forEach((textNode) => {
    const value = textNode.nodeValue ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    expression.lastIndex = 0;
    for (const match of value.matchAll(expression)) {
      const matchIndex = match.index;
      const matchText = match[0];
      if (matchIndex > cursor) fragment.append(value.slice(cursor, matchIndex));

      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.dataset.searchHighlight = "";
      mark.textContent = matchText;
      fragment.append(mark);
      cursor = matchIndex + matchText.length;
      highlightCount += 1;
    }

    if (cursor < value.length) fragment.append(value.slice(cursor));
    textNode.replaceWith(fragment);
  });

  return highlightCount;
}

/**
 * Builds a compact navigation excerpt around the first matching term.
 */
function searchExcerpt(value: string, tokens: string[]): string {
  const normalizedValue = value.toLowerCase();
  const matchIndexes = tokens
    .map((token) => normalizedValue.indexOf(token))
    .filter((index) => index >= 0);
  if (matchIndexes.length === 0) return "";

  const matchIndex = Math.min(...matchIndexes);
  const start = Math.max(0, matchIndex - Math.floor(searchExcerptLength / 3));
  const end = Math.min(value.length, start + searchExcerptLength);
  const excerpt = value.slice(start, end).trim();

  return `${start > 0 ? "..." : ""}${excerpt}${end < value.length ? "..." : ""}`;
}

/**
 * Updates one navigation result and its optional matching excerpt.
 */
function updateSearchNavigationLink(
  link: HTMLAnchorElement,
  article: HTMLElement | undefined,
  entry: PreviewSearchEntry | undefined,
  tokens: string[],
): void {
  link.hidden = !article || article.hidden;

  const label = link.querySelector<HTMLElement>("[data-doc-link-label]");
  const context = link.querySelector<HTMLElement>("[data-doc-search-context]");
  if (!label || !context || link.hidden || tokens.length === 0) return;

  const labelText = label.textContent?.toLowerCase() ?? "";
  highlightSearchTerms(label, tokens);
  if (tokens.every((token) => labelText.includes(token))) return;

  const excerpt = searchExcerpt(entry?.bodyText ?? "", tokens);
  if (!excerpt) return;

  context.textContent = excerpt;
  context.hidden = false;
  highlightSearchTerms(context, tokens);
}

/**
 * Updates the visible result count beside the docs title.
 */
function updateSearchCount(state: PreviewState, visibleCount: number, hasQuery: boolean): void {
  if (!state.navCount) return;

  const total = state.articles.length;
  state.navCount.textContent = hasQuery
    ? `${visibleCount} of ${total} documents`
    : `${total} documents`;
}

/**
 * Applies the sidebar search query to the full rendered document index.
 */
function applySearch(state: PreviewState): void {
  const tokens = previewSearchTokens(state.searchInput?.value ?? "");
  const hasQuery = tokens.length > 0;
  let visibleCount = 0;

  clearSearchHighlights(document);
  state.navLinks.forEach((link) => {
    const context = link.querySelector<HTMLElement>("[data-doc-search-context]");
    if (!context) return;
    context.textContent = "";
    context.hidden = true;
  });

  state.articles.forEach((article) => {
    const entry = state.searchByArticleId.get(article.id);
    const visible = !hasQuery || tokens.every((token) => entry?.normalizedText.includes(token));
    article.hidden = !visible;
    article.classList.toggle("is-search-match", hasQuery && visible);
    if (!visible) return;

    visibleCount += 1;
    if (!hasQuery) return;

    const heading = article.querySelector<HTMLElement>(".doc-heading");
    const body = article.querySelector<HTMLElement>(".doc-body");
    if (heading) highlightSearchTerms(heading, tokens);
    if (body) highlightSearchTerms(body, tokens);
  });

  state.navLinks.forEach((link) => {
    const article = state.articleById.get(link.dataset.docId ?? "");
    const entry = article ? state.searchByArticleId.get(article.id) : undefined;
    updateSearchNavigationLink(link, article, entry, tokens);
  });

  state.navSections.forEach((section) => {
    section.hidden = !sectionHasVisibleLink(section);
  });

  state.navGroups.forEach((group) => {
    group.hidden = !sectionHasVisibleLink(group);
  });

  updateSearchCount(state, visibleCount, hasQuery);
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
  if (!hasQuery && firstVisible) {
    setActiveArticle(state, firstVisible.id);
    jumpMainToArticle(state, firstVisible);
    if (state.docNav) scrollContainerTo(state.docNav, 0);
  } else if (firstVisible) {
    setActiveArticle(state, firstVisible.id);
    jumpMainToArticle(state, firstVisible, { skipIfVisible: true });
  } else updateActiveArticle(state);
}

/**
 * Coalesces rapid search input into one DOM update per animation frame.
 */
function requestSearchUpdate(state: PreviewState): void {
  if (state.pendingSearchFrame) return;

  state.pendingSearchFrame = window.requestAnimationFrame(() => {
    state.pendingSearchFrame = 0;
    if (!state.signal.aborted) applySearch(state);
  });
}
