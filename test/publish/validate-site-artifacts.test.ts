import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { validateSiteArtifacts } from "../../scripts/publish/validate-site-artifacts.ts";
import { artifactPath } from "../../scripts/core/artifact-path.ts";
import { readProjectManifest } from "../../scripts/content/project-manifest.ts";
import { createPublishFixture } from "../resources/publish-fixture.ts";

let root: string;
let fixture: ReturnType<typeof createPublishFixture>;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "publish-validation-"));
  fixture = createPublishFixture(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const validate = () => validateSiteArtifacts(fixture.artifacts, fixture.assets);
function editJson(path: string, edit: (value: any) => void): void {
  const file = join(fixture.artifacts, path);
  const value = JSON.parse(readFileSync(file, "utf8"));
  edit(value);
  writeFileSync(file, JSON.stringify(value));
}

test("validates a complete bundle while preserving reports owned by other projects", () => {
  expect(validate).not.toThrow();
  editJson("manifests/project-artifacts.json", (value) => {
    value.projects["external-project"].iconPath = "https://example.com/icon.svg";
  });
  expect(validate).not.toThrow();
});

test.each([
  "manifests/content-manifest.json",
  "content/site.json",
  "docs/artifact-generator/docs.pdf",
  "docs/artifact-generator/pages/overview.md",
  "diagrams/artifact-generator/overview.svg",
  "projects/artifact-generator/coverage/index.json",
  "projects/artifact-generator/changelog/changelog.pdf",
])("rejects incomplete bundles before publication: %s", (path) => {
  rmSync(join(fixture.artifacts, path));
  expect(validate).toThrow();
});

test("rejects documents with missing content, invalid metadata, duplicate IDs, or unsafe paths", () => {
  const path = "docs/artifact-generator/index.json";
  const original = readFileSync(join(fixture.artifacts, path), "utf8");
  const edits: Array<(value: any) => void> = [
    (v) => {
      v.schemaVersion = 1;
    },
    (v) => {
      v.title = "";
    },
    (v) => {
      v.pages = [];
    },
    (v) => {
      v.pages[0] = null;
    },
    (v) => {
      v.pages[0].version = "next";
    },
    (v) => {
      v.pages[0].lastUpdated = "2026-02-30";
    },
    (v) => {
      v.pages.push(v.pages[0]);
    },
    (v) => {
      v.pages[0].path = "../outside.md";
    },
    (v) => {
      v.pages[0].path = "page.html";
    },
  ];
  for (const edit of edits) {
    writeFileSync(join(fixture.artifacts, path), original);
    editJson(path, edit);
    expect(validate).toThrow();
  }
  writeFileSync(join(fixture.artifacts, path), original);
  writeFileSync(join(fixture.artifacts, "docs/artifact-generator/pages/overview.md"), "");
  expect(validate).toThrow("Empty published document");
});

test("rejects diagrams whose metadata differs from the manifest", () => {
  writeFileSync(join(fixture.artifacts, "diagrams/artifact-generator/overview.svg"), "<svg></svg>");
  expect(validate).toThrow("metadata differs");
});

test("rejects mismatched project sets and invalid report ownership", () => {
  editJson("content/site.json", (v) => {
    v.projects.pop();
  });
  expect(validate).toThrow("different projects");
  fixture = createPublishFixture(root);
  editJson("manifests/project-artifacts.json", (v) => {
    v.projects["external-project"].coverage.indexPath =
      "projects/artifact-generator/coverage/index.json";
  });
  expect(validate).toThrow("another project");
});

test("rejects unreadable PDFs and files outside the bundle", () => {
  const pdf = join(fixture.assets, "resume/connor-hunter-resume.pdf");
  writeFileSync(pdf, "not a PDF");
  expect(validate).toThrow("Invalid published PDF");
  rmSync(pdf);
  const outside = join(root, "outside.pdf");
  writeFileSync(outside, "%PDF-1.7 fixture");
  symlinkSync(outside, pdf);
  expect(validate).toThrow("Invalid published file");
});

test.each([
  "../outside",
  "%2e%2e/outside",
  "/absolute",
  "C:/file",
  "https://example.com",
  "bad\\path",
  "bad%00path",
  "bad%",
  "docs//page",
  "docs/page?raw",
  "",
  null,
])("rejects invalid logical paths: %s", (path) => {
  expect(() => artifactPath(root, path)).toThrow();
});

test("rejects unsafe project slugs even if the manifest contains them", () => {
  const manifest = join(root, "manifest.json");
  writeFileSync(manifest, '{"projects":{"../outside":{}}}');
  expect(() => readProjectManifest(manifest)).toThrow("Invalid project slug");
});
