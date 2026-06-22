import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { docsPreviewOutput } from "../../scripts/docs/docs-utils.ts";
import { sourceInputDirs, sourceInputRoot } from "../../scripts/core/script-constants.ts";
import {
  parseDocsPreviewOptions,
  renderDocsPreview,
} from "../../scripts/docs/render-docs-preview.ts";
import {
  markdownPaths,
  missingPreviewPath,
  repoFixtureDocsRoot,
  repoFixtureEmptyRoot,
  repoFixtureRoot,
} from "../resources/docs.constants.ts";

describe("render docs preview", () => {
  const originalCwd = process.cwd();
  const repoFixturePath = resolve(originalCwd, repoFixtureRoot);

  beforeEach(() => {
    rmSync(sourceInputRoot, { force: true, recursive: true });
    process.chdir(repoFixturePath);
    copyFixtureFile(
      "icons/docs-fixture/mark.svg",
      `${sourceInputDirs.icons}/docs-fixture/mark.svg`,
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(resolve(repoFixturePath, "dist"), { force: true, recursive: true });
    rmSync(resolve(repoFixturePath, "tmp"), { force: true, recursive: true });
    rmSync(sourceInputRoot, { force: true, recursive: true });
    mock.restore();
  });

  test("renders selected markdown docs to a browser preview", async () => {
    const log = spyOn(console, "log").mockImplementation(() => undefined);

    const output = await renderDocsPreview([repoFixtureDocsRoot]);
    const html = readFileSync(output, "utf8");
    const copiedDiagram = resolve(
      repoFixturePath,
      "dist",
      "docs-preview",
      "diagrams",
      "diagram-style-key.svg",
    );
    const copiedDiagramPage = resolve(
      repoFixturePath,
      "dist",
      "docs-preview",
      "diagrams",
      "diagram-style-key.html",
    );
    const copiedIcon = resolve(
      repoFixturePath,
      "dist",
      "docs-preview",
      "icons",
      "docs-fixture",
      "mark.svg",
    );

    expect(output).toBe(docsPreviewOutput);
    expect(existsSync(output)).toBe(true);
    expect(existsSync(copiedDiagram)).toBe(true);
    expect(existsSync(copiedDiagramPage)).toBe(true);
    const diagramPageHtml = readFileSync(copiedDiagramPage, "utf8");
    expect(diagramPageHtml).toContain('href="diagram-style-key.svg"');
    expect(diagramPageHtml).toContain('href="../icons/docs-fixture/mark.svg"');
    expect(existsSync(copiedIcon)).toBe(true);
    expect(html).toContain(markdownPaths.fixtureDocsIndex);
    expect(html).toContain("<title>Docs Fixture Preview</title>");
    expect(html).toContain("<h1>Docs Fixture</h1>");
    expect(html).not.toContain("Architecture Docs");
    expect(html).toContain("data-doc-search-input");
    expect(html).toContain('class="page-outline"');
    expect(html).toContain("data-outline-links");
    expect(html).toContain("data-doc-link");
    expect(html).toContain("is-active");
    expect(html).toContain('class="project-icon title-project-icon"');
    expect(html).toContain("activeArticleId");
    expect(html).toContain('document.querySelector("[data-doc-nav]")');
    expect(html).toContain('document.querySelector("[data-doc-main]")');
    expect(html).toContain('document.querySelector("[data-page-outline]")');
    expect(html).toContain('data-nav-resize-handle aria-label="Resize navigation panel"');
    expect(html).toContain("wireMobileNavResize");
    expect(html).toContain("clampMobileNavHeight");
    expect(html).toContain("mobileNavCollapsedHeight");
    expect(html).toContain("is-nav-collapsed");
    expect(html).toContain("wireSchemeToggle");
    expect(html).toContain('data-scheme="atlas"');
    expect(html).toContain("connorhunter.theme.scheme");
    expect(html).toContain("docs.preview.scheme");
    expect(html).toContain("portfolio.theme.scheme");
    expect(html).toContain("cookieTheme");
    expect(html).toContain("applyProjectIcons");
    expect(html).toContain('data-scheme-toggle aria-label="Use Paper color scheme"');
    expect(html).toContain("scheme-toggle-dot");
    expect(html).not.toContain("scheme-toggle-name");
    expect(html).toContain("jumpMainToArticle");
    expect(html).toContain("jumpMainToTarget");
    expect(html).toContain("scrollNavToActiveLink");
    expect(html).toContain("scrollNavLinkIntoView");
    expect(html).toContain("previewScrollBehavior");
    expect(html).toContain("scrollContainerTo");
    expect(html).toContain("scrollTargetIntoContainer");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("state.navResizeHandle?.getBoundingClientRect().height");
    expect(html).toContain("wireDocNavigation");
    expect(html).toContain("wireOutlineNavigation");
    expect(html).toContain("window.history.pushState");
    expect(html).toContain("activateHashTarget");
    expect(html).toContain("state.docNav.scrollHeight <= state.docNav.clientHeight");
    expect(html).toContain("scrollOutlineToActiveLink");
    expect(html).toContain("state.pageOutline.scrollHeight <= state.pageOutline.clientHeight");
    expect(html).toContain("data-copy-source");
    expect(html).toContain('class="project-icon nav-project-icon"');
    expect(html).toContain('class="project-icon doc-project-icon"');
    expect(html).toContain('src="icons/docs-fixture/mark.svg"');
    expect(html).toContain('data-project-favicon data-icon-standard="icons/docs-fixture/mark.svg"');
    expect(html).toContain('href="icons/docs-fixture/mark.svg"');
    expect(html).not.toContain('src="icons/general-docs/mark.svg"');
    expect(html).toContain("navigator.clipboard.writeText");
    expect(html).toContain("new AbortController()");
    expect(html).toContain('Symbol.for("docs.preview.cleanup")');
    expect(html).not.toContain("__docsPreviewCleanup");
    expect(html).toContain('addEventListener("pagehide", cleanup');
    expect(html).toContain("window.cancelAnimationFrame");
    expect(html).toContain("window.clearTimeout");
    expect(html).toContain("pendingResizeFrame");
    expect(html).toContain("cancelPendingMobileNavResize");
    expect(html).toContain("requestMobileNavResize");
    expect(html).toContain("hasPointerCapture");
    expect(html).toContain("No matching docs");
    expect(html).toContain("Clear or change the search");
    expect(html).toContain('input[type="search"]::-webkit-search-cancel-button');
    expect(html).toContain("-webkit-appearance: none");
    expect(html).toContain("background: var(--muted)");
    expect(html).toContain("height: 100vh");
    expect(html).toContain("overflow-y: auto");
    expect(html).toContain("position: fixed");
    expect(html).toContain("padding-top: calc(2.5rem + 1rem)");
    expect(html).toContain("<summary><span>Open source</span></summary>");
    expect(html).toContain('content: "Close source";');
    expect(html).toContain("<h2>Index</h2>");
    expect(html).toContain('<p class="doc-eyebrow">Docs Fixture</p>');
    expect(html).toContain("<pre><code># Fixture Index");
    expect(html).not.toContain('href="source/');
    expect(html).not.toContain(pathToFileURL(resolve(markdownPaths.fixtureDocsIndex)).href);
    expect(html).toContain("#doc-docs-fixture-nested-guide-md");
    expect(html).toContain("<h3>Docs Fixture</h3>");
    expect(html).toContain(">Index</a>");
    expect(html).toContain(
      '<a target="_blank" rel="noopener" href="diagrams/diagram-style-key.html">Diagram Key</a>',
    );
    expect(html).toContain('<a href="#doc-docs-fixture-nested-guide-md">Nested Guide</a>');
    expect(html).not.toContain("file:///Users/");
    expect(sidebarDocIds(html)).toEqual(articleDocIds(html));
    expect(log).toHaveBeenCalled();
  });

  test("renders optional GitHub source buttons", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);

    await renderDocsPreview([
      repoFixtureDocsRoot,
      "--github=https://github.com/example/docs.git",
      "--github-branch",
      "preview",
    ]);
    const html = readFileSync(docsPreviewOutput, "utf8");

    expect(parseDocsPreviewOptions(["--github", "example/docs"]).github).toEqual({
      branch: "main",
      repo: "example/docs",
    });
    expect(parseDocsPreviewOptions(["--github", "example/docs", "--github-branch"]).github).toEqual(
      {
        branch: "main",
        repo: "example/docs",
      },
    );
    expect(html).toContain('class="github-link"');
    expect(html).toContain("right: 8.25rem");
    expect(html).toContain("background: var(--bg)");
    expect(html).toContain("border-color: var(--border)");
    expect(html).toContain("color: var(--muted)");
    expect(html).toContain("https://github.com/example/docs/blob/preview/docs-fixture/index.md");
    expect(parseDocsPreviewOptions(["--github=git@github.com:example/docs.git"]).github).toEqual({
      branch: "main",
      repo: "example/docs",
    });
    expect(parseDocsPreviewOptions(["--github-branch=docs-preview"]).github).toBeUndefined();
  });

  test("exits when no markdown docs are available", async () => {
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    process.chdir(resolve(repoFixturePath, repoFixtureEmptyRoot));
    await expect(renderDocsPreview(["."])).rejects.toThrow("exit");
    process.chdir(repoFixturePath);

    await expect(renderDocsPreview([resolve(originalCwd, missingPreviewPath)])).rejects.toThrow(
      "ENOENT",
    );
  });
});

/**
 * @param source - Existing fixture source path.
 * @param target - Staged fixture target path.
 */
function copyFixtureFile(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function sidebarDocIds(html: string): string[] {
  const nav =
    html.match(/<nav aria-label="Documentation" data-doc-nav>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  return [...nav.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]!);
}

function articleDocIds(html: string): string[] {
  return [...html.matchAll(/<article[\s\S]*?\bid="([^"]+)"/g)].map((match) => match[1]!);
}
