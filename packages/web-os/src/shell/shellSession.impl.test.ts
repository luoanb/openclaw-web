import { describe, expect, it, vi } from "vitest";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { ShellSession } from "./shellSession.impl";
import { DEFAULT_SHELL_COMMAND, DEFAULT_TERMINAL_DIMENSIONS } from "./shellSpawnOptions";

function captureWritable(): { stream: WritableStream<string>; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new WritableStream<string>({
    write(chunk) {
      chunks.push(chunk);
    },
  });
  return { stream, chunks };
}

function createMockProcess(): WebContainerProcess & {
  readonly written: string[];
  enqueueOutput(chunk: string): void;
  resolveExit(code: number): void;
  killExit(code?: number): void;
} {
  const { stream: input, chunks: written } = captureWritable();

  let outputController!: ReadableStreamDefaultController<string>;
  const output = new ReadableStream<string>({
    start(controller) {
      outputController = controller;
    },
  });

  let resolveExit!: (code: number) => void;
  const exit = new Promise<number>((resolve) => {
    resolveExit = resolve;
  });

  const resize = vi.fn();

  const proc = {
    input,
    output,
    exit,
    kill() {
      try {
        outputController.close();
      } catch {
        /* ignore double-close */
      }
      resolveExit(137);
    },
    resize,
    written,
    enqueueOutput(chunk: string) {
      outputController.enqueue(chunk);
    },
    resolveExit(code: number) {
      try {
        outputController.close();
      } catch {
        /* ignore */
      }
      resolveExit(code);
    },
    killExit(code = 137) {
      try {
        outputController.close();
      } catch {
        /* ignore */
      }
      resolveExit(code);
    },
  };

  return proc as unknown as WebContainerProcess & {
    readonly written: string[];
    enqueueOutput(chunk: string): void;
    resolveExit(code: number): void;
    killExit(code?: number): void;
  };
}

function createMockWebContainer(proc: WebContainerProcess): WebContainer {
  return {
    spawn: vi.fn(async () => proc),
  } as unknown as WebContainer;
}

describe("ShellSession", () => {
  it("spawn 使用默认命令与终端尺寸", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    await session.start();

    expect(vi.mocked(wc.spawn)).toHaveBeenCalledWith(
      DEFAULT_SHELL_COMMAND,
      expect.objectContaining({
        output: true,
        terminal: DEFAULT_TERMINAL_DIMENSIONS,
      }),
    );

    proc.resolveExit(0);
    await session.dispose();
  });

  it("write 原样写入 stdin", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    await session.start();

    await session.write("ls -la\n");
    expect(proc.written).toEqual(["ls -la\n"]);

    proc.resolveExit(0);
    await session.dispose();
  });

  it("writeBytes 按 UTF-8 解码后写入", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    await session.start();

    await session.writeBytes(new Uint8Array([0xe4, 0xb8, 0xad]));
    expect(proc.written).toEqual(["中"]);

    proc.resolveExit(0);
    await session.dispose();
  });

  it("转发 output 流片段", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    const seen: string[] = [];
    session.onOutput((c) => seen.push(c));

    await session.start();
    proc.enqueueOutput("hi");
    proc.enqueueOutput("there");

    await expect.poll(() => seen.join("")).toBe("hithere");

    proc.resolveExit(0);
    await session.dispose();
  });

  it("进程退出时触发 onExit", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    const codes: number[] = [];
    session.onExit((e) => codes.push(e.code));

    await session.start();
    proc.resolveExit(42);

    await expect.poll(() => codes).toEqual([42]);
    expect(session.state).toBe("exited");

    await session.dispose();
  });

  it("dispose 时不触发 onExit", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    const codes: number[] = [];
    session.onExit((e) => codes.push(e.code));

    await session.start();
    await session.dispose();

    expect(codes).toEqual([]);
    expect(session.state).toBe("disposed");
  });

  it("running 时 resize 委托给进程", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    await session.start();

    session.resize(120, 40);
    expect(proc.resize).toHaveBeenCalledWith({ cols: 120, rows: 40 });

    proc.resolveExit(0);
    await session.dispose();
  });

  it("非法终端尺寸在 start 时抛错", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc, { terminal: { cols: 0, rows: 24 } });

    await expect(session.start()).rejects.toThrow(/terminal.cols/);
  });

  it("重复 start 抛错", async () => {
    const proc = createMockProcess();
    const wc = createMockWebContainer(proc);
    const session = new ShellSession(wc);
    await session.start();
    await expect(session.start()).rejects.toThrow(/invalid state/);
    proc.resolveExit(0);
    await session.dispose();
  });
});
