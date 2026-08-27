import { describe, expect, test } from "bun:test";
import {
  artifactPaths,
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
    expect(artifactPaths.docsArtifactsDir).toBe("dist/docs-artifacts");
    expect(artifactPaths.coverageReport).toBe("coverage/index.json");
    expect(artifactPaths.coverageReportPdf).toBe("coverage/coverage.pdf");
    expect(sourceInputDirs.resume).toBe(`${sourceInputDirs.artifacts}/resume`);
    expect(artifactPaths.resumeBuildDir).toBe("dist/.resume-build");
    expect(artifactPaths.resumePdf).toBe("dist/resume/connor-hunter-resume.pdf");
    expect(sharedDiagramInputs).toEqual([`${sourceInputDirs.diagrams}/diagram-style-key.mmd`]);
  });

  test("defines tool configuration constants", () => {
    expect(gitHooksPath).toBe(".githooks");
    expect(executables.bun).toBe(process.platform === "win32" ? "bun.cmd" : "bun");
    expect(executables.tectonic).toBe(process.platform === "win32" ? "tectonic.exe" : "tectonic");
  });
});
