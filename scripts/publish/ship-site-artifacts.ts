import { isEntrypoint } from "../core/script-entry.ts";
import { logCaughtError, logError } from "../core/script-logger.ts";
import { sourceInputCommandArgs } from "../core/source-input-selection.ts";
import { buildSiteArtifacts } from "./build-site-artifacts.ts";
import { publishSiteArtifacts } from "./publish-site-artifacts.ts";

interface ShipSiteArtifactActions {
  readonly build: (args: string[]) => Promise<void>;
  readonly publish: () => Promise<void>;
}

const defaultActions: ShipSiteArtifactActions = {
  build: buildSiteArtifacts,
  publish: publishSiteArtifacts,
};

/**
 * Builds and publishes one artifact bundle with the same source selection.
 *
 * @param args - CLI args after the script name.
 * @param actions - Build and publish operations.
 */
export async function shipSiteArtifacts(
  args: string[] = [],
  actions: ShipSiteArtifactActions = defaultActions,
): Promise<void> {
  await actions.build(sourceInputCommandArgs(args));
  await actions.publish();
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await shipSiteArtifacts(process.argv.slice(2));
  } catch (error) {
    logCaughtError(error);
    logError("Unable to build and publish generated artifacts.");
    process.exit(1);
  }
}
