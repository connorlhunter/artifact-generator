/** Collects task failures without discarding completed work. */
export function failedResults<T>(results: PromiseSettledResult<T>[]): PromiseRejectedResult[] {
  return results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
}

async function settled<T, R>(
  item: T,
  run: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>> {
  try {
    return { status: "fulfilled", value: await run(item) };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}

/** Completes the priority prefix first, then runs at most four remaining tasks at once. */
export async function allSettledWithPriorityPrefix<T, R>(
  items: T[],
  priorityCount: number,
  runItem: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isFinite(priorityCount)) throw new Error("Priority count must be finite.");
  const prefix = Math.max(0, Math.min(Math.trunc(priorityCount), items.length));
  const results: PromiseSettledResult<R>[] = [];
  for (let index = 0; index < prefix; index += 1)
    results.push(await settled(items[index]!, runItem));
  let next = prefix;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await settled(items[index]!, runItem);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length - prefix) }, worker));
  return results;
}

export function allSettledWithFirstPriority<T, R>(
  items: T[],
  runItem: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  return allSettledWithPriorityPrefix(items, 1, runItem);
}
