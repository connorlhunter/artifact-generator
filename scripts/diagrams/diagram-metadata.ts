import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  parseVersionedArtifactMetadata,
  validateUpdatedDate,
  type VersionedArtifactMetadata,
} from "../core/versioned-artifact-metadata.ts";

const metadataPrefix = "%% artifact-generator:";
const versionedDiagramOutputPattern =
  /-v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-(\d{4}-\d{2}-\d{2})\.svg$/u;

/** Version and publication date declared by a Mermaid source file. */
export type DiagramMetadata = VersionedArtifactMetadata;

/**
 * Reads the canonical version and publication date from a Mermaid source.
 *
 * @param source - Mermaid source text.
 * @param input - Source path used in validation errors.
 * @returns The diagram's validated version and publication date.
 */
export function parseDiagramMetadata(source: string, input = "Mermaid diagram"): DiagramMetadata {
  const lines = source.split(/\r?\n/u);
  const [firstLine = ""] = lines;
  const metadataCommentCount = lines.filter((line) =>
    line.trimStart().startsWith(metadataPrefix),
  ).length;

  if (metadataCommentCount > 1) {
    throw new Error(`${input} has duplicate artifact-generator metadata comments.`);
  }

  if (!firstLine.startsWith(metadataPrefix)) {
    throw new Error(
      `${input} must begin with ${metadataPrefix}version=<major.minor.patch> lastUpdated=<YYYY-MM-DD>.`,
    );
  }

  const metadata = parseVersionedArtifactMetadata(
    firstLine.slice(metadataPrefix.length),
    `${input} metadata`,
  );
  const canonical = `${metadataPrefix}version=${metadata.version} lastUpdated=${metadata.lastUpdated}`;

  if (firstLine !== canonical) {
    throw new Error(
      `${input} must begin with ${metadataPrefix}version=<major.minor.patch> lastUpdated=<YYYY-MM-DD>.`,
    );
  }

  return metadata;
}

/**
 * Reads required metadata from one Mermaid source file.
 *
 * @param input - Mermaid source path.
 * @returns The diagram's validated version and publication date.
 */
export function readDiagramMetadata(input: string): DiagramMetadata {
  return parseDiagramMetadata(readFileSync(input, "utf8"), input);
}

/**
 * Derives the versioned public SVG path for a Mermaid source.
 *
 * @param input - Stable Mermaid source path.
 * @param metadata - Version and publication date declared by the source.
 * @returns SVG path in the same directory as the Mermaid source.
 */
export function diagramOutputPath(input: string, metadata: DiagramMetadata): string {
  const name = basename(input, ".mmd");
  return join(dirname(input), `${name}-v${metadata.version}-${metadata.lastUpdated}.svg`);
}

/**
 * Returns true when an SVG path uses the required versioned diagram filename.
 *
 * @param output - Candidate SVG output path.
 * @returns Whether the path has a strict version and ISO date suffix.
 */
export function isVersionedDiagramOutput(output: string): boolean {
  const match = versionedDiagramOutputPattern.exec(output);
  const lastUpdated = match?.[1];

  if (lastUpdated === undefined) return false;

  try {
    validateUpdatedDate(lastUpdated);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recovers a stable Mermaid source path from a versioned SVG output path.
 *
 * @param output - Versioned or legacy SVG output path.
 * @returns Corresponding Mermaid source path.
 */
export function diagramSourcePath(output: string): string {
  return output.replace(versionedDiagramOutputPattern, ".mmd").replace(/\.svg$/u, ".mmd");
}
