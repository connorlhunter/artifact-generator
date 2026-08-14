import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readText } from "../../core/bun-native-fs.ts";

const browserScriptOutputFiles = [
  "state.js",
  "cleanup.js",
  "scroll.js",
  "heading-links.js",
  "outline.js",
  "navigation.js",
  "resize.js",
  "search.js",
  "source-buttons.js",
  "fullscreen.js",
  "schemes.js",
  "index.js",
] as const;

/**
 * Loads the compiled browser client and wraps it for inline HTML output.
 *
 * The browser behavior is authored as TypeScript in `preview/browser/` and
 * compiled with the rest of the scripts before docs rendering runs.
 *
 * @returns {Promise<string>} Inline script tag for the standalone preview.
 */
export async function loadDocsPreviewClientScript(): Promise<string> {
  const scriptDir = resolveBrowserScriptDir(import.meta.url);
  const script = (
    await Promise.all(
      browserScriptOutputFiles.map(async (file): Promise<string> => {
        const contents = await readText(resolve(scriptDir, file));
        return stripBrowserModuleSyntax(contents);
      }),
    )
  ).join("\n");

  return `  <script>\n(() => {\n${script}\n})();\n  </script>`;
}

/**
 * Resolves compiled browser client output from source or dist module locations.
 *
 * @param {string} moduleUrl - URL of this module.
 * @returns {string} Absolute directory containing compiled browser scripts.
 */
export function resolveBrowserScriptDir(moduleUrl: string): string {
  const modulePath = fileURLToPath(moduleUrl);
  const moduleDir = dirname(modulePath);
  if (modulePath.includes(`${sep}dist${sep}`)) return resolve(moduleDir, "browser");

  return resolve(moduleDir, "..", "..", "..", "dist", "scripts", "docs", "preview", "browser");
}

/**
 * Removes generated source-map comments before inlining browser scripts.
 *
 * @param {string} contents - Compiled JavaScript file contents.
 * @returns {string} JavaScript without source-map references.
 */
export function stripSourceMapComment(contents: string): string {
  return contents.replace(/\n\/\/# sourceMappingURL=.*$/gm, "");
}

/**
 * Removes module markers from browser helpers before they are inlined.
 *
 * @param {string} contents - Compiled browser helper source.
 * @returns {string} Browser source that can run inside the preview wrapper.
 */
export function stripBrowserModuleSyntax(contents: string): string {
  return stripSourceMapComment(contents).replace(/^export\s+/gmu, "");
}
