import { readFileSync } from "node:fs";

/** Verifies that the latest changelog release matches package.json. */
export function checkReleaseVersion(): void {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version?: unknown };
  const version = packageJson.version;

  if (typeof version !== "string") throw new Error("package.json must contain a release version.");

  const changelog = readFileSync("CHANGELOG.md", "utf8");
  const match = /^## \[?(\d+\.\d+\.\d+(?:-[\w.-]+)?)\]?\b/mu.exec(changelog);

  if (match?.[1] !== version) {
    throw new Error("CHANGELOG.md must begin with the package.json release version.");
  }
}

if (import.meta.main) checkReleaseVersion();
