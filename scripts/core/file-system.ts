import { existsSync, mkdirSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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

/** Writes beside the destination and replaces it only after the new file is complete. */
export async function writeAtomically(
  output: string,
  write: (temporary: string) => Promise<void>,
): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  const staged = await mkdtemp(join(dirname(output), ".artifact-"));
  try {
    const temporary = join(staged, "output");
    await write(temporary);
    await rename(temporary, output);
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
}
