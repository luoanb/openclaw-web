import type { Terminal } from "@xterm/xterm";
import type { WebContainer } from "@webcontainer/api";
import type { TerminalConfig } from "./config.interfaces";
import type { OutputReaderRef, StdinForwardRef, WebContainerProcessRef } from "./refs";
import type { TerminalLogBuffer } from "./logBuffer";

/** 相对 WebContainer `workdir`；省略或空串表示默认 workdir */
export type SpawnExtraOptions = {
  cwd?: string;
};

export type RunShellLineOptions = {
  /** 与 TerminalPanel 本地行回显为 true 时不再打印 `$ cmd`，避免重复一行 */
  noCommandEcho?: boolean;
  /** 相对 WebContainer `workdir`；省略或空串表示默认 workdir */
  cwd?: string;
};

/** `WebContainerTerminalSession.runSpawn` 的附加选项。 */
export type WebContainerTerminalSessionSpawnOptions = {
  /** 省略时生成 `\r\n$ <command> <args...>\r\n` 风格的引导行。 */
  intro?: string;
  /** 相对容器 `workdir`；省略时使用会话当前 `cwdRel`（若为空则不限定 cwd）。 */
  cwd?: string;
};

/**
 * 单 xterm 面板与 WebContainer 前台 shell 的会话 Facade（推荐对外入口）。
 * 构造时绑定 `Terminal` 与配置；`WebContainer` 通过 `bindWebContainer` 延迟注入。
 */
export interface IWebContainerTerminalSession {
  /** 注入或更新当前会话使用的容器实例（多面板可共享同一引用）。 */
  bindWebContainer(wc: WebContainer): void;

  /** 是否已有前台子进程（与 `abort` 可用性相关）。 */
  get hasForegroundProcess(): boolean;

  /** 相对容器 `workdir` 的会话路径片段（`cd`-only 成功时会更新）。 */
  get cwdRel(): string;
  set cwdRel(value: string);

  /** 与 `TerminalCwdPrompt` 默认实现一致的提示行（需传入容器 `workdir` 绝对路径字符串）。 */
  formatPromptLine(workdir: string): string;

  readonly logBuffer: TerminalLogBuffer;
  readonly processRef: WebContainerProcessRef;
  readonly stdinForwardRef: StdinForwardRef;
  readonly outputReaderRef: OutputReaderRef;

  /**
   * 对单行执行 `sh -c`；内部合并会话 `cwdRel` 与 `options.cwd`。
   * `cd` 整行且 exit 0 时会更新会话路径并触发构造时的 `onCwdRelChange`。
   */
  runLine(
    line: string,
    options?: RunShellLineOptions,
  ): Promise<{ code: number }>;

  /**
   * 通用 `wc.spawn` + 输出泵；运行期间设置 `stdinForwardRef` 供 xterm 转发。
   */
  runSpawn(
    command: string,
    args: string[],
    options?: WebContainerTerminalSessionSpawnOptions,
  ): Promise<number>;

  /** Ctrl-C、取消输出 reader、`kill` 当前前台进程。 */
  abort(): void;

  /**
   * 释放 `Terminal.onResize` 等订阅；在 dispose xterm `Terminal` 之前调用，避免泄漏。
   */
  dispose(): void;
}

export type WebContainerTerminalSessionOptions = {
  term: Terminal;
  config: TerminalConfig;
  /** 前台进程出现/消失时回调（用于 UI 更新「中止」可用态等）。 */
  onForegroundChange?: (running: boolean) => void;
  /** 会话 `cwdRel` 因 `cd` 成功而变化时回调（便于框架层同步 `$state`）。 */
  onCwdRelChange?: (cwdRel: string) => void;
  /** 初始相对 `workdir` 路径，默认 `""`。 */
  initialCwdRel?: string;
};
