import { basename } from "node:path";
import { marked, type Token, type Tokens } from "marked";
import type { DocumentBlock, DocumentInline } from "../content/document-model.ts";
import { localMarkdownTargetId, type MarkdownDoc } from "./docs-utils.ts";

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
    return value ? [{ type: "text", value: value.replace(/[ \t]*\r?\n[ \t]*/gu, " ") }] : [];
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
