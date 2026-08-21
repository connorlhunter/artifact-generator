/** Copies text with the modern clipboard API or an iframe-safe selection fallback. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const source = document.createElement("textarea");

    source.value = text;
    source.setAttribute("readonly", "");
    source.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(source);
    source.select();
    source.setSelectionRange(0, source.value.length);
    const copied = document.execCommand("copy");
    source.remove();

    if (!copied) throw new Error("The browser could not copy the Markdown source.");
  }
}

/** Wires Markdown source copy buttons. */
function wireSourceButtons(state: PreviewState): void {
  document.querySelectorAll<HTMLButtonElement>("[data-copy-source]").forEach((button) => {
    button.addEventListener(
      "click",
      async () => {
        const source = button.closest(".doc-source")?.querySelector("code")?.textContent || "";
        try {
          await copyText(source);
        } catch {
          // Keep the action predictable; browsers may deny clipboard access.
        }
      },
      { signal: state.signal },
    );
  });
}
