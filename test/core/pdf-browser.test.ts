import { expect, test } from "bun:test";
import { pdfBrowserLaunchOptions } from "../../scripts/core/pdf-browser.ts";

test("pdf browser launch options preserve the local Chrome sandbox", () => {
  expect(pdfBrowserLaunchOptions(false)).toEqual({ args: [], headless: true });
});

test("pdf browser launch options support isolated CI runners", () => {
  expect(pdfBrowserLaunchOptions(true)).toEqual({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
});
