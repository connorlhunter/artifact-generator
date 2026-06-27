/**
 * AWS CLI patterns that omit hidden files and directories from source uploads.
 */
export const hiddenSourcePathPatterns = [".*", "*/.*"] as const;

/**
 * @returns AWS CLI arguments for the shared hidden-path policy.
 */
export function hiddenSourcePathExcludeArgs(): string[] {
  return hiddenSourcePathPatterns.flatMap((pattern) => ["--exclude", pattern]);
}

/**
 * @param path - Source-relative path to inspect.
 * @returns Whether any meaningful path segment is hidden.
 */
export function isHiddenSourcePath(path: string): boolean {
  return path
    .split(/[\\/]+/u)
    .some((part) => part.length > 1 && part !== ".." && part.startsWith("."));
}
