import { describe, expect, test } from "bun:test";
import {
  formatUpdatedDate,
  isoUpdatedDate,
  parseVersionedArtifactMetadata,
  validateArtifactVersion,
  validateUpdatedDate,
} from "../../scripts/core/versioned-artifact-metadata.ts";

describe("versioned artifact metadata", () => {
  test("parses a strict version and real ISO calendar date", () => {
    expect(
      parseVersionedArtifactMetadata(
        "version=12.3.40 lastUpdated=2026-08-18",
        "Diagram overview.mmd",
      ),
    ).toEqual({ lastUpdated: "2026-08-18", version: "12.3.40" });
    expect(formatUpdatedDate("2026-08-18")).toBe("August 18, 2026");
  });

  test("rejects loose or prerelease versions", () => {
    for (const version of ["1", "1.2", "01.2.3", "1.2.3-beta.1", "v1.2.3"]) {
      expect(() => validateArtifactVersion(version)).toThrow("major.minor.patch");
    }
  });

  test("rejects malformed and impossible dates", () => {
    expect(() => validateUpdatedDate("August 18, 2026")).toThrow("YYYY-MM-DD");
    expect(() => validateUpdatedDate("2026-02-30")).toThrow("real calendar date");
  });

  test("requires the canonical metadata field order and names", () => {
    expect(() => parseVersionedArtifactMetadata("lastUpdated=2026-08-18 version=1.0.0")).toThrow(
      "version=<major.minor.patch> lastUpdated=<YYYY-MM-DD>",
    );
  });

  test("uses the UTC calendar date for publication timestamps", () => {
    expect(isoUpdatedDate(new Date("2026-08-19T00:15:00.000Z"))).toBe("2026-08-19");
  });
});
