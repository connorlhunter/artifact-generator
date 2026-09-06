import { expect, test } from "bun:test";
import {
  allSettledWithFirstPriority,
  allSettledWithPriorityPrefix,
} from "../../scripts/core/async-tasks.ts";

test("rejects invalid priority counts before starting work", async () => {
  for (const priority of [NaN, Infinity, -Infinity]) {
    let started = false;
    await expect(
      allSettledWithPriorityPrefix([1], priority, async () => {
        started = true;
      }),
    ).rejects.toThrow("Priority count must be finite");
    expect(started).toBe(false);
  }
});

test("limits concurrent work while retaining input order and all failures", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let active = 0;
  let maximum = 0;
  const started: number[] = [];
  const work = allSettledWithFirstPriority([0, 1, 2, 3, 4, 5, 6], async (item) => {
    started.push(item);
    if (item === 0) return item;
    active += 1;
    maximum = Math.max(maximum, active);
    await gate;
    active -= 1;
    if (item === 3) throw new Error("Failed job");
    return item;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(started).toEqual([0, 1, 2, 3, 4]);
  release();
  const results = await work;
  expect(maximum).toBe(4);
  expect(results).toHaveLength(7);
  expect(results[3]).toMatchObject({ status: "rejected" });
  expect(results[6]).toEqual({ status: "fulfilled", value: 6 });
});
