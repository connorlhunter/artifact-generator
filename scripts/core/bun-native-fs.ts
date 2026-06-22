import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  type ReadStream,
} from "node:fs";

/**
 * Minimal Bun file API used by the repository scripts.
 */
interface BunFile {
  /**
   * Reads file contents as an ArrayBuffer.
   */
  arrayBuffer(): Promise<ArrayBuffer>;
  /**
   * Deletes a file path.
   */
  delete(): Promise<void>;
  /**
   * Returns whether the path exists.
   */
  exists(): Promise<boolean>;
  /**
   * Opens a web stream for the file.
   */
  stream(): ReadableStream<Uint8Array>;
  /**
   * Reads file contents as UTF-8 text.
   */
  text(): Promise<string>;
}

/**
 * Minimal Bun runtime API used by the repository scripts.
 */
interface BunRuntime {
  /**
   * Opens a Bun file handle.
   */
  file(path: string): BunFile;
  /**
   * Writes text or bytes to a path.
   */
  write(path: string, contents: string | Uint8Array): Promise<number>;
}

const runtime = globalThis as typeof globalThis & { Bun?: BunRuntime };

/**
 * Reads UTF-8 text with Bun when available, falling back to Node for tests.
 *
 * @param {string} path - File path to read.
 * @returns {Promise<string>} File contents.
 */
export async function readText(path: string): Promise<string> {
  /* istanbul ignore next -- Bun's native file path is covered by runtime usage. */
  if (runtime.Bun) return runtime.Bun.file(path).text();

  const { readFileSync } = await import("node:fs");
  return readFileSync(path, "utf8");
}

/**
 * Writes UTF-8 text with Bun when available, falling back to Node for tests.
 *
 * @param {string} path - File path to write.
 * @param {string} contents - Text contents to write.
 */
export async function writeText(path: string, contents: string): Promise<void> {
  /* istanbul ignore next -- Bun's native write path is covered by runtime usage. */
  if (runtime.Bun) {
    await runtime.Bun.write(path, contents);
    return;
  }

  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, contents);
}

/**
 * Copies a file with Bun when available, falling back to Node for tests.
 *
 * @param {string} source - Source file path.
 * @param {string} target - Target file path.
 */
export async function copyFile(source: string, target: string): Promise<void> {
  /* istanbul ignore next -- Bun's native copy path is covered by runtime usage. */
  if (runtime.Bun) {
    const bytes = new Uint8Array(await runtime.Bun.file(source).arrayBuffer());
    await runtime.Bun.write(target, bytes);
    return;
  }

  copyFileSync(source, target);
}

/**
 * Removes a file or directory recursively.
 *
 * Directories use Node's recursive remove because Bun file deletion is
 * file-oriented and can fail on directories.
 *
 * @param {string} path - File or directory path to remove.
 */
export async function removePath(path: string): Promise<void> {
  if (existsSync(path) && statSync(path).isDirectory()) {
    rmSync(path, { recursive: true, force: true });
    return;
  }

  /* istanbul ignore next -- Bun's native delete path is covered by runtime usage. */
  if (runtime.Bun) {
    await runtime.Bun.file(path)
      .delete()
      .catch((error: unknown) => {
        if (isMissingPathError(error)) return;
        throw error;
      });
    return;
  }
  rmSync(path, { recursive: true, force: true });
}

/**
 * Returns whether a path exists.
 *
 * @param {string} path - Path to inspect.
 * @returns {Promise<boolean>} Whether the path exists.
 */
export async function pathExists(path: string): Promise<boolean> {
  /* istanbul ignore next -- Bun's native existence check is covered by runtime usage. */
  if (runtime.Bun) return runtime.Bun.file(path).exists();

  return existsSync(path);
}

/**
 * Ensures a directory exists.
 *
 * @param {string} path - Directory path to create.
 */
export function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

/**
 * Creates a readable stream for a file.
 *
 * @param {string} path - File path to stream.
 * @returns {ReadableStream<Uint8Array> | ReadStream} Bun or Node readable stream.
 */
export function fileReadStream(path: string): ReadableStream<Uint8Array> | ReadStream {
  /* istanbul ignore next -- Bun's native stream path is covered by runtime usage. */
  if (runtime.Bun) return runtime.Bun.file(path).stream();

  return createReadStream(path);
}

/* istanbul ignore next -- Used by the Bun-only delete branch above. */
function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
