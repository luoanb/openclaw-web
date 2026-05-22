import type { SpawnOptions, WebContainer } from "@webcontainer/api";

export type ShellSessionState = "idle" | "running" | "exited" | "disposed";

export type ShellExitInfo = {
  code: number;
};

export type Unsubscribe = () => void;

/**
 * 启动交互式 Shell 的选项；语义对齐 {@link SpawnOptions}，不在此处注入业务侧「聪明」改写。
 */
export type ShellSessionOptions = {
  /** 默认同 {@link DEFAULT_SHELL_COMMAND} */
  command?: string;
  args?: string[];
  cwd?: string;
  env?: SpawnOptions["env"];
  /** 默认 true */
  output?: boolean;
  /** 未指定时使用包内默认列行数 */
  terminal?: SpawnOptions["terminal"];
};

export interface IShellSession {
  readonly state: ShellSessionState;

  /** `WebContainer.spawn` 成功并订阅输出后进入 `running`。 */
  start(): Promise<void>;

  /**
   * 将文本 **原样** 写入进程 input（与官方 `WritableStream<string>` 一致）。
   * 控制字符应作为 JS 字符串中的 Unicode 码位传入（例如 `"\x03"`）。
   */
  write(chunk: string): Promise<void>;

  /** 将 UTF-8 字节解码为字符串后写入；非法序列按 `TextDecoder` 非 fatal 规则替换。 */
  writeBytes(chunk: Uint8Array): Promise<void>;

  resize(cols: number, rows: number): void;

  /** `kill`、释放读写端、幂等。 */
  dispose(): Promise<void>;

  onOutput(listener: (chunk: string) => void): Unsubscribe;
  onExit(listener: (info: ShellExitInfo) => void): Unsubscribe;
}

/**
 * 工厂：构造会话实例（须再 `start()`）。
 * 便于注入 Mock {@link WebContainer} 做测试。
 */
export type ShellSessionFactory = (
  wc: WebContainer,
  options?: ShellSessionOptions,
) => IShellSession;
