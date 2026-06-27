/**
 * Wires Markdown source copy buttons and tracks reset timers for cleanup.
 */
function wireSourceButtons(state: PreviewState): void {
  document.querySelectorAll<HTMLButtonElement>("[data-copy-source]").forEach((button) => {
    button.addEventListener(
      "click",
      async () => {
        const source = button.closest(".doc-source")?.querySelector("code")?.textContent || "";
        try {
          await navigator.clipboard.writeText(source);
          if (state.signal.aborted) return;

          button.textContent = "Copied";
          const resetTimer = window.setTimeout(() => {
            button.textContent = "Copy";
            state.resetTimers.delete(resetTimer);
          }, 1400);
          state.resetTimers.add(resetTimer);
        } catch {
          button.textContent = "Select source";
        }
      },
      { signal: state.signal },
    );
  });
}
