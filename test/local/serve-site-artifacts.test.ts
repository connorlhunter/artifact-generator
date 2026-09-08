import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  artifactRequestPath,
  artifactResponseHeaders,
  localArtifactPath,
  localArtifactResponse,
  localProjectArtifactPath,
  serveLocalArtifacts,
} from "../../scripts/local/serve-site-artifacts.ts";

let temporaryDirectory = "";

afterEach(() => {
  if (temporaryDirectory) rmSync(temporaryDirectory, { force: true, recursive: true });
  temporaryDirectory = "";
});

describe("local artifact server", () => {
  test("maps project-owned coverage and changelog outputs to their local repositories", () => {
    expect(localProjectArtifactPath("connor-hunter", "coverage", "index.json", "/workspace")).toBe(
      "/workspace/connorhunter/coverage/index.json",
    );
    expect(localProjectArtifactPath("cipher", "changelog", "CHANGELOG.md", "/workspace")).toBe(
      "/workspace/cipher/changelog/CHANGELOG.md",
    );
    expect(
      localProjectArtifactPath("artifact-generator", "changelog", "changelog.pdf", "/workspace"),
    ).toBe("/workspace/artifact-generator/dist/changelog/artifact-generator/changelog.pdf");
    expect(
      localProjectArtifactPath("cipher", "coverage", "lcov.info", "/workspace"),
    ).toBeUndefined();
  });

  test("prefers an existing project-owned report and falls back to the assembled bundle", () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-local-server-"));
    const workspace = join(temporaryDirectory, "workspace");
    const bundle = join(temporaryDirectory, "bundle");
    const coverage = join(workspace, "cipher", "coverage", "index.json");
    const docs = join(bundle, "docs", "cipher", "index.json");
    mkdirSync(join(workspace, "cipher", "coverage"), { recursive: true });
    mkdirSync(join(bundle, "docs", "cipher"), { recursive: true });
    writeFileSync(coverage, "{}\n");
    writeFileSync(docs, "{}\n");

    expect(localArtifactPath("projects/cipher/coverage/index.json", workspace, bundle)).toBe(
      coverage,
    );
    expect(localArtifactPath("docs/cipher/index.json", workspace, bundle)).toBe(docs);
    expect(localArtifactPath("", workspace, bundle)).toBeUndefined();
    expect(localArtifactPath("../private.json", workspace, bundle)).toBeUndefined();
    expect(localArtifactPath("docs/cipher", workspace, bundle)).toBeUndefined();
    expect(localArtifactPath("docs/cipher/index.json/nested", workspace, bundle)).toBeUndefined();
    expect(
      localArtifactPath("projects/constructor/coverage/index.json", workspace, bundle),
    ).toBeUndefined();
  });

  test("rejects unsafe request paths before resolving a local artifact", () => {
    expect(
      artifactRequestPath(new Request("http://localhost/projects/cipher/coverage/index.json")),
    ).toBe("projects/cipher/coverage/index.json");
    expect(
      artifactRequestPath(new Request("http://localhost/%2e%2e%2fprivate.json")),
    ).toBeUndefined();
    expect(
      artifactRequestPath(new Request("http://localhost/projects/%5cprivate.json")),
    ).toBeUndefined();
    expect(artifactRequestPath(new Request("http://localhost/"))).toBeUndefined();
    expect(artifactRequestPath(new Request("http://localhost/%00file.json"))).toBeUndefined();
    expect(artifactRequestPath({ url: "http://%" } as Request)).toBeUndefined();
  });

  test("serves safe local artifacts with consistent response headers", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-local-response-"));
    const workspace = join(temporaryDirectory, "workspace");
    const bundle = join(temporaryDirectory, "bundle");
    const artifact = join(workspace, "cipher", "coverage", "index.json");
    mkdirSync(join(workspace, "cipher", "coverage"), { recursive: true });
    writeFileSync(artifact, '{"schemaVersion":2}\n');

    const options = await localArtifactResponse(
      new Request("http://localhost/projects/cipher/coverage/index.json", { method: "OPTIONS" }),
      workspace,
      bundle,
    );
    const found = await localArtifactResponse(
      new Request("http://localhost/projects/cipher/coverage/index.json"),
      workspace,
      bundle,
    );
    const missing = await localArtifactResponse(
      new Request("http://localhost/projects/cipher/coverage/missing.json"),
      workspace,
      bundle,
    );

    expect(options.status).toBe(200);
    expect(found.status).toBe(200);
    expect(await found.text()).toContain('"schemaVersion":2');
    expect(missing.status).toBe(404);
    const head = localArtifactResponse(
      new Request("http://localhost/projects/cipher/coverage/index.json", { method: "HEAD" }),
      workspace,
      bundle,
    );
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect(head.headers.get("content-length")).toBe(found.headers.get("content-length"));
    expect(head.headers.get("content-type")).toContain("application/json");
    const post = localArtifactResponse(
      new Request("http://localhost/projects/cipher/coverage/index.json", { method: "POST" }),
      workspace,
      bundle,
    );
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(artifactResponseHeaders()).toMatchObject({
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    });
  });

  test("starts a closable local server for an explicit artifact workspace", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-local-server-"));
    const workspace = join(temporaryDirectory, "workspace");
    const bundle = join(temporaryDirectory, "bundle");
    const artifact = join(workspace, "cipher", "coverage", "index.json");
    mkdirSync(join(workspace, "cipher", "coverage"), { recursive: true });
    writeFileSync(artifact, '{"schemaVersion":2}\n');
    const server = serveLocalArtifacts(0, { bundleRoot: bundle, root: workspace });

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/projects/cipher/coverage/index.json`,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('"schemaVersion":2');
    } finally {
      server.stop(true);
    }
  });
});
