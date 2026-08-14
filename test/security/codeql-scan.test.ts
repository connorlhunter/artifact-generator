import { describe, expect, test } from "bun:test";
import {
  assertCodeqlVersion,
  compareWithBaseline,
  parseBaseline,
  parseCodeqlVersion,
  parseSarif,
  type CodeqlBaseline,
  type CodeqlFinding,
} from "../../scripts/security/codeql-scan.ts";

const finding: CodeqlFinding = {
  fingerprint: "primaryLocationLineHash/v1:abc123",
  language: "javascript-typescript",
  message: "A path depends on user input.",
  path: "scripts/example.ts",
  ruleId: "js/path-injection",
  startLine: 12,
};

const baseline: CodeqlBaseline = {
  findings: [
    {
      fingerprint: finding.fingerprint,
      language: finding.language,
      path: finding.path,
      ruleId: finding.ruleId,
    },
  ],
  issue: "https://github.com/example/repository/issues/1",
  version: 1,
};

describe("CodeQL version policy", () => {
  test("parses and enforces the exact CLI version", () => {
    expect(parseCodeqlVersion('{"version":"2.26.3"}')).toBe("2.26.3");
    expect(() => assertCodeqlVersion("2.26.3", "2.26.3")).not.toThrow();
    expect(() => assertCodeqlVersion("2.26.2", "2.26.3")).toThrow(
      "CodeQL 2.26.3 is required; found 2.26.2.",
    );
  });
});

describe("CodeQL SARIF", () => {
  test("normalizes a result with its stable fingerprint", () => {
    const sarif = JSON.stringify({
      runs: [
        {
          results: [
            {
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: "scripts/example.ts" },
                    region: { startLine: 12 },
                  },
                },
              ],
              message: { text: finding.message },
              partialFingerprints: {
                "primaryLocationLineHash/v1": "abc123",
              },
              ruleId: finding.ruleId,
            },
          ],
        },
      ],
    });

    expect(parseSarif(sarif, finding.language)).toEqual([finding]);
  });

  test("rejects incomplete results and missing fingerprints", () => {
    expect(() => parseSarif('{"runs":[{"results":[{}]}]}', "actions")).toThrow(
      "CodeQL SARIF contains an incomplete result.",
    );
    expect(() =>
      parseSarif(
        '{"runs":[{"results":[{"ruleId":"actions/test","message":{"text":"test"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":".github/workflows/ci.yml"},"region":{"startLine":1}}}]}]}]}',
        "actions",
      ),
    ).toThrow("CodeQL SARIF result is missing a stable fingerprint.");
  });
});

describe("CodeQL baseline", () => {
  test("accepts exact findings and reports new or stale entries", () => {
    expect(compareWithBaseline([finding], baseline)).toEqual({
      newFindings: [],
      staleFindings: [],
    });

    expect(compareWithBaseline([{ ...finding, path: "scripts/new.ts" }], baseline)).toEqual({
      newFindings: [{ ...finding, path: "scripts/new.ts" }],
      staleFindings: baseline.findings,
    });
  });

  test("validates metadata and rejects duplicate exceptions", () => {
    expect(parseBaseline(JSON.stringify(baseline))).toEqual(baseline);
    expect(() => parseBaseline('{"version":2,"issue":"","findings":[]}')).toThrow(
      "CodeQL baseline metadata is invalid.",
    );
    expect(() =>
      compareWithBaseline([], {
        ...baseline,
        findings: [...baseline.findings, ...baseline.findings],
      }),
    ).toThrow("CodeQL baseline contains duplicate findings.");
  });
});
