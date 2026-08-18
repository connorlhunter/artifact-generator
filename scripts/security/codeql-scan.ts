import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "../core/process-utils.ts";
import { isEntrypoint } from "../core/script-entry.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheRoot = join(repositoryRoot, ".codeql-cache");
const baselinePath = join(repositoryRoot, ".github/codeql/codeql-baseline.json");
const configPath = join(repositoryRoot, ".github/codeql/codeql-config.yml");

const scans = [
  {
    language: "javascript-typescript",
    suite: "codeql/javascript-queries:codeql-suites/javascript-security-extended.qls",
  },
  {
    language: "actions",
    suite: "codeql/actions-queries:codeql-suites/actions-security-extended.qls",
  },
] as const;

/** One normalized CodeQL result used by the checked-in baseline. */
export interface CodeqlFinding {
  fingerprint: string;
  language: string;
  message: string;
  path: string;
  ruleId: string;
  startLine: number;
}

/** One reviewed finding allowed by the local scan. */
export type BaselineFinding = Omit<CodeqlFinding, "message" | "startLine">;

/** Checked-in exceptions for known CodeQL findings. */
export interface CodeqlBaseline {
  findings: BaselineFinding[];
  issue: string;
  version: 1;
}

/** Difference between current scan results and the reviewed baseline. */
export interface BaselineComparison {
  newFindings: CodeqlFinding[];
  staleFindings: BaselineFinding[];
}

/** Optional collaborators for a local CodeQL scan. */
export interface CodeqlScanOptions {
  readonly commandRunner?: typeof runCommand;
  readonly env?: NodeJS.ProcessEnv;
}

/** Reads a CodeQL CLI version response. */
export function parseCodeqlVersion(contents: string): string {
  const parsed = JSON.parse(contents) as { version?: unknown };
  if (typeof parsed.version !== "string") throw new Error("CodeQL did not report a version.");
  return parsed.version;
}

/** Rejects a CodeQL CLI version that differs from the repository toolchain. */
export function assertCodeqlVersion(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`CodeQL ${expected} is required; found ${actual}.`);
  }
}

/** Parses CodeQL SARIF into stable, comparable findings. */
export function parseSarif(contents: string, language: string): CodeqlFinding[] {
  const sarif = JSON.parse(contents) as {
    runs?: Array<{
      results?: Array<{
        locations?: Array<{
          physicalLocation?: {
            artifactLocation?: { uri?: unknown };
            region?: { startLine?: unknown };
          };
        }>;
        message?: { text?: unknown };
        partialFingerprints?: Record<string, unknown>;
        ruleId?: unknown;
      }>;
    }>;
  };

  const findings: CodeqlFinding[] = [];
  for (const run of sarif.runs ?? []) {
    for (const result of run.results ?? []) {
      const location = result.locations?.[0]?.physicalLocation;
      const path = location?.artifactLocation?.uri;
      const startLine = location?.region?.startLine;
      const message = result.message?.text;
      if (
        typeof result.ruleId !== "string" ||
        typeof path !== "string" ||
        typeof startLine !== "number" ||
        typeof message !== "string"
      ) {
        throw new Error("CodeQL SARIF contains an incomplete result.");
      }

      findings.push({
        fingerprint: selectStableFingerprint(result.partialFingerprints),
        language,
        message,
        path: decodeURIComponent(path.replace(/^file:\/\//u, "")),
        ruleId: result.ruleId,
        startLine,
      });
    }
  }

  return findings.sort(compareFinding);
}

/** Parses and validates the committed CodeQL baseline. */
export function parseBaseline(contents: string): CodeqlBaseline {
  const baseline = JSON.parse(contents) as Partial<CodeqlBaseline>;
  if (baseline.version !== 1 || typeof baseline.issue !== "string" || !baseline.issue) {
    throw new Error("CodeQL baseline metadata is invalid.");
  }
  if (!Array.isArray(baseline.findings)) throw new Error("CodeQL baseline findings are invalid.");

  for (const finding of baseline.findings) {
    if (
      typeof finding?.fingerprint !== "string" ||
      typeof finding.language !== "string" ||
      typeof finding.path !== "string" ||
      typeof finding.ruleId !== "string"
    ) {
      throw new Error("CodeQL baseline contains an invalid finding.");
    }
  }

  return baseline as CodeqlBaseline;
}

/** Compares current results with exact reviewed baseline fingerprints. */
export function compareWithBaseline(
  findings: CodeqlFinding[],
  baseline: CodeqlBaseline,
): BaselineComparison {
  const currentKeys = new Set(findings.map(findingKey));
  const baselineKeys = new Set(baseline.findings.map(findingKey));

  if (baselineKeys.size !== baseline.findings.length) {
    throw new Error("CodeQL baseline contains duplicate findings.");
  }

  return {
    newFindings: findings.filter((finding) => !baselineKeys.has(findingKey(finding))),
    staleFindings: baseline.findings.filter((finding) => !currentKeys.has(findingKey(finding))),
  };
}

/** Runs the repository's local CodeQL security scan. */
export async function scanWithCodeql(options: CodeqlScanOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  const commandRunner = options.commandRunner ?? runCommand;

  if (env.GITHUB_ACTIONS === "true") {
    console.log("Local CodeQL scan deferred to the hosted CodeQL checks.");
    return;
  }

  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
    toolchain?: { codeql?: unknown };
  };
  const expectedVersion = packageJson.toolchain?.codeql;
  if (typeof expectedVersion !== "string") {
    throw new Error("package.json must define toolchain.codeql.");
  }

  const codeql = "codeql";
  let versionOutput: Awaited<ReturnType<typeof runCommand>>;
  try {
    versionOutput = await commandRunner(
      codeql,
      ["version", "--format=json"],
      {},
      {
        cwd: repositoryRoot,
      },
    );
  } catch {
    throw new Error(`CodeQL ${expectedVersion} must be installed on PATH.`);
  }
  assertCodeqlVersion(parseCodeqlVersion(versionOutput.stdout), expectedVersion);

  rmSync(cacheRoot, { force: true, recursive: true });
  mkdirSync(cacheRoot, { recursive: true });

  const findings: CodeqlFinding[] = [];
  for (const scan of scans) {
    const databasePath = join(cacheRoot, `${scan.language}-database`);
    const resultPath = join(cacheRoot, `${scan.language}.sarif`);
    console.log(`Scanning ${scan.language} with CodeQL ${expectedVersion}...`);

    await commandRunner(
      codeql,
      [
        "database",
        "create",
        databasePath,
        `--language=${scan.language}`,
        `--source-root=${repositoryRoot}`,
        `--codescanning-config=${configPath}`,
        "--threads=0",
      ],
      { subject: scan.language },
      { cwd: repositoryRoot },
    );
    await commandRunner(
      codeql,
      [
        "database",
        "analyze",
        databasePath,
        scan.suite,
        "--format=sarif-latest",
        `--output=${resultPath}`,
        `--sarif-category=${scan.language}`,
        "--threat-model=local",
        "--threads=0",
      ],
      { subject: scan.language },
      { cwd: repositoryRoot },
    );
    findings.push(...parseSarif(readFileSync(resultPath, "utf8"), scan.language));
  }

  const baseline = parseBaseline(readFileSync(baselinePath, "utf8"));
  const comparison = compareWithBaseline(findings, baseline);
  if (comparison.newFindings.length > 0 || comparison.staleFindings.length > 0) {
    reportBaselineDifference(comparison, baseline.issue);
    throw new Error("CodeQL findings differ from the reviewed baseline.");
  }

  console.log(`CodeQL scan passed (${findings.length} reviewed findings).`);
}

function selectStableFingerprint(fingerprints: Record<string, unknown> | undefined): string {
  const candidates = Object.entries(fingerprints ?? {})
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => left.localeCompare(right));
  if (candidates.length === 0) {
    throw new Error("CodeQL SARIF result is missing a stable fingerprint.");
  }
  return candidates.map(([name, value]) => `${name}:${value}`).join("|");
}

function findingKey(finding: BaselineFinding): string {
  return [finding.language, finding.ruleId, finding.path, finding.fingerprint].join("\u0000");
}

function compareFinding(left: CodeqlFinding, right: CodeqlFinding): number {
  return findingKey(left).localeCompare(findingKey(right));
}

function reportBaselineDifference(comparison: BaselineComparison, issue: string): void {
  for (const finding of comparison.newFindings) {
    console.error(`New: ${finding.ruleId} at ${finding.path}:${finding.startLine}`);
  }
  for (const finding of comparison.staleFindings) {
    console.error(`Stale: ${finding.ruleId} at ${finding.path}`);
  }
  console.error(`Review baseline changes against ${issue}.`);
}

if (isEntrypoint(import.meta.url)) {
  try {
    await scanWithCodeql();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
