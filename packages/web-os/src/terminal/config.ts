import rawConfig from "../../terminal.config.json";
import type { ITerminalConfigLoader, TerminalConfig } from "./config.interfaces";

export type { TerminalConfig } from "./config.interfaces";

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  logMaxBytes: 409600,
  logMaxLines: 2000,
  logForegroundHardMaxFactor: 4,
  maxCmdLen: 8192,
  truncateStrategy: "drop-head",
  truncateMarker: "\r\n[… 日志已截断 …]\r\n",
};

export class TerminalConfigLoader implements ITerminalConfigLoader {
  /** 读取 `terminal.config.json` 并与默认值合并。 */
  load(): TerminalConfig {
    const u = rawConfig as Partial<TerminalConfig>;
    const factor =
      typeof u.logForegroundHardMaxFactor === "number" &&
      u.logForegroundHardMaxFactor >= 1
        ? u.logForegroundHardMaxFactor
        : DEFAULT_TERMINAL_CONFIG.logForegroundHardMaxFactor;
    return {
      ...DEFAULT_TERMINAL_CONFIG,
      ...u,
      logForegroundHardMaxFactor: factor,
      truncateStrategy: "drop-head",
    };
  }

  static load(): TerminalConfig {
    return terminalConfigLoader.load();
  }
}

export const terminalConfigLoader = new TerminalConfigLoader();
