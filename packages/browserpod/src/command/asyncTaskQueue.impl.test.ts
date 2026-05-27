import { describe, expect, it } from "vitest";
import { AsyncTaskQueue } from "./asyncTaskQueue.impl";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("AsyncTaskQueue", () => {
  it("starts tasks in FIFO order while respecting concurrency", async () => {
    const queue = new AsyncTaskQueue({ concurrency: 1 });
    const first = deferred<string>();
    const second = deferred<string>();
    const starts: string[] = [];

    const firstResult = queue.enqueue(async () => {
      starts.push("first");
      return first.promise;
    });
    const secondResult = queue.enqueue(async () => {
      starts.push("second");
      return second.promise;
    });

    expect(starts).toEqual(["first"]);
    first.resolve("first-result");
    await expect(firstResult).resolves.toBe("first-result");
    expect(starts).toEqual(["first", "second"]);
    second.resolve("second-result");
    await expect(secondResult).resolves.toBe("second-result");
  });

  it("continues running queued tasks after a task rejects", async () => {
    const queue = new AsyncTaskQueue({ concurrency: 1 });
    const starts: string[] = [];

    const failed = queue.enqueue(() => {
      starts.push("failed");
      throw new Error("boom");
    });
    const next = queue.enqueue(() => {
      starts.push("next");
      return "ok";
    });

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
    expect(starts).toEqual(["failed", "next"]);
  });

  it("rejects invalid concurrency", () => {
    expect(() => new AsyncTaskQueue({ concurrency: 0 })).toThrow("positive integer");
  });
});
