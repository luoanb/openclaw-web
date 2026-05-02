import type { WebContainerProcess } from "@webcontainer/api";

/** 当前前台子进程；由 `WebContainerShellRunner` 与 UI 中止逻辑读写。 */
export class WebContainerProcessRef {
  current: WebContainerProcess | null = null;
}

/** 子进程 stdin writer；`onData` 在有前台进程时写入此处。 */
export class StdinForwardRef {
  current: ReturnType<WritableStream<string>["getWriter"]> | null = null;
}

/** 当前输出 pump 的 reader；中止时 cancel。 */
export class OutputReaderRef {
  current: ReadableStreamDefaultReader<string> | null = null;
}
