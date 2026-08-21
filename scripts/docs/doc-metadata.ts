import { existsSync } from "node:fs";
import { readText } from "../core/bun-native-fs.ts";
import {
  parseVersionedArtifactMetadata,
  type VersionedArtifactMetadata,
} from "../core/versioned-artifact-metadata.ts";

const metadataCommentPattern = /<!-- artifact-generator:([^<>\r\n]+) -->/u;
const firstLineMetadataPattern = /^<!-- artifact-generator:([^<>\r\n]+) -->(?:\r?\n|$)/u;
const duplicatePreamblePattern = /^(?:[ \t]*\r?\n)*<!-- artifact-generator:[^<>\r\n]+ -->/u;

/** Parsed Markdown source with its required artifact metadata removed from the rendered body. */
export interface ParsedDocSource {
  /** Markdown content rendered into the document article. */
  readonly body: string;
  /** Version and update date owned by this Markdown file. */
  readonly metadata: VersionedArtifactMetadata;
}

/** File that owns the version and update date for one documentation collection. */
export const documentMetadataFile = "document-metadata.json";

/**
 * Reads centralized metadata for a documentation collection.
 *
 * @param path - Metadata file path.
 * @returns Validated collection metadata, or undefined for legacy per-file metadata.
 */
export async function readDocumentMetadata(
  path: string,
): Promise<VersionedArtifactMetadata | undefined> {
  if (!existsSync(path)) return undefined;

  let value: unknown;

  try {
    value = JSON.parse(await readText(path));
  } catch {
    throw new Error(`${path} must contain valid JSON.`);
  }

  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { version?: unknown }).version !== "string" ||
    typeof (value as { lastUpdated?: unknown }).lastUpdated !== "string"
  ) {
    throw new Error(`${path} must contain string version and lastUpdated fields.`);
  }

  const metadata = parseVersionedArtifactMetadata(
    `version=${(value as { version: string }).version} lastUpdated=${(value as { lastUpdated: string }).lastUpdated}`,
    path,
  );
  const canonical = JSON.stringify(metadata, null, 2);

  if ((await readText(path)).trim() !== canonical) {
    throw new Error(`${path} must use canonical document metadata JSON.`);
  }

  return metadata;
}

/**
 * Validates a Markdown body when its metadata is owned by its document collection.
 *
 * @param markdown - Complete Markdown source.
 * @param source - Source path used in validation errors.
 * @returns Unchanged Markdown body.
 */
export function parseCentralizedDocSource(markdown: string, source: string): string {
  if (firstLineMetadataPattern.test(markdown)) {
    throw new Error(`${source} metadata belongs in ${documentMetadataFile}.`);
  }

  return markdown;
}

/**
 * Reads the required first-line metadata comment from one Markdown source.
 *
 * @param markdown - Complete Markdown source.
 * @param source - Source path used in validation errors.
 * @returns Renderable Markdown body and source-owned metadata.
 */
export function parseDocSource(markdown: string, source: string): ParsedDocSource {
  const firstLine = firstLineMetadataPattern.exec(markdown);

  if (firstLine === null) {
    if (!metadataCommentPattern.test(markdown)) {
      throw new Error(`${source} is missing its artifact-generator metadata comment.`);
    }

    throw new Error(`${source} artifact-generator metadata must be the first line.`);
  }

  const body = markdown.slice(firstLine[0].length);

  if (duplicatePreamblePattern.test(body)) {
    throw new Error(`${source} has duplicate artifact-generator metadata comments.`);
  }

  const metadata = parseVersionedArtifactMetadata(firstLine[1] ?? "", source);
  const declaration = firstLine[0].replace(/\r?\n$/u, "");
  const canonical = `<!-- artifact-generator:version=${metadata.version} lastUpdated=${metadata.lastUpdated} -->`;

  if (declaration !== canonical) {
    throw new Error(
      `${source} must begin with <!-- artifact-generator:version=<major.minor.patch> lastUpdated=<YYYY-MM-DD> -->.`,
    );
  }

  return {
    body,
    metadata,
  };
}
