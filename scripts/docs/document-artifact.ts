import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { marked, type Token, type Tokens } from "marked";
import { artifactPaths, sourceInputDirs } from "../core/script-constants.ts";
import { readText } from "../core/bun-native-fs.ts";
import { writePdf } from "../pdf/write-pdf.ts";
import {
  artifactProjectSlug,
  docGroupTitle,
  docLinkLabel,
  findMarkdownDocs,
  localMarkdownTargetId,
  markdownSourcePath,
  orderedDocGroups,
  orderedDocSections,
  orderedDocsForArtifact,
  type MarkdownDoc,
} from "./docs-utils.ts";
import { parseCentralizedDocSource, parseDocSource, readDocumentMetadata } from "./doc-metadata.ts";

/** A safe inline value rendered by Portfolio components. */
export type DocumentInline =
  | { readonly type: "code" | "emphasis" | "strong" | "text"; readonly value: string }
  | {
      readonly children: ReadonlyArray<DocumentInline>;
      readonly href?: string;
      readonly target?: { readonly id: string; readonly kind: "diagram" | "document" };
      readonly type: "link";
    };

/** A safe Markdown block rendered by Portfolio components. */
export type DocumentBlock =
  | {
      readonly content: ReadonlyArray<DocumentInline>;
      readonly id?: string;
      readonly level?: number;
      readonly type: "heading" | "paragraph";
    }
  | { readonly language?: string; readonly type: "code"; readonly value: string }
  | {
      readonly items: ReadonlyArray<ReadonlyArray<DocumentBlock>>;
      readonly ordered: boolean;
      readonly type: "list";
    }
  | { readonly content: ReadonlyArray<DocumentBlock>; readonly type: "quote" }
  | {
      readonly rows: ReadonlyArray<ReadonlyArray<ReadonlyArray<DocumentInline>>>;
      readonly type: "table";
    }
  | { readonly type: "rule" };

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

function plainText(tokens: ReadonlyArray<Token> | undefined): string {
  return (tokens ?? [])
    .map((token) => {
      if ("text" in token && typeof token.text === "string") return token.text;
      if ("raw" in token && typeof token.raw === "string") return token.raw;
      return "";
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}

function diagramId(source: MarkdownDoc, href: string): string | undefined {
  const [target] = href.split("#");

  if (!target?.endsWith(".mmd") || /^[a-z]+:/iu.test(target)) return undefined;

  const name = basename(target, ".mmd");
  const prefix = `${source.project}-`;
  const compact = name.startsWith(prefix) ? name.slice(prefix.length) : name;

  return compact.replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, "");
}

function inlineTokens(
  tokens: ReadonlyArray<Token> | undefined,
  source: MarkdownDoc,
  knownIds: Map<string, string>,
): DocumentInline[] {
  return (tokens ?? []).flatMap((token): DocumentInline[] => {
    if (token.type === "strong" || token.type === "em") {
      return [
        { type: token.type === "strong" ? "strong" : "emphasis", value: plainText(token.tokens) },
      ];
    }

    if (token.type === "codespan") return [{ type: "code", value: token.text }];
    if (token.type === "br") return [{ type: "text", value: "\n" }];

    if (token.type === "link") {
      const targetId = localMarkdownTargetId(source, token.href, knownIds);
      const linkedDiagram = diagramId(source, token.href);
      const children = inlineTokens(token.tokens, source, knownIds);

      if (targetId) {
        return [{ children, target: { id: targetId, kind: "document" }, type: "link" }];
      }

      if (linkedDiagram) {
        return [{ children, target: { id: linkedDiagram, kind: "diagram" }, type: "link" }];
      }

      return [{ children, href: token.href, type: "link" }];
    }

    if (token.type === "image") return [{ type: "text", value: token.text }];

    const value = "text" in token && typeof token.text === "string" ? token.text : token.raw;
    return value ? [{ type: "text", value }] : [];
  });
}

function headingId(value: string, index: number): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized ? `${normalized}-${index + 1}` : `section-${index + 1}`;
}

export function compileMarkdownBlocks(
  markdown: string,
  source: MarkdownDoc,
  knownIds: Map<string, string> = new Map(),
): DocumentBlock[] {
  return blockTokens(marked.lexer(markdown, { gfm: true }), source, knownIds);
}

function blockTokens(
  tokens: ReadonlyArray<Token>,
  source: MarkdownDoc,
  knownIds: Map<string, string>,
): DocumentBlock[] {
  let headingIndex = 0;

  return tokens.flatMap((token): DocumentBlock[] => {
    if (token.type === "space") return [];
    if (token.type === "hr") return [{ type: "rule" }];

    if (token.type === "heading") {
      const content = inlineTokens(token.tokens, source, knownIds);
      const value = plainText(token.tokens) || token.text;
      return [
        { content, id: headingId(value, headingIndex++), level: token.depth, type: "heading" },
      ];
    }

    if (token.type === "paragraph" || token.type === "text") {
      return [{ content: inlineTokens(token.tokens, source, knownIds), type: "paragraph" }];
    }

    if (token.type === "code") {
      return [{ ...(token.lang ? { language: token.lang } : {}), type: "code", value: token.text }];
    }

    if (token.type === "blockquote") {
      return [{ content: blockTokens(token.tokens ?? [], source, knownIds), type: "quote" }];
    }

    if (token.type === "list") {
      return [
        {
          items: (token.items ?? []).map((item: Tokens.ListItem) =>
            blockTokens(item.tokens, source, knownIds),
          ),
          ordered: token.ordered,
          type: "list",
        },
      ];
    }

    if (token.type === "table") {
      return [
        {
          rows: [token.header, ...token.rows].map((row) =>
            row.map((cell: Tokens.TableCell) => inlineTokens(cell.tokens, source, knownIds)),
          ),
          type: "table",
        },
      ];
    }

    return [];
  });
}

function pageText(blocks: ReadonlyArray<DocumentBlock>): string[] {
  return blocks.flatMap((block) => {
    if (block.type === "heading" || block.type === "paragraph") {
      return [
        block.content
          .map((item) => (item.type === "link" ? plainInline(item.children) : item.value))
          .join(""),
      ];
    }
    if (block.type === "code") return [block.value];
    if (block.type === "list") return block.items.flatMap((item) => pageText(item));
    if (block.type === "quote") return pageText(block.content);
    if (block.type === "table") {
      return block.rows.map((row) => row.map((cell) => plainInline(cell)).join(" | "));
    }
    return [];
  });
}

function plainInline(items: ReadonlyArray<DocumentInline>): string {
  return items
    .map((item) => (item.type === "link" ? plainInline(item.children) : item.value))
    .join("");
}

async function documentPage(
  doc: MarkdownDoc,
  knownIds: Map<string, string>,
): Promise<DocumentPage> {
  const source = await readText(markdownSourcePath(doc));
  const centralizedMetadata = doc.metadataPath
    ? await readDocumentMetadata(doc.metadataPath)
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
  const pages = await Promise.all(docs.map((doc) => documentPage(doc, knownIds)));

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
    sections: pages.map((page) => ({ body: pageText(page.blocks), heading: page.title })),
    subtitle: "Markdown documentation export",
    title: index.title,
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
