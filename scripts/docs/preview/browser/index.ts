/**
 * Starts the standalone docs preview client.
 */
function startDocsPreviewClient(): void {
  const state = createState();

  installCleanup(state);
  wireDocNavigation(state);
  wireOutlineNavigation(state);
  wireNavControlsResize(state);
  wireDesktopNavResize(state);
  wireDesktopOutlineResize(state);
  wireMobileNavResize(state);
  wireFullscreenGesture(state);
  wireSchemeToggle(state);
  wireSourceButtons(state);
  state.searchInput?.addEventListener("input", () => requestSearchUpdate(state), {
    signal: state.signal,
  });
  (state.main ?? window).addEventListener("scroll", () => requestActiveUpdate(state), {
    passive: true,
    signal: state.signal,
  });
  window.addEventListener(
    "hashchange",
    () => activateHashTarget(state) || updateActiveArticle(state),
    {
      signal: state.signal,
    },
  );
  applySearch(state);
  activateHashTarget(state);
}

startDocsPreviewClient();
