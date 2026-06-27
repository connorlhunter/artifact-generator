const mobileNavMediaQuery = "(max-width: 860px)";
const mobileNavCollapsedHeight = 0;
const mobileNavExpandedMinHeight = 120;
const mobileNavMaxViewportRatio = 0.82;
const navMagnetDistance = 28;
const navMagnetReleaseDistance = 44;
const desktopDragThreshold = 3;
const mobileDragThreshold = 8;
const desktopNavCollapsedStorageKey = "docs.preview.navigation.collapsed";
const navControlsCollapsedStorageKey = "docs.preview.navigation.controls.collapsed";

interface MagneticPosition {
  magnetized: boolean;
  value: number;
}

/**
 * Returns whether the preview is currently using the stacked mobile layout.
 */
function isMobileNavLayout(): boolean {
  return window.matchMedia(mobileNavMediaQuery).matches;
}

/**
 * Bounds a value to an inclusive range.
 */
function clampPosition(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Returns the closest configured stop to a requested position.
 */
function nearestPosition(stops: number[], value: number): number {
  return stops.reduce((nearest, candidate) =>
    Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest,
  );
}

/**
 * Applies Connor Hunter's magnetic capture and release distances to free dragging.
 */
function magneticPosition(
  value: number,
  stops: number[],
  magnetLock: number | null,
): MagneticPosition {
  const orderedStops = [...new Set(stops)].sort((left, right) => left - right);
  const minimum = orderedStops[0] ?? value;
  const maximum = orderedStops.at(-1) ?? value;
  const clamped = clampPosition(value, minimum, maximum);

  if (
    magnetLock !== null &&
    orderedStops.includes(magnetLock) &&
    Math.abs(magnetLock - clamped) <= navMagnetReleaseDistance
  ) {
    return { magnetized: true, value: magnetLock };
  }

  const nearest = nearestPosition(orderedStops, clamped);
  return Math.abs(nearest - clamped) <= navMagnetDistance
    ? { magnetized: true, value: nearest }
    : { magnetized: false, value: clamped };
}

/**
 * Returns a saved binary drawer state when browser storage is available.
 */
function savedCollapsedState(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

/**
 * Saves a binary drawer state when browser storage is available.
 */
function saveCollapsedState(key: string, collapsed: boolean): void {
  try {
    window.localStorage.setItem(key, String(collapsed));
  } catch {
    // Storage can be unavailable in privacy-restricted preview contexts.
  }
}

/**
 * Keeps the outer handle label accurate for the current responsive mode.
 */
function syncNavHandleState(state: PreviewState): void {
  if (!state.navResizeHandle) return;

  if (isMobileNavLayout()) {
    const expanded = !state.docNav?.classList.contains("is-nav-collapsed");
    const label = expanded ? "Collapse navigation drawer" : "Expand navigation drawer";
    state.navResizeHandle.setAttribute("aria-label", label);
    state.navResizeHandle.title = label;
    state.navResizeHandle.setAttribute("aria-expanded", String(expanded));
    return;
  }

  const collapsed = state.docLayout?.classList.contains("is-desktop-nav-collapsed") ?? false;
  const label = collapsed ? "Expand navigation panel" : "Collapse navigation panel";
  state.navResizeHandle.setAttribute("aria-label", label);
  state.navResizeHandle.title = label;
  state.navResizeHandle.setAttribute("aria-expanded", String(!collapsed));
}

/**
 * Applies a freely dragged desktop navigation width with magnetic edge stops.
 */
function setDesktopNavWidth(
  state: PreviewState,
  width: number,
  expandedWidth: number,
  magnetLock: number | null = null,
  magnet = false,
): MagneticPosition {
  if (!state.docLayout || !state.docNav) return { magnetized: false, value: width };

  const position = magnet
    ? magneticPosition(width, [0, expandedWidth], magnetLock)
    : {
        magnetized: false,
        value: clampPosition(width, 0, expandedWidth),
      };
  const collapsed = position.value <= 0.5;
  const expanded = Math.abs(position.value - expandedWidth) <= 0.5;

  state.docLayout.classList.toggle("is-desktop-nav-collapsed", collapsed);
  state.docNav.classList.toggle("is-desktop-nav-collapsed", collapsed);
  state.docNav.classList.toggle("is-desktop-nav-magnetized", position.magnetized);
  if (collapsed || expanded) state.docLayout.style.removeProperty("--nav-drag-width");
  else state.docLayout.style.setProperty("--nav-drag-width", `${position.value}px`);
  syncNavHandleState(state);
  requestActiveUpdate(state);
  return position;
}

/**
 * Wires the floating desktop sidebar handle for clicks and horizontal dragging.
 */
function wireDesktopNavResize(state: PreviewState): void {
  if (!state.docLayout || !state.docNav || !state.navResizeHandle) return;

  let expandedWidth = state.docNav.getBoundingClientRect().width;
  let activePointerId = 0;
  let dragging = false;
  let magnetLock: number | null = null;
  let moved = false;
  let startWidth = 0;
  let startX = 0;
  let suppressNextClick = false;

  if (savedCollapsedState(desktopNavCollapsedStorageKey)) {
    setDesktopNavWidth(state, 0, expandedWidth);
  }

  const stopDragging = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== activePointerId) return;

    dragging = false;
    suppressNextClick = moved;
    saveCollapsedState(
      desktopNavCollapsedStorageKey,
      state.docLayout?.classList.contains("is-desktop-nav-collapsed") ?? false,
    );
    state.docNav?.classList.remove("is-desktop-nav-magnetized");
    document.documentElement.classList.remove("is-resizing-desktop-nav");
    magnetLock = null;
    if (state.navResizeHandle?.hasPointerCapture(activePointerId)) {
      state.navResizeHandle.releasePointerCapture(activePointerId);
    }
    activePointerId = 0;
    event.preventDefault();
  };

  state.navResizeHandle.addEventListener(
    "pointerdown",
    (event) => {
      if (isMobileNavLayout()) return;

      dragging = true;
      moved = false;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startWidth = state.docNav?.getBoundingClientRect().width ?? expandedWidth;
      if (startWidth > expandedWidth) expandedWidth = startWidth;
      state.navResizeHandle?.setPointerCapture(activePointerId);
      document.documentElement.classList.add("is-resizing-desktop-nav");
      event.preventDefault();
    },
    { signal: state.signal },
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging || event.pointerId !== activePointerId) return;

      const delta = event.clientX - startX;
      moved ||= Math.abs(delta) > desktopDragThreshold;
      if (moved) {
        const position = setDesktopNavWidth(
          state,
          startWidth + delta,
          expandedWidth,
          magnetLock,
          true,
        );
        magnetLock = position.magnetized ? position.value : null;
      }
      event.preventDefault();
    },
    { signal: state.signal },
  );

  window.addEventListener("pointerup", stopDragging, { signal: state.signal });
  window.addEventListener("pointercancel", stopDragging, { signal: state.signal });

  state.navResizeHandle.addEventListener(
    "click",
    () => {
      if (isMobileNavLayout()) return;
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }

      const collapsed = state.docLayout?.classList.contains("is-desktop-nav-collapsed") ?? false;
      setDesktopNavWidth(state, collapsed ? expandedWidth : 0, expandedWidth);
      saveCollapsedState(desktopNavCollapsedStorageKey, !collapsed);
    },
    { signal: state.signal },
  );

  window.addEventListener("resize", () => syncNavHandleState(state), {
    passive: true,
    signal: state.signal,
  });
}

/**
 * Measures the natural desktop header/search controls height.
 */
function navControlsExpandedHeight(state: PreviewState): number {
  if (!state.navControls) return 0;

  const previousHeight = state.navControls.style.height;
  const wasCollapsed = state.navControls.classList.contains("is-nav-controls-collapsed");
  state.navControls.classList.remove("is-nav-controls-collapsed");
  state.navControls.style.height = "auto";
  const height = Math.ceil(state.navControls.scrollHeight);
  state.navControls.style.height = previousHeight;
  state.navControls.classList.toggle("is-nav-controls-collapsed", wasCollapsed);
  return height;
}

/**
 * Applies a freely dragged desktop controls height with magnetic edge stops.
 */
function setNavControlsHeight(
  state: PreviewState,
  height: number,
  expandedHeight: number,
  magnetLock: number | null = null,
  magnet = false,
): MagneticPosition {
  if (!state.navControls) return { magnetized: false, value: height };

  const position = magnet
    ? magneticPosition(height, [0, expandedHeight], magnetLock)
    : {
        magnetized: false,
        value: clampPosition(height, 0, expandedHeight),
      };
  const collapsed = position.value <= 0.5;
  const expanded = Math.abs(position.value - expandedHeight) <= 0.5;
  const label = collapsed ? "Show navigation controls" : "Hide navigation controls";

  state.navControls.classList.toggle("is-nav-controls-collapsed", collapsed);
  state.navControls.classList.toggle("is-nav-controls-magnetized", position.magnetized);
  if (collapsed || expanded) state.navControls.style.height = "";
  else state.navControls.style.height = `${position.value}px`;
  state.navControlsHandle?.setAttribute("aria-label", label);
  state.navControlsHandle?.setAttribute("aria-expanded", String(!collapsed));
  if (state.navControlsHandle) state.navControlsHandle.title = label;
  requestActiveUpdate(state);
  return position;
}

/**
 * Wires the floating desktop search/header handle for clicks and vertical dragging.
 */
function wireNavControlsResize(state: PreviewState): void {
  if (!state.navControls || !state.navControlsHandle) return;

  let expandedHeight = navControlsExpandedHeight(state);
  let activePointerId = 0;
  let dragging = false;
  let magnetLock: number | null = null;
  let moved = false;
  let startHeight = 0;
  let startY = 0;
  let suppressNextClick = false;

  if (savedCollapsedState(navControlsCollapsedStorageKey)) {
    setNavControlsHeight(state, 0, expandedHeight);
  }

  const stopDragging = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== activePointerId) return;

    dragging = false;
    suppressNextClick = moved;
    saveCollapsedState(
      navControlsCollapsedStorageKey,
      state.navControls?.classList.contains("is-nav-controls-collapsed") ?? false,
    );
    state.navControls?.classList.remove("is-nav-controls-magnetized");
    document.documentElement.classList.remove("is-resizing-nav-controls");
    magnetLock = null;
    if (state.navControlsHandle?.hasPointerCapture(activePointerId)) {
      state.navControlsHandle.releasePointerCapture(activePointerId);
    }
    activePointerId = 0;
    event.preventDefault();
  };

  state.navControlsHandle.addEventListener(
    "pointerdown",
    (event) => {
      if (isMobileNavLayout()) return;

      dragging = true;
      moved = false;
      activePointerId = event.pointerId;
      startY = event.clientY;
      startHeight = state.navControls?.getBoundingClientRect().height ?? expandedHeight;
      if (startHeight > expandedHeight) expandedHeight = startHeight;
      state.navControlsHandle?.setPointerCapture(activePointerId);
      document.documentElement.classList.add("is-resizing-nav-controls");
      event.preventDefault();
    },
    { signal: state.signal },
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging || event.pointerId !== activePointerId) return;

      const delta = event.clientY - startY;
      moved ||= Math.abs(delta) > desktopDragThreshold;
      if (moved) {
        const position = setNavControlsHeight(
          state,
          startHeight + delta,
          expandedHeight,
          magnetLock,
          true,
        );
        magnetLock = position.magnetized ? position.value : null;
      }
      event.preventDefault();
    },
    { signal: state.signal },
  );

  window.addEventListener("pointerup", stopDragging, { signal: state.signal });
  window.addEventListener("pointercancel", stopDragging, { signal: state.signal });

  state.navControlsHandle.addEventListener(
    "click",
    () => {
      if (isMobileNavLayout()) return;
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }

      const collapsed = state.navControls?.classList.contains("is-nav-controls-collapsed") ?? false;
      setNavControlsHeight(state, collapsed ? expandedHeight : 0, expandedHeight);
      saveCollapsedState(navControlsCollapsedStorageKey, !collapsed);
    },
    { signal: state.signal },
  );
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

  const previousHeight = state.docNav.style.height;
  const wasCollapsed = state.docNav.classList.contains("is-nav-collapsed");
  state.docNav.classList.remove("is-nav-collapsed");
  state.docNav.style.height = "auto";
  const contentHeight = Math.ceil(state.docNav.scrollHeight);
  state.docNav.style.height = previousHeight;
  state.docNav.classList.toggle("is-nav-collapsed", wasCollapsed);
  return Math.max(mobileNavExpandedMinHeight, contentHeight);
}

/**
 * Clamps a requested mobile navigation height to responsive screen limits.
 */
function clampMobileNavHeight(state: PreviewState, height: number): number {
  const maxHeight = Math.min(mobileNavMaxHeight(), mobileNavContentHeight(state));
  return clampPosition(height, mobileNavCollapsedHeight, maxHeight);
}

/**
 * Measures the search-controls stop even while the mobile drawer is closed.
 */
function mobileNavControlsStopHeight(state: PreviewState): number {
  if (!state.docNav) return 0;

  const wasCollapsed = state.docNav.classList.contains("is-nav-collapsed");
  state.docNav.classList.remove("is-nav-collapsed");
  const controlsHeight = state.navControls?.getBoundingClientRect().height ?? 0;
  state.docNav.classList.toggle("is-nav-collapsed", wasCollapsed);
  return Math.round(controlsHeight);
}

/**
 * Returns content-aware mobile drawer stops for closed, search, and expanded states.
 */
function mobileNavSnapHeights(state: PreviewState): number[] {
  const maxHeight = clampMobileNavHeight(state, Number.POSITIVE_INFINITY);
  const controlsStop = mobileNavControlsStopHeight(state);
  const stops = [mobileNavCollapsedHeight];

  if (controlsStop > mobileNavCollapsedHeight && controlsStop < maxHeight) stops.push(controlsStop);
  if (maxHeight > mobileNavCollapsedHeight) stops.push(maxHeight);
  return [...new Set(stops)].sort((left, right) => left - right);
}

/**
 * Returns the closest stable mobile drawer stop to a requested height.
 */
function nearestMobileNavSnapHeight(state: PreviewState, height: number): number {
  return nearestPosition(mobileNavSnapHeights(state), height);
}

/**
 * Returns the next mobile drawer stop for click and keyboard activation.
 */
function nextMobileNavSnapHeight(state: PreviewState): number {
  const currentHeight = state.docNav?.getBoundingClientRect().height ?? mobileNavCollapsedHeight;
  const next = mobileNavSnapHeights(state).find((height) => height > currentHeight + 1);
  return next ?? mobileNavCollapsedHeight;
}

/**
 * Clears mobile-only nav sizing when returning to the desktop layout.
 */
function resetMobileNavHeight(state: PreviewState): void {
  if (!state.docNav) return;

  state.docNav.style.height = "";
  state.docNav.style.removeProperty("--mobile-nav-height");
  state.docNav.classList.remove("is-nav-collapsed", "is-nav-magnetized");
}

/**
 * Applies a mobile drawer height with optional magnetic stops.
 */
function setMobileNavHeight(
  state: PreviewState,
  height: number,
  magnet = false,
  magnetLock: number | null = null,
): MagneticPosition {
  if (!state.docNav) return { magnetized: false, value: height };

  const clampedHeight = clampMobileNavHeight(state, height);
  const position = magnet
    ? magneticPosition(clampedHeight, mobileNavSnapHeights(state), magnetLock)
    : { magnetized: false, value: clampedHeight };
  const controlsStop = mobileNavControlsStopHeight(state);
  const collapsed = position.value <= 0.5;

  state.docNav.style.height = `${position.value}px`;
  state.docNav.style.setProperty("--mobile-nav-height", `${position.value}px`);
  state.docNav.classList.toggle("is-nav-collapsed", collapsed);
  state.docNav.classList.toggle("is-nav-magnetized", position.magnetized);
  if (position.value <= controlsStop) state.docNav.scrollTop = 0;
  syncNavHandleState(state);
  return position;
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
  state.pendingMobileNavMagnet = false;
}

/**
 * Applies queued mobile drawer size work inside the next paint frame.
 */
function applyPendingMobileNavResize(state: PreviewState): void {
  const nextHeight = state.pendingMobileNavHeight;
  const magnet = state.pendingMobileNavMagnet;
  state.pendingResizeFrame = 0;
  state.pendingMobileNavHeight = null;
  state.pendingMobileNavMagnet = false;

  if (nextHeight === null) {
    clampExistingMobileNavHeight(state);
  } else {
    const position = setMobileNavHeight(state, nextHeight, magnet, state.mobileNavMagnetLockHeight);
    state.mobileNavMagnetLockHeight = position.magnetized ? position.value : null;
  }
  requestActiveUpdate(state);
}

/**
 * Batches mobile drawer resize writes inside one paint frame.
 */
function requestMobileNavResize(
  state: PreviewState,
  height: number | null = null,
  magnet = false,
): void {
  state.pendingMobileNavHeight = height;
  state.pendingMobileNavMagnet = magnet;
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
 * Wires the mobile floating handle for clicks and magnetic vertical dragging.
 */
function wireMobileNavResize(state: PreviewState): void {
  if (!state.docNav || !state.navResizeHandle) return;

  let activePointerId = 0;
  let dragging = false;
  let moved = false;
  let startHeight = 0;
  let startY = 0;
  let suppressNextClick = false;

  const stopDragging = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== activePointerId) return;

    dragging = false;
    const requestedHeight =
      state.pendingMobileNavHeight ?? state.docNav?.getBoundingClientRect().height ?? 0;
    const magnetLock = state.mobileNavMagnetLockHeight;
    cancelPendingMobileNavResize(state);
    setMobileNavHeight(state, requestedHeight, true, magnetLock);
    state.mobileNavMagnetLockHeight = null;
    state.docNav?.classList.remove("is-nav-magnetized");
    suppressNextClick = moved;
    if (state.navResizeHandle?.hasPointerCapture(activePointerId)) {
      state.navResizeHandle.releasePointerCapture(activePointerId);
    }
    activePointerId = 0;
    document.documentElement.classList.remove("is-resizing-nav");
    event.preventDefault();
  };

  state.navResizeHandle.addEventListener(
    "pointerdown",
    (event) => {
      if (!isMobileNavLayout()) return;

      dragging = true;
      moved = false;
      activePointerId = event.pointerId;
      startY = event.clientY;
      startHeight = state.docNav?.getBoundingClientRect().height ?? 0;
      state.mobileNavMagnetLockHeight = null;
      cancelPendingMobileNavResize(state);
      state.navResizeHandle?.setPointerCapture(activePointerId);
      document.documentElement.classList.add("is-resizing-nav");
      event.preventDefault();
    },
    { signal: state.signal },
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging || event.pointerId !== activePointerId) return;

      const delta = event.clientY - startY;
      moved ||= Math.abs(delta) > mobileDragThreshold;
      if (moved) requestMobileNavResize(state, startHeight + delta, true);
      event.preventDefault();
    },
    { signal: state.signal },
  );

  window.addEventListener("pointerup", stopDragging, { signal: state.signal });
  window.addEventListener("pointercancel", stopDragging, { signal: state.signal });

  state.navResizeHandle.addEventListener(
    "click",
    () => {
      if (!isMobileNavLayout()) return;
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }

      setMobileNavHeight(state, nextMobileNavSnapHeight(state));
      requestActiveUpdate(state);
    },
    { signal: state.signal },
  );

  window.addEventListener("resize", () => requestMobileNavResize(state), {
    passive: true,
    signal: state.signal,
  });

  if (isMobileNavLayout()) {
    const previousTransition = state.docNav.style.transition;
    state.docNav.style.transition = "none";
    setMobileNavHeight(
      state,
      nearestMobileNavSnapHeight(state, state.docNav.getBoundingClientRect().height),
    );
    void state.docNav.offsetHeight;
    state.docNav.style.transition = previousTransition;
  }
}
