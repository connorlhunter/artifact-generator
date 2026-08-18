import { readFileSync, writeFileSync } from "node:fs";
import { sourceInputDirs } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logSuccess } from "../core/script-logger.ts";

const contentManifestPath = `${sourceInputDirs.manifests}/content-manifest.json`;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

interface ContentManifest {
  readonly [key: string]: unknown;
  lastUpdated?: unknown;
}

/**
 * @param date - Publication time to represent in the source manifest.
 * @returns An ISO calendar date in UTC.
 */
export function artifactUpdatedDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * @param value - ISO calendar date from the source manifest.
 * @returns A concise date label for rendered artifact pages.
 */
export function formatArtifactUpdatedDate(value: string): string {
  if (!datePattern.test(value)) {
    throw new Error(`content-manifest.json has an invalid lastUpdated date: ${value}`);
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

/**
 * @param manifestPath - Source manifest containing the artifact publication date.
 * @returns The validated date used by rendered artifact pages.
 */
export function readArtifactUpdatedDate(manifestPath = contentManifestPath): string {
  const manifest = readContentManifest(manifestPath);

  if (typeof manifest.lastUpdated !== "string") {
    throw new Error(`content-manifest.json is missing lastUpdated: ${manifestPath}`);
  }

  formatArtifactUpdatedDate(manifest.lastUpdated);
  return manifest.lastUpdated;
}

/**
 * Updates the source manifest immediately before artifact rendering.
 *
 * @param manifestPath - Editable source manifest to update.
 * @param date - Publication time to write.
 * @returns The ISO calendar date written to the manifest.
 */
export function writeArtifactUpdatedDate(
  manifestPath = contentManifestPath,
  date = new Date(),
): string {
  const manifest = readContentManifest(manifestPath);
  const lastUpdated = artifactUpdatedDate(date);

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
    const lastUpdated = writeArtifactUpdatedDate();
    logSuccess(`Updated artifact source date: ${lastUpdated}`);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
