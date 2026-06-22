import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existingPreviewPath } from "../resources/docs.constants.ts";

const renderDocsPreview = mock<(args: string[]) => string>();
const openDocsPreview = mock<(output: string) => Promise<void>>();

mock.module("../../scripts/docs/render-docs-preview.ts", () => ({
  renderDocsPreview,
}));

mock.module("../../scripts/docs/open-docs-preview.ts", () => ({
  openDocsPreview,
}));

const { renderOpenDocsPreview } = await import("../../scripts/docs/render-open-docs-preview.ts");

describe("render open docs preview", () => {
  beforeEach(() => {
    renderDocsPreview.mockReturnValue(existingPreviewPath);
    openDocsPreview.mockResolvedValue(undefined);
  });

  afterEach(() => {
    renderDocsPreview.mockReset();
    openDocsPreview.mockReset();
  });

  test("renders then opens the docs preview", async () => {
    await renderOpenDocsPreview([existingPreviewPath]);

    expect(renderDocsPreview).toHaveBeenCalledWith([existingPreviewPath]);
    expect(openDocsPreview).toHaveBeenCalledWith(existingPreviewPath);
  });
});
