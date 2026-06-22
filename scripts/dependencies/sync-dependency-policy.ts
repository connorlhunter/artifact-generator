import { readText, writeText } from "../core/bun-native-fs.ts";
import { repoFiles } from "../core/script-constants.ts";
import { logCaughtError, logSuccess } from "../core/script-logger.ts";
import { isEntrypoint } from "../core/script-entry.ts";

const packageJsonPath = repoFiles.packageJson;
const bunfigPath = repoFiles.bunfig;
const dependencyPinsPath = repoFiles.dependencyPins;
const releaseAgeExcludesPath = repoFiles.dependencyReleaseAgeExcludes;

/**
 * One exact package override managed by dependency policy.
 */
export interface DependencyPin {
  /**
   * Reason for accepting this exact package version.
   */
  reason: string;
  /**
   * Exact package version written to `package.json` overrides.
   */
  version: string;
}

/**
 * One package allowed to bypass Bun's minimum release age gate.
 */
export interface ReleaseAgeExclude {
  /**
   * Reason why waiting for the age gate is not acceptable.
   */
  reason: string;
}

/**
 * Minimal `package.json` shape managed by this script.
 */
export interface PackageJson {
  /**
   * Package-manager overrides generated from `dependency-pins.json`.
   */
  overrides?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Dependency pin policy keyed by package name.
 */
export type DependencyPins = Record<string, DependencyPin>;

/**
 * Release-age exclusion policy keyed by package name.
 */
export type ReleaseAgeExcludes = Record<string, ReleaseAgeExclude>;

/**
 * Syncs dependency policy files into the package manager config files.
 *
 * `dependency-pins.json` is the reviewed source for `package.json` overrides.
 * `dependency-release-age-excludes.json` is the reviewed source for Bun
 * `minimumReleaseAgeExcludes`.
 *
 * @param {boolean} checkOnly - When true, report drift without writing files.
 * @returns {Promise<boolean>} Whether any managed file needed changes.
 */
export async function syncDependencyPolicy(checkOnly = false): Promise<boolean> {
  const pins = parseJson<DependencyPins>(await readText(dependencyPinsPath), dependencyPinsPath);
  const excludes = parseJson<ReleaseAgeExcludes>(
    await readText(releaseAgeExcludesPath),
    releaseAgeExcludesPath,
  );

  const packageJson = await readText(packageJsonPath);
  const bunfig = await readText(bunfigPath);
  const nextPackageJson = applyPinnedOverrides(packageJson, pins);
  const nextBunfig = applyReleaseAgeExcludes(bunfig, Object.keys(excludes).sort());
  const changedPaths: string[] = [];

  if (nextPackageJson !== packageJson) changedPaths.push(packageJsonPath);
  if (nextBunfig !== bunfig) changedPaths.push(bunfigPath);

  if (checkOnly) {
    if (changedPaths.length > 0) {
      throw new Error(
        `Dependency policy is out of sync. Run bun run deps:policy. Changed files: ${changedPaths.join(", ")}`,
      );
    }
    return false;
  }

  if (nextPackageJson !== packageJson) await writeText(packageJsonPath, nextPackageJson);
  if (nextBunfig !== bunfig) await writeText(bunfigPath, nextBunfig);
  return changedPaths.length > 0;
}

/**
 * Replaces `package.json` overrides with the exact versions from the pin policy.
 *
 * Generates:
 * `"overrides": { "react": "19.0.0" }`
 * inside `package.json`.
 *
 * Existing overrides are replaced entirely using the reviewed dependency pin
 * policy to ensure deterministic dependency resolution and centralized
 * governance of pinned packages.
 *
 * Package names are sorted alphabetically before generation to keep diffs
 * stable and reproducible.
 *
 * @param {string} packageJson - Raw package.json text.
 * @param {DependencyPins} pins - Packages and exact versions to pin.
 * @returns {string} Formatted package.json text.
 */
export function applyPinnedOverrides(packageJson: string, pins: DependencyPins): string {
  const parsed = parseJson<PackageJson>(packageJson, packageJsonPath);
  parsed.overrides = Object.fromEntries(
    Object.entries(pins)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, pin]) => [name, pin.version]),
  );
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

/**
 * Replaces Bun release-age exclusions with the packages from the exclusion policy.
 *
 * Generates:
 * `minimumReleaseAgeExcludes = ["aws-sdk","next","react"]`
 * inside `bunfig.toml`.
 *
 * Existing generated exclusions are removed before regeneration to ensure
 * deterministic output and prevent duplicate entries.
 *
 * @param {string} bunfig - Raw bunfig.toml text.
 * @param {string[]} excludes - Package names allowed to bypass minimumReleaseAge.
 * @returns {string} Updated bunfig.toml text.
 */
export function applyReleaseAgeExcludes(bunfig: string, excludes: string[]): string {
  const withoutExistingExcludes = bunfig.replace(/^minimumReleaseAgeExcludes\s*=.*\n?/m, "");
  const sortedExcludes = [...excludes].sort((left, right) => left.localeCompare(right));
  if (excludes.length === 0) return withoutExistingExcludes;

  const excludesLine = `minimumReleaseAgeExcludes = ${JSON.stringify(sortedExcludes)}\n`;
  if (/^minimumReleaseAge\s*=.*$/m.test(withoutExistingExcludes)) {
    return withoutExistingExcludes.replace(/^(minimumReleaseAge\s*=.*\n)/m, `$1${excludesLine}`);
  }

  return `${withoutExistingExcludes.trimEnd()}\n${excludesLine}`;
}

function parseJson<T>(contents: string, path: string): T {
  try {
    return JSON.parse(contents) as T;
  } catch (error) {
    throw new Error(`Unable to parse ${path}: ${error instanceof Error ? error.message : error}`);
  }
}

if (isEntrypoint(import.meta.url)) {
  try {
    const changed = await syncDependencyPolicy(process.argv.includes("--check"));
    logSuccess(changed ? "Synced dependency policy." : "Dependency policy already in sync.");
  } catch (error) {
    logCaughtError(error);
    process.exit(1);
  }
}
