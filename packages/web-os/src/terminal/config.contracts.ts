/** 与 `terminal.config.json` 字段一致；缺失项由默认值补齐。 */
export type TerminalConfig = {
  logMaxBytes: number;
  logMaxLines: number;
  maxCmdLen: number;
  truncateStrategy: "drop-head";
  truncateMarker: string;
};

/** 加载合并后的终端配置（通常来自包内 JSON + 默认值）。 */
export interface ITerminalConfigLoader {
  load(): TerminalConfig;
}
