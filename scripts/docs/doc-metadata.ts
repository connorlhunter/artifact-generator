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
