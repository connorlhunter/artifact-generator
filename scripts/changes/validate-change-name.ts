import { isEntrypoint } from "../core/script-entry.ts";

/** Change types accepted by repository naming rules. */
export const changeTypes = ["feat", "fix", "chore", "docs", "test", "refactor"] as const;

const changeTypePattern = changeTypes.join("|");
const kebabSummaryPattern = "[a-z0-9]+(?:-[a-z0-9]+)*";
const semanticBranchPattern = new RegExp(`^(?:${changeTypePattern})/${kebabSummaryPattern}$`, "u");
const semanticSubjectPattern = new RegExp(
  `^(?:${changeTypePattern})(?:\\(${kebabSummaryPattern}\\))?!?: \\S(?:.*\\S)?$`,
  "u",
);
const semanticVersionPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

/** Returns whether a branch follows the repository convention. */
export function isValidBranchName(branch: string): boolean {
  if (branch === "main" || /^dependabot\/.+$/u.test(branch)) return true;
  if (semanticBranchPattern.test(branch)) return true;
  if (!branch.startsWith("release/")) return false;
  return semanticVersionPattern.test(branch.slice("release/".length));
}

/** Returns whether an issue, pull request, or commit subject is conventional. */
export function isValidChangeSubject(subject: string): boolean {
  return !subject.includes("\n") && semanticSubjectPattern.test(subject);
}

/** Extracts the first non-comment subject from a Git commit message. */
export function commitSubject(message: string): string {
  return (
    message
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#")) ?? ""
  );
}

/** Resolves the checked-out branch, including pull request checkouts. */
export function currentBranchName(): string {
  const pullRequestBranch = process.env.GITHUB_HEAD_REF?.trim();
  if (pullRequestBranch) return pullRequestBranch;

  const result = Bun.spawnSync(["git", "branch", "--show-current"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error("Unable to read the current Git branch.");

  const branch = result.stdout.toString().trim();
  if (branch) return branch;

  const refName = process.env.GITHUB_REF_NAME?.trim();
  if (refName) return refName;
  throw new Error("Unable to resolve the current Git branch.");
}

/** Rejects a branch that does not follow the documented naming rules. */
export function validateBranchName(branch: string): void {
  if (!isValidBranchName(branch)) {
    throw new Error(
      `Invalid branch name ${JSON.stringify(branch)}; use <type>/<kebab-summary> or release/<version>.`,
    );
  }
}

/** Rejects a subject that does not follow the documented naming rules. */
export function validateChangeSubject(subject: string, kind = "Change"): void {
  if (!isValidChangeSubject(subject)) {
    throw new Error(`${kind} subject must use <type>[(scope)][!]: <summary>.`);
  }
}

/** Runs one naming check against the supplied value. */
export function runChangeNameValidation(command: string | undefined, value = ""): void {
  if (command === "branch") {
    validateBranchName(currentBranchName());
    return;
  }

  if (command === "commit") {
    validateChangeSubject(commitSubject(value), "Commit");
    return;
  }

  if (command === "pr-title") {
    validateChangeSubject(process.env.PR_TITLE?.trim() ?? "", "Pull request");
    return;
  }

  throw new Error("Use branch, commit, or pr-title.");
}

/** Runs the command-line validation and returns its process exit code. */
export async function runChangeNameValidationCli(
  command = process.argv[2],
  readStdin: () => Promise<string> = () => Bun.stdin.text(),
  reportError: (message: string) => void = (message) => console.error(message),
): Promise<number> {
  try {
    const value = command === "commit" ? await readStdin() : undefined;
    runChangeNameValidation(command, value);
    return 0;
  } catch (error) {
    reportError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  process.exitCode = await runChangeNameValidationCli();
}
