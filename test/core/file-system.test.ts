import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  copyFile,
  ensureDirectory,
  pathExists,
  readText,
  removePath,
  writeText,
} from "../../scripts/core/file-system.ts";

describe("file system helpers", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "docs-fs-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("reads, writes, and checks source paths", async () => {
    const file = join(tempDir, "file.txt");

    await writeText(file, "hello");

    expect(readFileSync(file, "utf8")).toBe("hello");
    expect(await readText(file)).toBe("hello");
    expect(await pathExists(file)).toBe(true);
    expect(await pathExists(join(tempDir, "missing.txt"))).toBe(false);
    expect(await pathExists(tempDir)).toBe(true);
  });

  test("ensures directories and removes files or folders", async () => {
    const nestedDir = join(tempDir, "nested", "inner");
    const nestedFile = join(nestedDir, "file.txt");
    const looseFile = join(tempDir, "loose.txt");

    ensureDirectory(nestedDir);
    writeFileSync(nestedFile, "nested");
    writeFileSync(looseFile, "loose");

    await removePath(join(tempDir, "nested"));
    await removePath(looseFile);
    await removePath(join(tempDir, "missing"));

    expect(await pathExists(nestedFile)).toBe(false);
    expect(await pathExists(looseFile)).toBe(false);
  });

  test("copies file bytes", async () => {
    const source = join(tempDir, "source.svg");
    const target = join(tempDir, "target.svg");

    writeFileSync(source, "<svg></svg>");
    await copyFile(source, target);

    expect(readFileSync(target, "utf8")).toBe("<svg></svg>");
  });
});
