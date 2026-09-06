import { existsSync, mkdirSync } from "node:fs";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";

export { copyFile };

/** Reads UTF-8 source text in Bun or Node. */
export function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/** Writes UTF-8 source text without a runtime-specific file adapter. */
export function writeText(path: string, contents: string): Promise<void> {
  return writeFile(path, contents, "utf8");
}

/** Removes an output path, including directories and broken symlinks. */
export function removePath(path: string): Promise<void> {
  return rm(path, { recursive: true, force: true });
}

export async function pathExists(path: string): Promise<boolean> {
  return existsSync(path);
}

export function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}
