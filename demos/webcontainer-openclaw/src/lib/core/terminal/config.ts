import rawConfig from "../../../../terminal.config.json";

/** 与 `terminal.config.json` 字段一致；缺失项由默认值补齐 */
export type TerminalConfig = {
  logMaxBytes: number;
  logMaxLines: number;
  maxCmdLen: number;
  truncateStrategy: "drop-head";
  truncateMarker: string;
};

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  logMaxBytes: 409600,
  logMaxLines: 2000,
  maxCmdLen: 8192,
  truncateStrategy: "drop-head",
  truncateMarker: "\r\n[… 日志已截断 …]\r\n",
};

export class TerminalConfigLoader {
  /** 读取 `terminal.config.json` 并与默认值合并。 */
  static load(): TerminalConfig {
    const u = rawConfig as Partial<TerminalConfig>;
    return {
      ...DEFAULT_TERMINAL_CONFIG,
      ...u,
      truncateStrategy: "drop-head",
    };
  }
}
