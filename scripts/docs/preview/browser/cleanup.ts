/**
 * Installs cleanup for event listeners, timers, frames, and reinjected clients.
 */
function installCleanup(state: PreviewState): CleanupFn {
  const cleanup = (): void => {
    state.controller.abort();

    if (state.pendingFrame) {
      window.cancelAnimationFrame(state.pendingFrame);
      state.pendingFrame = 0;
    }

    cancelPendingMobileNavResize(state);
    state.resetTimers.forEach((timer) => window.clearTimeout(timer));
    state.resetTimers.clear();
    document.documentElement.classList.remove("is-resizing-nav");
    clearWindowCleanup(state, cleanup);
  };

  setWindowCleanup(state, cleanup);
  window.addEventListener("pagehide", cleanup, { once: true, signal: state.signal });
  return cleanup;
}
