import { describe, expect, test } from "bun:test";
import { formatDocLabel, formatDocSectionTitle } from "../../scripts/docs/docs-labels.ts";

describe("docs labels", () => {
  test("formats normal slugs and documented technology labels", () => {
    expect(formatDocLabel("services-media")).toBe("Services Media");
    expect(formatDocLabel("api")).toBe("API");
    expect(formatDocLabel("dynamodb")).toBe("DynamoDB");
    expect(formatDocLabel("typescript")).toBe("TypeScript");
    expect(formatDocLabel("")).toBe("");
  });

  test("formats nested section titles", () => {
    expect(formatDocSectionTitle(["cipher", "ui", "zustand"])).toBe("Cipher UI Zustand");
  });
});
