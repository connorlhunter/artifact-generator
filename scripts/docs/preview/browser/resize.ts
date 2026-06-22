const mobileNavMediaQuery = "(max-width: 860px)";
const mobileNavCollapsedHeight = 40;
const mobileNavExpandedMinHeight = 192;
const mobileNavMaxViewportRatio = 0.82;

/**
 * Returns whether the preview is currently using the stacked mobile layout.
 */
function isMobileNavLayout(): boolean {
  return window.matchMedia(mobileNavMediaQuery).matches;
}

/**
 * Returns the maximum mobile navigation height that still leaves main content.
 */
function mobileNavMaxHeight(): number {
  return Math.max(
    mobileNavExpandedMinHeight,
    Math.round(window.innerHeight * mobileNavMaxViewportRatio),
  );
}

/**
 * Measures the nav content without the collapsed clipping state.
 */
function mobileNavContentHeight(state: PreviewState): number {
  if (!state.docNav) return mobileNavExpandedMinHeight;

  const nav = state.docNav;
  const previousHeight = nav.style.height;
  const wasCollapsed = nav.classList.contains("is-nav-collapsed");

  nav.classList.remove("is-nav-collapsed");
  nav.style.height = "auto";
  const contentHeight = Math.ceil(nav.scrollHeight);
  nav.style.height = previousHeight;
  nav.classList.toggle("is-nav-collapsed", wasCollapsed);

  return Math.max(mobileNavCollapsedHeight, contentHeight);
}

/**
 * Clamps a requested mobile navigation height to responsive screen limits.
 */
function clampMobileNavHeight(state: PreviewState, height: number): number {
  const maxHeight = Math.min(mobileNavMaxHeight(), mobileNavContentHeight(state));
  const expandedMinHeight = Math.min(mobileNavExpandedMinHeight, maxHeight);
  const clampedHeight = Math.min(maxHeight, Math.max(mobileNavCollapsedHeight, height));
  return clampedHeight < expandedMinHeight ? mobileNavCollapsedHeight : clampedHeight;
}

/**
 * Clears mobile-only nav sizing when returning to the desktop layout.
 */
function resetMobileNavHeight(state: PreviewState): void {
  if (!state.docNav) return;

  state.docNav.style.height = "";
  state.docNav.classList.remove("is-nav-collapsed");
}

/**
 * Applies a mobile navigation overlay height without resizing the main pane.
 */
function setMobileNavHeight(state: PreviewState, height: number): void {
  if (!state.docNav) return;

  const clampedHeight = clampMobileNavHeight(state, height);
  state.docNav.style.height = `${clampedHeight}px`;
  state.docNav.classList.toggle("is-nav-collapsed", clampedHeight === mobileNavCollapsedHeight);
}

/**
 * Cancels queued mobile drawer resize work.
 */
function cancelPendingMobileNavResize(state: PreviewState): void {
  if (state.pendingResizeFrame) {
    window.cancelAnimationFrame(state.pendingResizeFrame);
    state.pendingResizeFrame = 0;
  }

  state.pendingMobileNavHeight = null;
}

/**
 * Applies queued mobile drawer size work inside the next paint frame.
 */
function applyPendingMobileNavResize(state: PreviewState): void {
  const nextHeight = state.pendingMobileNavHeight;

  state.pendingResizeFrame = 0;
  state.pendingMobileNavHeight = null;

  if (nextHeight === null) clampExistingMobileNavHeight(state);
  else setMobileNavHeight(state, nextHeight);

  requestActiveUpdate(state);
}

/**
 * Batches mobile drawer resize writes so pointermove cannot force multiple
 * layout updates inside one frame.
 */
function requestMobileNavResize(state: PreviewState, height: number | null = null): void {
  state.pendingMobileNavHeight = height;
  if (state.pendingResizeFrame) return;

  state.pendingResizeFrame = window.requestAnimationFrame(() => applyPendingMobileNavResize(state));
}

/**
 * Keeps a user-sized mobile nav valid after viewport changes.
 */
function clampExistingMobileNavHeight(state: PreviewState): void {
  if (!state.docNav) return;

  if (!isMobileNavLayout()) {
    resetMobileNavHeight(state);
    return;
  }

  setMobileNavHeight(state, state.docNav.getBoundingClientRect().height);
}

/**
 * Wires the mobile navigation resize handle.
 */
function wireMobileNavResize(state: PreviewState): void {
  if (!state.docNav || !state.navResizeHandle) return;

  let startY = 0;
  let startHeight = 0;
  let dragging = false;
  let activePointerId = 0;

  const stopDragging = (event: PointerEvent): void => {
    if (!dragging) return;

    dragging = false;
    if (activePointerId) {
      if (state.navResizeHandle?.hasPointerCapture(activePointerId)) {
        state.navResizeHandle.releasePointerCapture(activePointerId);
      }
      activePointerId = 0;
    }
    document.documentElement.classList.remove("is-resizing-nav");
    event.preventDefault();
  };

  state.navResizeHandle.addEventListener(
    "pointerdown",
    (event) => {
      if (!isMobileNavLayout()) {
        resetMobileNavHeight(state);
        return;
      }

      dragging = true;
      activePointerId = event.pointerId;
      startY = event.clientY;
      startHeight = state.docNav?.getBoundingClientRect().height ?? 0;
      cancelPendingMobileNavResize(state);
      state.navResizeHandle?.setPointerCapture(activePointerId);
      document.documentElement.classList.add("is-resizing-nav");
      event.preventDefault();
    },
    { signal: state.signal },
  );

  state.navResizeHandle.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging) return;

      requestMobileNavResize(state, startHeight + event.clientY - startY);
      event.preventDefault();
    },
    { signal: state.signal },
  );

  state.navResizeHandle.addEventListener("pointerup", (event) => stopDragging(event), {
    signal: state.signal,
  });

  state.navResizeHandle.addEventListener("pointercancel", (event) => stopDragging(event), {
    signal: state.signal,
  });

  window.addEventListener("resize", () => requestMobileNavResize(state), {
    passive: true,
    signal: state.signal,
  });
}
