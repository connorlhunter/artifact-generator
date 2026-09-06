import { readProjectManifest } from "../content/project-manifest.ts";
import { renderCoveragePdf } from "../coverage/render-coverage-pdf.ts";
import { renderCoverageReport } from "../coverage/render-coverage-report.ts";
import { buildChangelogArtifact } from "../changelog/changelog-artifact.ts";
import { buildSiteContentArtifact } from "../content/build-site-content.ts";
import { renderDiagrams } from "../diagrams/render-diagrams.ts";
import { buildDocsArtifact } from "../docs/document-artifact.ts";
import { sourceInputDirs } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logHeading, logItem, logSuccess } from "../core/script-logger.ts";
import { buildResume } from "../resume/build-resume.ts";
import {
  sourceInputCommandArgs,
  validateSourceInputSelection,
} from "../core/source-input-selection.ts";
import {
  cleanPublishOutputs,
  copyDocsArtifact,
  copyRenderedDiagrams,
  copySharedPublishInputs,
  publishOutputs,
} from "./assemble-site-artifacts.ts";

const projectManifestPath = `${sourceInputDirs.manifests}/project-artifacts.json`;

/** Dependencies used to build the published artifact bundle. */
export interface BuildSiteArtifactActions {
  readonly buildChangelogArtifact: typeof buildChangelogArtifact;
  readonly buildDocsArtifact: typeof buildDocsArtifact;
  readonly buildResume: typeof buildResume;
  readonly buildSiteContentArtifact: typeof buildSiteContentArtifact;
  readonly cleanPublishOutputs: typeof cleanPublishOutputs;
  readonly copyDocsArtifact: typeof copyDocsArtifact;
  readonly copyRenderedDiagrams: typeof copyRenderedDiagrams;
  readonly copySharedPublishInputs: typeof copySharedPublishInputs;
  readonly projectSlugsFromManifest: typeof projectSlugsFromManifest;
  readonly renderCoveragePdf: typeof renderCoveragePdf;
  readonly renderCoverageReport: typeof renderCoverageReport;
  readonly renderDiagrams: typeof renderDiagrams;
  readonly validateSourceInputSelection: typeof validateSourceInputSelection;
}

const defaultActions: BuildSiteArtifactActions = {
  buildChangelogArtifact,
  buildDocsArtifact,
  buildResume,
  buildSiteContentArtifact,
  cleanPublishOutputs,
  copyDocsArtifact,
  copyRenderedDiagrams,
  copySharedPublishInputs,
  projectSlugsFromManifest,
  renderCoveragePdf,
  renderCoverageReport,
  renderDiagrams,
  validateSourceInputSelection,
};

/**
 * Reads project slugs from the shared artifact manifest.
 *
 * @param manifestPath - Manifest path to read.
 * @returns Ordered project slugs.
 */
export function projectSlugsFromManifest(manifestPath = projectManifestPath): string[] {
  return Object.keys(readProjectManifest(manifestPath));
}

/**
 * Renders project docs and diagrams, then assembles CloudFront-ready bundles.
 *
 * @param docsArgs - Source selection arguments preserved for the CLI contract.
 */
export async function buildSiteArtifacts(
  docsArgs: string[] = [],
  actions: BuildSiteArtifactActions = defaultActions,
): Promise<void> {
  actions.validateSourceInputSelection();
  sourceInputCommandArgs(docsArgs);
  const projectSlugs = actions.projectSlugsFromManifest();

  if (projectSlugs.length === 0) {
    throw new Error(`No projects found in ${projectManifestPath}`);
  }

  actions.cleanPublishOutputs();
  logHeading("Building project artifact bundle", { count: projectSlugs.length });

  await actions.renderCoverageReport();
  await actions.renderCoveragePdf();
  await actions.buildChangelogArtifact();
  actions.buildSiteContentArtifact();
  await actions.buildResume();
  await actions.renderDiagrams(projectSlugs);

  for (const slug of projectSlugs) {
    logItem(`Compiling docs for ${slug}`, 1);
    await actions.buildDocsArtifact(slug);
    actions.copyDocsArtifact(slug);
  }

  const diagramCount = actions.copyRenderedDiagrams();
  logItem(`Rendered diagrams copied: ${diagramCount}`, 1);
  actions.copySharedPublishInputs();

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
