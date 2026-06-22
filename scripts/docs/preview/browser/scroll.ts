const previewScrollEdgePadding = 16;
const previewScrollMinDelta = 1;

interface ScrollIntoContainerOptions {
  align?: "center" | "nearest" | "start";
  behavior?: ScrollBehavior;
  bottomPadding?: number;
  force?: boolean;
  topPadding?: number;
}

interface MainJumpOptions {
  bottomPadding?: number;
  skipIfVisible?: boolean;
  topPadding?: number;
}

/**
 * Returns whether the browser/user has asked for reduced motion.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Returns the shared scroll behavior for automatic preview movement.
 */
function previewScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/**
 * Bounds a scroll offset to the scrollable range of a container.
 */
function clampScrollTop(container: HTMLElement, top: number): number {
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.max(0, Math.min(maxTop, top));
}

/**
 * Scrolls a container only when the target offset would visibly change.
 */
function scrollContainerTo(
  container: HTMLElement,
  top: number,
  behavior: ScrollBehavior = previewScrollBehavior(),
): void {
  const nextTop = clampScrollTop(container, top);
  if (Math.abs(nextTop - container.scrollTop) <= previewScrollMinDelta) return;

  if (behavior === "auto") {
    container.scrollTop = nextTop;
    return;
  }

  container.scrollTo({
    behavior,
    top: nextTop,
  });
}

/**
 * Smoothly scrolls a target inside a scroll container with stable edge padding.
 */
function scrollTargetIntoContainer(
  container: HTMLElement,
  target: HTMLElement,
  options: ScrollIntoContainerOptions = {},
): void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const topPadding = options.topPadding ?? previewScrollEdgePadding;
  const bottomPadding = options.bottomPadding ?? previewScrollEdgePadding;
  const visibleTop = containerRect.top + topPadding;
  const visibleBottom = containerRect.bottom - bottomPadding;
  if (visibleBottom <= visibleTop) return;

  const fullyVisible = targetRect.top >= visibleTop && targetRect.bottom <= visibleBottom;
  if (!options.force && fullyVisible) return;

  const align = options.align ?? "nearest";
  const currentTop = container.scrollTop;
  let nextTop = currentTop;

  if (align === "start") {
    nextTop += targetRect.top - visibleTop;
  } else if (align === "center") {
    const visibleCenter = visibleTop + (visibleBottom - visibleTop) / 2;
    const targetCenter = targetRect.top + targetRect.height / 2;
    nextTop += targetCenter - visibleCenter;
  } else if (targetRect.top < visibleTop) {
    nextTop -= visibleTop - targetRect.top;
  } else if (targetRect.bottom > visibleBottom) {
    nextTop += targetRect.bottom - visibleBottom;
  } else {
    return;
  }

  scrollContainerTo(container, nextTop, options.behavior);
}

/**
 * Jumps the main docs pane to an element without animating the reading surface.
 */
function jumpMainToTarget(
  state: PreviewState,
  target: HTMLElement,
  options: MainJumpOptions = {},
): void {
  if (!state.main) {
    const nextTop = window.scrollY + target.getBoundingClientRect().top;
    window.scrollTo({ behavior: "auto", top: Math.max(0, nextTop) });
    return;
  }

  const containerRect = state.main.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const topPadding = options.topPadding ?? previewScrollEdgePadding;
  const bottomPadding = options.bottomPadding ?? previewScrollEdgePadding;
  const visibleTop = containerRect.top + topPadding;
  const visibleBottom = containerRect.bottom - bottomPadding;
  const fullyVisible = targetRect.top >= visibleTop && targetRect.bottom <= visibleBottom;
  if (options.skipIfVisible && fullyVisible) return;

  const nextTop = state.main.scrollTop + targetRect.top - containerRect.top - topPadding;

  state.main.scrollTop = clampScrollTop(state.main, nextTop);
}
