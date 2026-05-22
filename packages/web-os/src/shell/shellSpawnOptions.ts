/** WebContainer 模板环境常见交互 Shell；调用方可通过 {@link ShellSessionOptions} 覆盖。 */
export const DEFAULT_SHELL_COMMAND = "jsh";

/** 未显式指定 {@link SpawnOptions.terminal} 时的默认终端尺寸。 */
export const DEFAULT_TERMINAL_DIMENSIONS = { cols: 80, rows: 24 } as const;
