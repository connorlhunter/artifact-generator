import { describe, expect, test } from "bun:test";

import {
  commitSubject,
  isValidBranchName,
  isValidChangeSubject,
  validateBranchName,
  validateChangeSubject,
} from "../../scripts/changes/validate-change-name.ts";

describe("branch naming", () => {
  test.each([
    "main",
    "feat/semantic-change-naming",
    "fix/pdf-shortcut",
    "release/1.5.4",
    "release/0.1.0-prealpha.1",
    "dependabot/bun/dependencies-123",
  ])("accepts %s", (branch) => {
    expect(isValidBranchName(branch)).toBe(true);
    expect(() => validateBranchName(branch)).not.toThrow();
  });

  test.each([
    "feature/semantic-change-naming",
    "feat/Semantic-Change",
    "feat/semantic_change",
    "release/v1.5.4",
    "release/1.5",
    "dependabot/",
  ])("rejects %s", (branch) => {
    expect(isValidBranchName(branch)).toBe(false);
  });

  test("reports the branch convention", () => {
    expect(() => validateBranchName("feature/new-rule")).toThrow(
      "use <type>/<kebab-summary> or release/<version>",
    );
  });
});

describe("change subject naming", () => {
  test.each([
    "feat: add naming checks",
    "fix(parser): reject empty names",
    "feat(api)!: remove old endpoint",
    "chore(release): prepare 1.5.4",
  ])("accepts %s", (subject) => {
    expect(isValidChangeSubject(subject)).toBe(true);
    expect(() => validateChangeSubject(subject)).not.toThrow();
  });

  test.each([
    "Add naming checks",
    "feature: add naming checks",
    "feat add naming checks",
    "feat: ",
    "feat: add naming checks\nsecond subject",
  ])("rejects %s", (subject) => {
    expect(isValidChangeSubject(subject)).toBe(false);
  });

  test("reports the subject convention", () => {
    expect(() => validateChangeSubject("Update names", "Pull request")).toThrow(
      "Pull request subject must use <type>[(scope)][!]: <summary>.",
    );
  });

  test("reads the first non-comment commit subject", () => {
    expect(commitSubject("\n# template\nfix: keep the first subject\n\nDetails\n")).toBe(
      "fix: keep the first subject",
    );
  });
});
