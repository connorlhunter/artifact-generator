const embeddedFullscreenMessageType = "connorhunter.file-viewer.enter-fullscreen";
const embeddedDoubleTapDelay = 360;
const embeddedDoubleTapDistance = 28;
const embeddedInteractiveSelector =
  'a, button, input, select, textarea, summary, [role="button"], [contenteditable="true"], [data-fullscreen-gesture-ignore]';

interface EmbeddedTapPoint {
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

function isEmbeddedInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(embeddedInteractiveSelector));
}

function requestEmbeddedFullscreen(): void {
  if (window.parent === window) return;
  window.parent.postMessage({ type: embeddedFullscreenMessageType }, "*");
}

/**
 * Sends deliberate pointer gestures to the host file viewer without intercepting normal controls.
 */
function wireFullscreenGesture(state: PreviewState): void {
  let lastTouch: EmbeddedTapPoint | null = null;
  let suppressDoubleClickUntil = 0;

  document.addEventListener(
    "dblclick",
    (event) => {
      if (event.timeStamp <= suppressDoubleClickUntil) {
        suppressDoubleClickUntil = 0;
        return;
      }

      if (isEmbeddedInteractiveTarget(event.target)) return;

      event.preventDefault();
      requestEmbeddedFullscreen();
    },
    { signal: state.signal },
  );

  document.addEventListener(
    "pointerup",
    (event) => {
      if (event.pointerType !== "touch") return;

      if (isEmbeddedInteractiveTarget(event.target)) {
        lastTouch = null;
        return;
      }

      const currentTouch = { at: event.timeStamp, x: event.clientX, y: event.clientY };
      const elapsed = lastTouch ? currentTouch.at - lastTouch.at : Number.POSITIVE_INFINITY;
      const distance = lastTouch
        ? Math.hypot(currentTouch.x - lastTouch.x, currentTouch.y - lastTouch.y)
        : Number.POSITIVE_INFINITY;

      if (
        elapsed >= 0 &&
        elapsed <= embeddedDoubleTapDelay &&
        distance <= embeddedDoubleTapDistance
      ) {
        lastTouch = null;
        suppressDoubleClickUntil = currentTouch.at + embeddedDoubleTapDelay;
        event.preventDefault();
        requestEmbeddedFullscreen();
        return;
      }

      lastTouch = currentTouch;
    },
    { signal: state.signal },
  );
}
