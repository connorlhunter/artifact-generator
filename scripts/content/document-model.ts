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

/** Plain text for headings, measurements, and table cells. */
export function plainInline(items: ReadonlyArray<DocumentInline>): string {
  return items
    .map((item) => (item.type === "link" ? plainInline(item.children) : item.value))
    .join("");
}
