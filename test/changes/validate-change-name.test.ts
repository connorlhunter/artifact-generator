import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import {
  commitSubject,
  currentBranchName,
  isValidBranchName,
  isValidChangeSubject,
  runChangeNameValidationCli,
  runChangeNameValidation,
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

describe("change naming commands", () => {
  const originalHeadRef = process.env.GITHUB_HEAD_REF;
  const originalPrTitle = process.env.PR_TITLE;

  test("validates branch, commit, and pull request command inputs", () => {
    process.env.GITHUB_HEAD_REF = "feat/multi-page-coverage";
    process.env.PR_TITLE = "feat: add multi-page coverage";

    expect(() => runChangeNameValidation("branch")).not.toThrow();
    expect(() => runChangeNameValidation("commit", "fix: restore coverage gate")).not.toThrow();
    expect(() => runChangeNameValidation("pr-title")).not.toThrow();
  });

  test("resolves the checked-out branch when CI does not provide a head reference", () => {
    delete process.env.GITHUB_HEAD_REF;

    expect(currentBranchName()).toMatch(/\S/u);
  });

  test("uses the CI ref when Git has no checked-out branch", () => {
    delete process.env.GITHUB_HEAD_REF;
    process.env.GITHUB_REF_NAME = "feat/coverage-threshold";
    spyOn(Bun, "spawnSync").mockReturnValue({
      exitCode: 0,
      stderr: Buffer.from(""),
      stdout: Buffer.from(""),
    } as ReturnType<typeof Bun.spawnSync>);

    expect(currentBranchName()).toBe("feat/coverage-threshold");
  });

  test("rejects invalid commands and titles", () => {
    process.env.PR_TITLE = "Unprefixed title";

    expect(() => runChangeNameValidation("pr-title")).toThrow("Pull request subject");
    expect(() => runChangeNameValidation("unknown")).toThrow("Use branch, commit, or pr-title.");
  });

  test("runs the command-line validator with injected input and error reporting", async () => {
    expect(
      await runChangeNameValidationCli("commit", async () => "fix: validate coverage gates"),
    ).toBe(0);

    const errors: string[] = [];
    expect(
      await runChangeNameValidationCli("unknown", async () => "", errors.push.bind(errors)),
    ).toBe(1);
    expect(errors).toEqual(["Use branch, commit, or pr-title."]);
  });

  afterEach(() => {
    mock.restore();
    if (originalHeadRef === undefined) delete process.env.GITHUB_HEAD_REF;
    else process.env.GITHUB_HEAD_REF = originalHeadRef;
    if (originalPrTitle === undefined) delete process.env.PR_TITLE;
    else process.env.PR_TITLE = originalPrTitle;
  });
});
