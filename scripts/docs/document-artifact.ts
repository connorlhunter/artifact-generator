import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactPaths, sourceInputDirs } from "../core/script-constants.ts";
import { readText } from "../core/file-system.ts";
import { writePdf, type PdfSection } from "../pdf/write-pdf.ts";
import { plainInline, type DocumentBlock } from "../content/document-model.ts";
import { compileMarkdownBlocks } from "./markdown-document.ts";
import {
  artifactProjectSlug,
  docGroupTitle,
  docLinkLabel,
  findMarkdownDocs,
  markdownSourcePath,
  orderedDocGroups,
  orderedDocSections,
  orderedDocsForArtifact,
  type MarkdownDoc,
} from "./docs-utils.ts";
import { parseCentralizedDocSource, parseDocSource, readDocumentMetadata } from "./doc-metadata.ts";

/** One compiled documentation page used while writing Markdown and PDF outputs. */
interface DocumentPage {
  readonly body: string;
  readonly blocks: ReadonlyArray<DocumentBlock>;
  readonly id: string;
  readonly lastUpdated: string;
  readonly title: string;
  readonly version: string;
}

/** Navigation metadata for one docs collection. */
export interface DocumentIndex {
  readonly pages: ReadonlyArray<{
    readonly id: string;
    readonly lastUpdated: string;
    readonly path: string;
    readonly section: string;
    readonly sourcePath: string;
    readonly title: string;
    readonly version: string;
  }>;
  readonly schemaVersion: 2;
  readonly title: string;
}

async function documentPage(
  doc: MarkdownDoc,
  knownIds: Map<string, string>,
  metadataCache: Map<string, ReturnType<typeof readDocumentMetadata>>,
): Promise<DocumentPage> {
  const source = await readText(markdownSourcePath(doc));
  if (doc.metadataPath && !metadataCache.has(doc.metadataPath)) {
    metadataCache.set(doc.metadataPath, readDocumentMetadata(doc.metadataPath));
  }
  const centralizedMetadata = doc.metadataPath
    ? await metadataCache.get(doc.metadataPath)
    : undefined;
  const parsed = centralizedMetadata
    ? { body: parseCentralizedDocSource(source, doc.input), metadata: centralizedMetadata }
    : parseDocSource(source, doc.input);

  return {
    body: parsed.body,
    blocks: compileMarkdownBlocks(parsed.body, doc, knownIds),
    id: doc.id,
    lastUpdated: parsed.metadata.lastUpdated,
    title: docLinkLabel(doc),
    version: parsed.metadata.version,
  };
}

function pdfSection(page: DocumentPage): PdfSection {
  const first = page.blocks[0];
  const hasTitle = first?.type === "heading" && first.level === 1;
  return {
    blocks: hasTitle ? page.blocks.slice(1) : page.blocks,
    heading: hasTitle ? plainInline(first.content) : page.title,
    id: page.id,
    subtitle: `v${page.version} · Updated ${page.lastUpdated}`,
  };
}

/**
 * Builds a docs collection as readable Markdown pages, a small navigation index,
 * and one direct PDF.
 *
 * @param project - Project slug selected from the shared manifest.
 * @returns Written collection directory.
 */
export async function buildDocsArtifact(project = "artifact-generator"): Promise<string> {
  const projectSlug = artifactProjectSlug(project);
  const docs = orderedDocsForArtifact(findMarkdownDocs([join(sourceInputDirs.docs, projectSlug)]));

  if (docs.length === 0) throw new Error(`No Markdown docs found for ${projectSlug}.`);

  const output = join(artifactPaths.docsArtifactsDir, projectSlug);
  const pagesDirectory = join(output, "pages");
  const knownIds = new Map(docs.map((doc) => [doc.input, doc.id]));
  const metadataCache = new Map<string, ReturnType<typeof readDocumentMetadata>>();
  const pages = await Promise.all(docs.map((doc) => documentPage(doc, knownIds, metadataCache)));

  rmSync(output, { force: true, recursive: true });
  mkdirSync(pagesDirectory, { recursive: true });

  for (const page of pages) {
    writeFileSync(join(pagesDirectory, `${page.id}.md`), page.body);
  }

  const sectionsByPage = new Map<string, string>();
  for (const [, groupDocs] of orderedDocGroups(docs)) {
    for (const section of orderedDocSections(groupDocs)) {
      for (const doc of section.docs) sectionsByPage.set(doc.id, section.title);
    }
  }

  const index: DocumentIndex = {
    pages: pages.map((page) => ({
      id: page.id,
      lastUpdated: page.lastUpdated,
      path: `pages/${page.id}.md`,
      section: sectionsByPage.get(page.id) ?? docGroupTitle(projectSlug),
      sourcePath: docs.find((doc) => doc.id === page.id)?.input ?? `${page.id}.md`,
      title: page.title,
      version: page.version,
    })),
    schemaVersion: 2,
    title: docGroupTitle(projectSlug),
  };
  writeFileSync(join(output, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

  await writePdf({
    output: join(output, "docs.pdf"),
    sections: pages.map(pdfSection),
    subtitle: `${pages.length} documents · Updated ${pages
      .map((page) => page.lastUpdated)
      .sort()
      .at(-1)}`,
    title: index.title,
    contents: true,
    projectUrl: `https://connorhunter.me/projects/${projectSlug}`,
  });

  return output;
}

if (import.meta.main) {
  try {
    await buildDocsArtifact(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
