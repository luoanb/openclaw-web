import type { WebContainer } from "@webcontainer/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IFileManagerIdbStore } from "./fileManager.interfaces";
import { FileManagerSync } from "./fileManagerSync.impl";

describe("FileManagerSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces fs.watch and pushTreeRecord with exported json tree", async () => {
    const pushTreeRecord = vi.fn().mockResolvedValue("rid");
    const store = { pushTreeRecord } as unknown as IFileManagerIdbStore;
    const tree = { "app.txt": { file: { contents: "ok" } } };
    const exportFn = vi.fn().mockResolvedValue(tree);
    let watchCb: () => void = () => {};
    const close = vi.fn();

    const wc = {
      fs: {
        watch: vi.fn((_path: string, _opts: unknown, cb: () => void) => {
          watchCb = cb;
          return { close };
        }),
      },
      export: exportFn,
    } as unknown as WebContainer;

    const sync = new FileManagerSync(store);
    sync.start(wc, "drive-1");

    watchCb();
    await vi.advanceTimersByTimeAsync(400);

    expect(exportFn).toHaveBeenCalledWith(".", { format: "json" });
    expect(pushTreeRecord).toHaveBeenCalledTimes(1);
    expect(pushTreeRecord).toHaveBeenCalledWith("drive-1", tree);

    sync.stop();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("stop clears pending debounce without exporting", async () => {
    const pushTreeRecord = vi.fn().mockResolvedValue("rid");
    const store = { pushTreeRecord } as unknown as IFileManagerIdbStore;
    const exportFn = vi.fn().mockResolvedValue({});
    let watchCb: () => void = () => {};
    const wc = {
      fs: {
        watch: vi.fn((_p: string, _o: unknown, cb: () => void) => {
          watchCb = cb;
          return { close: vi.fn() };
        }),
      },
      export: exportFn,
    } as unknown as WebContainer;

    const sync = new FileManagerSync(store);
    sync.start(wc, "d");
    watchCb();
    sync.stop();
    await vi.advanceTimersByTimeAsync(400);

    expect(exportFn).not.toHaveBeenCalled();
    expect(pushTreeRecord).not.toHaveBeenCalled();
  });
});
