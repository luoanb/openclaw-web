/** 与 `terminal.config.json` 字段一致；缺失项由默认值补齐。 */
export type TerminalConfig = {
  logMaxBytes: number;
  logMaxLines: number;
  /**
   * 前台子进程输出流式写入时，`this.buf` 在触发「整屏 clear 截断」前的字节放宽倍数（相对 `logMaxBytes`）。
   * 进程结束后仍会 `compactToCap` 按正常上限压回。
   */
  logForegroundHardMaxFactor: number;
  maxCmdLen: number;
  truncateStrategy: "drop-head";
  truncateMarker: string;
};

/** 加载合并后的终端配置（通常来自包内 JSON + 默认值）。 */
export interface ITerminalConfigLoader {
  load(): TerminalConfig;
}
