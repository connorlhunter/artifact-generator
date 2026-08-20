import { readFileSync, writeFileSync } from "node:fs";
import { sourceInputDirs } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logSuccess } from "../core/script-logger.ts";
import { isoUpdatedDate, validateUpdatedDate } from "../core/versioned-artifact-metadata.ts";

const contentManifestPath = `${sourceInputDirs.manifests}/content-manifest.json`;

interface ContentManifest {
  readonly [key: string]: unknown;
  lastUpdated?: unknown;
}

/**
 * @param date - Code publication time to represent in the content manifest.
 * @returns An ISO calendar date in UTC.
 */
export function contentUpdatedDate(date = new Date()): string {
  return isoUpdatedDate(date);
}

/**
 * @param manifestPath - Source manifest containing the artifact publication date.
 * @returns The validated date used only by the portfolio code footer.
 */
export function readContentUpdatedDate(manifestPath = contentManifestPath): string {
  const manifest = readContentManifest(manifestPath);

  if (typeof manifest.lastUpdated !== "string") {
    throw new Error(`content-manifest.json is missing lastUpdated: ${manifestPath}`);
  }

  validateUpdatedDate(manifest.lastUpdated, "content-manifest.json lastUpdated");
  return manifest.lastUpdated;
}

/**
 * Updates the code/footer date without coupling it to artifact rendering.
 *
 * @param manifestPath - Editable source manifest to update.
 * @param date - Publication time to write.
 * @returns The ISO calendar date written to the manifest.
 */
export function writeContentUpdatedDate(
  manifestPath = contentManifestPath,
  date = new Date(),
): string {
  const manifest = readContentManifest(manifestPath);
  const lastUpdated = contentUpdatedDate(date);

  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, lastUpdated }, null, 2)}\n`);
  return lastUpdated;
}

/**
 * @param manifestPath - JSON source manifest to parse.
 * @returns A writable manifest object.
 */
function readContentManifest(manifestPath: string): ContentManifest {
  const value: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`content-manifest.json must contain an object: ${manifestPath}`);
  }

  return value as ContentManifest;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    const lastUpdated = writeContentUpdatedDate();
    logSuccess(`Updated code/footer content date: ${lastUpdated}`);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
