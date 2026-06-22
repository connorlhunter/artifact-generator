import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  logCommandHint,
  logCaughtError,
  logError,
  logErrorHeading,
  logFailureDetails,
  logGroup,
  logHeading,
  logItem,
  logStep,
  logSuccess,
} from "../../scripts/core/script-logger.ts";

describe("script logger", () => {
  afterEach(() => {
    mock.restore();
  });

  test("logs headings, groups, items, steps, and successes", () => {
    const log = spyOn(console, "log").mockImplementation(() => undefined);

    logHeading("Rendering", { count: 2 });
    logGroup("example", 1);
    logItem("docs/example.md", 2);
    logStep(1, 2, "Validating");
    logSuccess("Rendered", 2);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Rendering"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[example]"));
    expect(log).toHaveBeenCalledWith("    - docs/example.md");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[1/2] Validating"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Rendered (2)"));
  });

  test("logs errors, command hints, and failure details", () => {
    const error = spyOn(console, "error").mockImplementation(() => undefined);

    logError("Missing file");
    logErrorHeading("Opening failed", 1);
    logCommandHint("bun run docs:render -- artifact-generator");
    logFailureDetails(
      {
        error: new Error("spawn failed"),
        stderr: "stderr text",
        stdout: "stdout text",
        subject: "diagram.svg",
      },
      "unknown file",
    );

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Missing file"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Opening failed (1)"));
    expect(error).toHaveBeenCalledWith("Run `bun run docs:render -- artifact-generator` first.");
    expect(error).toHaveBeenCalledWith("- diagram.svg");
    expect(error).toHaveBeenCalledWith("  spawn failed");
    expect(error).toHaveBeenCalledWith("  stdout text");
    expect(error).toHaveBeenCalledWith("  stderr text");

    logCaughtError(new Error("error failure"));
    logCaughtError("plain failure");
    expect(error).toHaveBeenCalledWith("error failure");
    expect(error).toHaveBeenCalledWith("plain failure");
  });
});
