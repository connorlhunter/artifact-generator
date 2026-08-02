import { getDocRoots, type MarkdownDoc } from "../docs-utils.ts";
import { sourceInputCommandArgs } from "../../core/source-input-selection.ts";

/**
 * Optional GitHub source-link settings for generated docs.
 */
export interface DocsPreviewGitHubOptions {
  /**
   * GitHub repository in `owner/repo` form.
   */
  repo: string;
  /**
   * Branch or ref used for source links.
   */
  branch: string;
}

/**
 * Parsed docs preview CLI options.
 */
export interface DocsPreviewOptions {
  /**
   * Roots passed to Markdown discovery.
   */
  roots: string[];
  /**
   * Optional GitHub source-link settings.
   */
  github?: DocsPreviewGitHubOptions;
}

const defaultGitHubBranch = "main";

/**
 * Removes accidental GitHub URL wrapping and keeps owner/repo.
 *
 * @param {string} value - Raw repository value.
 * @returns {string} Normalized owner/repo value.
 */
function normalizeGitHubRepo(value: string): string {
  return value
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "")
    .replace(/^\/|\/$/g, "");
}

/**
 * Encodes path segments without escaping path separators.
 *
 * @param {string} value - Repo-relative path or branch value.
 * @returns {string} URL-safe path.
 */
function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

/**
 * Builds a GitHub file URL for one Markdown source.
 *
 * @param {MarkdownDoc} doc - Document to link.
 * @param {DocsPreviewGitHubOptions | undefined} github - GitHub options.
 * @returns {string | null} Source URL when GitHub options are available.
 */
export function githubSourceUrl(
  doc: MarkdownDoc,
  github: DocsPreviewGitHubOptions | undefined,
): string | null {
  if (!github) return null;

  return `https://github.com/${encodePath(github.repo)}/blob/${encodePath(github.branch)}/${encodePath(doc.input)}`;
}

/**
 * Parses render options without passing preview-specific flags to root lookup.
 *
 * @param {string[]} args - CLI args after the script name.
 * @returns {DocsPreviewOptions} Parsed preview options.
 */
export function parseDocsPreviewOptions(args: string[]): DocsPreviewOptions {
  const rootArgs: string[] = [];
  let githubRepo: string | undefined;
  let githubBranch = defaultGitHubBranch;

  const commandArgs = sourceInputCommandArgs(args);

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index] as string;

    if (arg === "--github") {
      githubRepo = commandArgs[(index += 1)];
      continue;
    }

    if (arg.startsWith("--github=")) {
      githubRepo = arg.slice("--github=".length);
      continue;
    }

    if (arg === "--github-branch") {
      githubBranch = commandArgs[(index += 1)] ?? githubBranch;
      continue;
    }

    if (arg.startsWith("--github-branch=")) {
      githubBranch = arg.slice("--github-branch=".length);
      continue;
    }

    rootArgs.push(arg);
  }

  const repo = githubRepo ? normalizeGitHubRepo(githubRepo) : "";
  const options: DocsPreviewOptions = { roots: getDocRoots(rootArgs) };
  if (repo) options.github = { branch: githubBranch, repo };
  return options;
}
