import { readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { renderDiagrams } from "../diagrams/render-diagrams.ts";
import { renderDocsPdf } from "../docs/render-docs-pdf.ts";
import { renderDocsPreview } from "../docs/render-docs-preview.ts";
import { artifactPaths, sourceInputDirs } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logHeading, logItem, logSuccess } from "../core/script-logger.ts";
import {
  cleanPublishOutputs,
  copyDocsPreview,
  copyRenderedDiagrams,
  copySharedPublishInputs,
  publishOutputs,
} from "./assemble-site-artifacts.ts";

const projectManifestPath = `${sourceInputDirs.manifests}/project-artifacts.json`;

/**
 * Project artifact manifest shape needed by this publish command.
 */
interface ProjectManifest {
  /**
   * Projects keyed by portfolio slug.
   */
  readonly projects: Record<string, unknown>;
}

/**
 * Reads project slugs from the shared artifact manifest.
 *
 * @param manifestPath - Manifest path to read.
 * @returns Ordered project slugs.
 */
export function projectSlugsFromManifest(manifestPath = projectManifestPath): string[] {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ProjectManifest;

  return Object.keys(manifest.projects);
}

/**
 * Renders project docs and diagrams, then assembles CloudFront-ready bundles.
 *
 * @param docsArgs - Extra docs render args such as GitHub source-link options.
 */
export async function buildSiteArtifacts(docsArgs: string[] = []): Promise<void> {
  const projectSlugs = projectSlugsFromManifest();

  if (projectSlugs.length === 0) {
    throw new Error(`No projects found in ${projectManifestPath}`);
  }

  cleanPublishOutputs();
  logHeading("Building project artifact bundle", { count: projectSlugs.length });

  await renderDiagrams(projectSlugs);

  for (const slug of projectSlugs) {
    logItem(`Rendering docs preview for ${slug}`, 1);
    rmSync(dirname(artifactPaths.docsPreview), { force: true, recursive: true });
    await renderDocsPreview([slug, ...docsArgs]);
    await renderDocsPdf();
    copyDocsPreview(slug);
  }

  const diagramCount = copyRenderedDiagrams();
  logItem(`Rendered diagrams copied: ${diagramCount}`, 1);
  copySharedPublishInputs();

  logSuccess(`Built site artifacts: ${publishOutputs.siteArtifacts}`);
  logSuccess(`Built site assets: ${publishOutputs.siteAssets}`);
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await buildSiteArtifacts(process.argv.slice(2));
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
