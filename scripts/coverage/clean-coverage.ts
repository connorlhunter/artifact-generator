import { artifactPaths } from "../core/script-constants.ts";
import { removePath } from "../core/bun-native-fs.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logSuccess } from "../core/script-logger.ts";

/**
 * Removes stale coverage output before Bun writes a fresh report.
 */
export async function cleanCoverage(): Promise<void> {
  await removePath(artifactPaths.coverageDir);
  logSuccess(`Cleaned coverage output: ${artifactPaths.coverageDir}`);
}

if (isEntrypoint(import.meta.url)) {
  await cleanCoverage();
}
