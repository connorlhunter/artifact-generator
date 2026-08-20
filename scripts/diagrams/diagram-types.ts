import type { DiagramMetadata } from "./diagram-metadata.ts";

/**
 * Mermaid workflow phase.
 */
export type DiagramPhase = "validate" | "render";

/**
 * One Mermaid source file and its SVG output.
 */
export interface DiagramJob extends DiagramMetadata {
  /**
   * Repo-relative Mermaid source path.
   */
  input: string;
  /**
   * Repo-relative SVG output path.
   */
  output: string;
}
