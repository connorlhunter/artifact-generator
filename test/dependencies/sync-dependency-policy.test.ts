import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  applyPinnedOverrides,
  applyReleaseAgeExcludes,
  syncDependencyPolicy,
} from "../../scripts/dependencies/sync-dependency-policy.ts";

describe("dependency policy sync", () => {
  test("applies sorted pinned overrides to package json", () => {
    const packageJson = JSON.stringify(
      {
        name: "docs",
        overrides: {
          old: "1.0.0",
        },
      },
      null,
      2,
    );

    expect(
      applyPinnedOverrides(packageJson, {
        ws: {
          reason: "Fix high-severity advisory.",
          version: "8.17.1",
        },
        "tar-fs": {
          reason: "Fix high-severity advisory.",
          version: "2.1.4",
        },
      }),
    ).toBe(
      `${JSON.stringify(
        {
          name: "docs",
          overrides: {
            "tar-fs": "2.1.4",
            ws: "8.17.1",
          },
        },
        null,
        2,
      )}\n`,
    );
  });

  test("adds, sorts, and removes release-age excludes", () => {
    const bunfig = "[install]\nminimumReleaseAge = 604800\n\n[run]\nbun = true\n";

    expect(applyReleaseAgeExcludes(bunfig, ["ws", "mermaid"])).toBe(
      '[install]\nminimumReleaseAge = 604800\nminimumReleaseAgeExcludes = ["mermaid","ws"]\n\n[run]\nbun = true\n',
    );

    expect(
      applyReleaseAgeExcludes(
        '[install]\nminimumReleaseAge = 604800\nminimumReleaseAgeExcludes = ["mermaid"]\n\n[run]\nbun = true\n',
        [],
      ),
    ).toBe(bunfig);
  });

  test("checks and syncs policy files on disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(join(tmpdir(), "dependency-policy-"));

    try {
      process.chdir(tempRoot);
      writeFileSync("package.json", `${JSON.stringify({ name: "docs" }, null, 2)}\n`);
      writeFileSync("bunfig.toml", "[install]\nminimumReleaseAge = 604800\n");
      writeFileSync(
        "dependency-pins.json",
        `${JSON.stringify(
          {
            ws: {
              reason: "Fix high-severity advisory.",
              version: "8.17.1",
            },
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        "dependency-release-age-excludes.json",
        `${JSON.stringify(
          {
            mermaid: {
              reason: "Security fix cannot wait for the one-week age window.",
            },
          },
          null,
          2,
        )}\n`,
      );

      await expect(syncDependencyPolicy(true)).rejects.toThrow("Dependency policy is out of sync");
      await expect(syncDependencyPolicy()).resolves.toBe(true);
      await expect(syncDependencyPolicy(true)).resolves.toBe(false);

      expect(JSON.parse(readFileSync("package.json", "utf8"))).toMatchObject({
        overrides: {
          ws: "8.17.1",
        },
      });
      expect(readFileSync("bunfig.toml", "utf8")).toContain(
        'minimumReleaseAgeExcludes = ["mermaid"]',
      );
    } finally {
      process.chdir(originalCwd);
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
