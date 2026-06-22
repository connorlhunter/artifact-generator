import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readText } from "../../core/bun-native-fs.ts";

const sourceStylesPath = "styles.css";

/**
 * Absolute path to the preview CSS source file.
 */
export const docsPreviewStylesPath = resolveStylesPath(import.meta.url);

/**
 * Loads the generated-preview CSS from the checked-in source file.
 *
 * @returns {Promise<string>} CSS to inline into the standalone preview HTML.
 */
export function loadDocsPreviewStyles(): Promise<string> {
  return readText(docsPreviewStylesPath);
}

/**
 * Resolves the CSS asset path from either source TypeScript or compiled JS.
 *
 * @param {string} moduleUrl - URL of this module.
 * @returns {string} Absolute CSS source path.
 */
export function resolveStylesPath(moduleUrl: string): string {
  const modulePath = fileURLToPath(moduleUrl);
  const moduleDir = dirname(modulePath);
  if (!modulePath.includes(`${sep}dist${sep}`)) return resolve(moduleDir, sourceStylesPath);

  return resolve(moduleDir, "..", "..", "..", "..", "scripts", "docs", "preview", sourceStylesPath);
}
