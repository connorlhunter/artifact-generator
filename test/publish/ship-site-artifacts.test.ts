import { describe, expect, test } from "bun:test";
import { shipSiteArtifacts } from "../../scripts/publish/ship-site-artifacts.ts";

describe("ship site artifacts", () => {
  test("builds before publishing and keeps local selection out of docs args", async () => {
    const calls: string[] = [];

    await shipSiteArtifacts(["local=/workspace/source", "--github=example/docs"], {
      build: async (args) => {
        calls.push(`build:${args.join(" ")}`);
      },
      publish: async () => {
        calls.push("publish");
      },
    });

    expect(calls).toEqual(["build:--github=example/docs", "publish"]);
  });
});
