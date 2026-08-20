import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createIsolatedSourceInputs } from "../resources/isolated-source-inputs.ts";
import {
  markdownPaths,
  missingPreviewPath,
  repoFixtureDocsRoot,
  repoFixtureEmptyRoot,
  repoFixtureRoot,
} from "../resources/docs.constants.ts";

const originalCwd = process.cwd();
const isolatedSourceInputs = createIsolatedSourceInputs();
process.chdir(isolatedSourceInputs.workspace);
const { sourceInputDirs, sourceInputRoot } = await import("../../scripts/core/script-constants.ts");
const { docsPreviewOutput } = await import("../../scripts/docs/docs-utils.ts");
const { parseDocsPreviewOptions, renderDocsPreview } =
  await import("../../scripts/docs/render-docs-preview.ts");
process.chdir(originalCwd);

if (sourceInputRoot !== isolatedSourceInputs.sourceInputRoot) {
  throw new Error(`Source input test root was not isolated: ${sourceInputRoot}`);
}

describe("render docs preview", () => {
  const repoFixturePath = resolve(originalCwd, repoFixtureRoot);

  beforeEach(() => {
    isolatedSourceInputs.reset(sourceInputRoot);
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
    isolatedSourceInputs.reset(sourceInputRoot);
    mock.restore();
  });

  afterAll(() => isolatedSourceInputs.dispose());

  test("renders selected markdown docs to a browser preview", async () => {
    const log = spyOn(console, "log").mockImplementation(() => undefined);

    const output = await renderDocsPreview([repoFixtureDocsRoot]);
    const html = readFileSync(output, "utf8");
    const copiedDiagram = resolve(
      repoFixturePath,
      "dist",
      "docs-preview",
      "diagrams",
      "diagram-style-key-v1.0.0-2026-08-18.svg",
    );
    const copiedDiagramPage = resolve(
      repoFixturePath,
      "dist",
      "docs-preview",
      "diagrams",
      "diagram-style-key-v1.0.0-2026-08-18.html",
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
    expect(diagramPageHtml).toContain('href="diagram-style-key-v1.0.0-2026-08-18.svg"');
    expect(diagramPageHtml).toContain('href="../icons/docs-fixture/mark.svg"');
    expect(existsSync(copiedIcon)).toBe(true);
    expect(html).toContain(markdownPaths.fixtureDocsIndex);
    expect(html).toContain("<title>Docs Fixture Preview</title>");
    expect(html).toContain("<h1>Docs Fixture</h1>");
    expect(html).not.toContain("Architecture Docs");
    expect(html).toContain("data-doc-search-input");
    expect(html).toContain("Search documentation");
    expect(html).toContain("data-nav-count");
    expect(html).toContain("Updated");
    expect(html).toContain('Updated <time datetime="2026-08-19">August 19, 2026</time>');
    const indexArticle =
      /<article\s+id="doc-docs-fixture-index-md"[\s\S]*?<\/article>/u.exec(html)?.[0] ?? "";
    const guideArticle =
      /<article\s+id="doc-docs-fixture-nested-guide-md"[\s\S]*?<\/article>/u.exec(html)?.[0] ?? "";
    expect(indexArticle).toContain('class="doc-version">v1.0.0</span>');
    expect(indexArticle).toContain('<time datetime="2026-08-18">August 18, 2026</time>');
    expect(guideArticle).toContain('class="doc-version">v1.2.0</span>');
    expect(guideArticle).toContain('<time datetime="2026-08-19">August 19, 2026</time>');
    expect(html).toContain('class="nav-panel"');
    expect(html).toContain('class="page-outline"');
    expect(html).toContain("data-outline-links");
    expect(html).toContain("data-doc-link");
    expect(html).toContain("data-doc-link-label");
    expect(html).toContain("data-doc-search-context");
    expect(html).toContain("data-nav-section");
    expect(html).toContain("data-nav-heading-links");
    expect(html).toContain('role="group" aria-label="Sections in current document"');
    expect(html).toContain("is-active");
    expect(html).toContain('class="project-icon title-project-icon"');
    expect(html).toContain("activeArticleId");
    expect(html).toContain('document.querySelector("[data-doc-nav]")');
    expect(html).toContain('document.querySelector("[data-doc-main]")');
    expect(html).toContain('document.querySelector("[data-page-outline]")');
    expect(html).toContain('document.querySelector("[data-outline-resize-handle]")');
    expect(html).toContain(
      'data-nav-resize-handle aria-label="Resize navigation panel" aria-expanded="true"',
    );
    expect(html).toContain('data-outline-resize-handle aria-label="Collapse on this page panel"');
    expect(html).toContain("data-doc-layout");
    expect(html).toContain("data-nav-controls-content");
    expect(html).toContain("data-nav-controls-handle");
    expect(html).toContain("Hide navigation controls");
    expect(html).toContain('title="Hide navigation controls"');
    expect(html).toContain("wireNavControlsResize");
    expect(html).toContain("mobileNavSnapHeights");
    expect(html).toContain("nextMobileNavSnapHeight");
    expect(html).toContain("wireDesktopNavResize");
    expect(html).toContain("wireDesktopOutlineResize");
    expect(html).toContain("docs.preview.navigation.collapsed");
    expect(html).toContain("docs.preview.outline.collapsed");
    expect(html).toContain("wireMobileNavResize");
    expect(html).toContain("clampMobileNavHeight");
    expect(html).toContain("mobileNavCollapsedHeight");
    expect(html).toContain("is-nav-collapsed");
    expect(html).toContain("is-desktop-outline-collapsed");
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
    expect(html).toContain("mainReadingTop");
    expect(html).toContain("mainScrollAnchor");
    expect(html).toContain("isMainAtScrollEnd");
    expect(html).toContain("syncActiveNavigation");
    expect(html).toContain("buildNavHeadingLinks");
    expect(html).toContain("syncHeadingLinkState");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("magneticPosition");
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
    expect(html).toContain("padding-top: 1.75rem");
    expect(html).toContain("<summary><span>Open source</span></summary>");
    expect(html).toContain('content: "Close source";');
    expect(html).toContain("<h2>Index</h2>");
    expect(html).toContain('<p class="doc-eyebrow">Docs Fixture</p>');
    expect(html).toContain(
      "<pre><code>&lt;!-- artifact-generator:version=1.0.0 lastUpdated=2026-08-18 --&gt;",
    );
    expect(html).not.toContain('href="source/');
    expect(html).not.toContain(pathToFileURL(resolve(markdownPaths.fixtureDocsIndex)).href);
    expect(html).toContain("#doc-docs-fixture-nested-guide-md");
    expect(html).toContain("<h3>Docs Fixture</h3>");
    expect(html).toContain(">Index</span>");
    expect(html).toContain(
      '<a target="_blank" rel="noopener" href="diagrams/diagram-style-key-v1.0.0-2026-08-18.html">Diagram Key</a>',
    );
    expect(html).toContain(
      '<a target="_blank" rel="noopener" href="https://example.com/project">Fixture Project</a>',
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
    expect(parseDocsPreviewOptions(["local=/workspace/source"]).roots).toEqual([]);
  });

  test("renders source-cache docs with logical artifact paths", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    copyFixtureFile(
      markdownPaths.fixtureProjectOverview,
      `${sourceInputDirs.docs}/artifact-generator/artifact-generator-overview.md`,
    );

    await renderDocsPreview(["artifact-generator"]);
    const html = readFileSync(docsPreviewOutput, "utf8");

    expect(html).toContain("docs/artifact-generator/artifact-generator-overview.md");
    expect(html).toContain('id="doc-docs-artifact-generator-artifact-generator-overview-md"');
    expect(html).not.toContain(sourceInputRoot);
    expect(html).not.toContain("artifact-generator-source-cache");
    expect(html).not.toContain("var/folders");
  });

  test("renders Markdown without executable HTML or unsafe destinations", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    const source = `${sourceInputDirs.docs}/cipher/security.md`;
    mkdirSync(dirname(source), { recursive: true });
    writeFileSync(
      source,
      [
        "<!-- artifact-generator:version=1.0.0 lastUpdated=2026-08-18 -->",
        "# Security",
        "",
        '<img src="x" onerror="alert(1)">',
        "",
        "[Unsafe](javascript:alert(1))",
        "",
        "![Unsafe image](javascript:alert(1))",
        "",
        "[Encoded unsafe](javascript&colon;alert(1))",
        "",
        "[Safe](https://example.com)",
      ].join("\n"),
    );

    await renderDocsPreview(["cipher"]);
    const html = readFileSync(docsPreviewOutput, "utf8");
    const renderedBody = html.match(/<div class="doc-body">([\s\S]*?)<\/div>/u)?.[1] ?? "";

    expect(renderedBody).not.toContain("<img");
    expect(renderedBody).not.toContain("javascript:");
    expect(renderedBody).not.toContain("javascript&colon;");
    expect(renderedBody).toContain("&lt;img");
    expect(renderedBody).toContain("Unsafe");
    expect(renderedBody).toContain(
      '<a target="_blank" rel="noopener" href="https://example.com">Safe</a>',
    );
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
