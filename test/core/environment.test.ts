import { describe, expect, test } from "bun:test";
import { envValue, requiredEnv } from "../../scripts/core/environment.ts";

describe("environment helpers", () => {
  test("normalizes optional values and requires non-empty settings", () => {
    expect(envValue(undefined)).toBe("");
    expect(envValue("  value  ")).toBe("value");
    expect(requiredEnv({ EXAMPLE_SETTING: " configured " }, "EXAMPLE_SETTING")).toBe("configured");
    expect(() => requiredEnv({ EXAMPLE_SETTING: "  " }, "EXAMPLE_SETTING")).toThrow(
      "Missing EXAMPLE_SETTING",
    );
  });
});
