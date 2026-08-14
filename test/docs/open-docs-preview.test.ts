import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { docsPreviewOutput } from "../../scripts/docs/docs-utils.ts";
import { existingPreviewPath, missingPreviewPath } from "../resources/docs.constants.ts";

const openDefaultUrl = mock<(url: string) => Promise<string>>();

mock.module("../../scripts/core/file-opener.ts", () => ({
  openDefaultUrl,
}));

const { docsPreviewUrl, openDocsPreview, resolveDocsPreviewServerConfig } =
  await import("../../scripts/docs/open-docs-preview.ts");

describe("open docs preview", () => {
  beforeEach(() => {
    openDefaultUrl.mockImplementation(async (url) => url);
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
  });

  afterEach(() => {
    openDefaultUrl.mockReset();
    mock.restore();
  });

  test("opens an existing docs preview through the local server", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);

    await openDocsPreview(existingPreviewPath);

    expect(openDefaultUrl).toHaveBeenCalledWith(docsPreviewUrl(existingPreviewPath));
  });

  test("resolves docs preview server settings from environment variables", () => {
    const config = resolveDocsPreviewServerConfig({
      DOCS_PREVIEW_HOST: "::1",
      DOCS_PREVIEW_PORT: "41800",
      DOCS_PREVIEW_WAIT_STEP_MS: "25",
      DOCS_PREVIEW_WAIT_TIMEOUT_MS: "500",
    });

    expect(config).toMatchObject({
      host: "::1",
      port: 41800,
      waitStepMs: 25,
      waitTimeoutMs: 500,
    });
    expect(docsPreviewUrl(existingPreviewPath, config)).toBe(
      "http://[::1]:41800/existing-preview.html",
    );
    expect(() => resolveDocsPreviewServerConfig({ DOCS_PREVIEW_PORT: "90000" })).toThrow(
      "DOCS_PREVIEW_PORT must be between 1 and 65535.",
    );
  });

  test("rejects public hosts and unbounded preview waits", () => {
    expect(() => resolveDocsPreviewServerConfig({ DOCS_PREVIEW_HOST: "0.0.0.0" })).toThrow(
      "DOCS_PREVIEW_HOST must be a loopback host.",
    );
    expect(() => resolveDocsPreviewServerConfig({ DOCS_PREVIEW_WAIT_STEP_MS: "5001" })).toThrow(
      "DOCS_PREVIEW_WAIT_STEP_MS must be between 1 and 5000.",
    );
    expect(() => resolveDocsPreviewServerConfig({ DOCS_PREVIEW_WAIT_TIMEOUT_MS: "30001" })).toThrow(
      "DOCS_PREVIEW_WAIT_TIMEOUT_MS must be between 1 and 30000.",
    );
  });

  test("opens the default rendered docs preview through the local server", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    mkdirSync(dirname(docsPreviewOutput), { recursive: true });
    writeFileSync(docsPreviewOutput, "<!doctype html>");

    await openDocsPreview();

    expect(openDefaultUrl).toHaveBeenCalledWith(docsPreviewUrl(docsPreviewOutput));
  });

  test("exits when the docs preview has not been rendered", async () => {
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await expect(openDocsPreview(missingPreviewPath)).rejects.toThrow("exit");
  });
});
