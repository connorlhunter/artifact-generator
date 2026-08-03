import { describe, expect, test } from "bun:test";
import {
  artifactPaths,
  coverageServer,
  docsPreviewServer,
  executables,
  gitHooksPath,
  repoDirs,
  repoFiles,
  sharedDiagramInputs,
  sourceInputDirs,
} from "../../scripts/core/script-constants.ts";

describe("script constants", () => {
  test("defines shared repository paths", () => {
    expect(repoDirs).toMatchObject({
      coverage: "coverage",
      diagrams: "diagrams",
      dist: "dist",
      docs: "docs",
      icons: "icons",
      resume: "resume",
    });
    expect(repoFiles.packageJson).toBe("package.json");
    expect(artifactPaths.coverageDir).toBe("coverage");
    expect(artifactPaths.docsPreview).toBe("dist/docs-preview/index.html");
    expect(artifactPaths.docsPreviewPdf).toBe("dist/docs-preview/index.pdf");
    expect(artifactPaths.coverageReport).toBe("coverage/index.html");
    expect(artifactPaths.coverageReportPdf).toBe("coverage/index.pdf");
    expect(sourceInputDirs.resume).toBe(`${sourceInputDirs.artifacts}/resume`);
    expect(artifactPaths.resumeBuildDir).toBe("dist/.resume-build");
    expect(artifactPaths.resumePdf).toBe("dist/resume/connor-hunter-resume.pdf");
    expect(sharedDiagramInputs).toEqual([`${sourceInputDirs.diagrams}/diagram-style-key.mmd`]);
  });

  test("defines tool configuration constants", () => {
    expect(gitHooksPath).toBe(".githooks");
    expect(coverageServer).toMatchObject({
      arg: "--serve-coverage-report",
      host: "127.0.0.1",
      port: 41737,
    });
    expect(docsPreviewServer).toMatchObject({
      arg: "--serve-docs-preview",
      defaultHost: "127.0.0.1",
      defaultPort: 41738,
      hostEnv: "DOCS_PREVIEW_HOST",
      portEnv: "DOCS_PREVIEW_PORT",
    });
    expect(executables.bun).toBe(process.platform === "win32" ? "bun.cmd" : "bun");
    expect(executables.tectonic).toBe(process.platform === "win32" ? "tectonic.exe" : "tectonic");
  });
});
