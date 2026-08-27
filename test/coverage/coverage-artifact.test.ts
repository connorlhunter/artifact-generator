import { describe, expect, test } from "bun:test";
import {
  coverageArtifact,
  coverageTotals,
  parseLcov,
} from "../../scripts/coverage/render-coverage-report.ts";

const lcov = `SF:src/example.ts
LF:10
LH:10
FNF:2
FNH:2
BRF:0
BRH:0
end_of_record
`;

describe("coverage artifact", () => {
  test("publishes structured totals instead of a browser report", () => {
    const files = parseLcov(lcov);
    const artifact = coverageArtifact(files, "2026-08-27T12:00:00Z");

    expect(artifact.schemaVersion).toBe(2);
    expect(artifact.surfaces[0]?.files[0]?.path).toBe("src/example.ts");
    expect(coverageTotals(files).lines).toEqual({ covered: 10, found: 10 });
  });
});
