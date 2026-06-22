/**
 * Escapes text for safe HTML output.
 *
 * @param {string} value - Text to escape.
 * @returns {string} HTML-safe text.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
