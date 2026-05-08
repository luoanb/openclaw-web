/**
 * 终端会话路径提示与「整行 `cd`」解析契约。
 *
 * **语义约定**：`cwdRel` 为相对 WebContainer **`workdir`** 的 POSIX 风格路径片段（**空串**表示位于 workdir 根）。
 * 与 one-shot `sh -c` 配合时，仅当一行匹配「仅 `cd`」时在命令 **exit 0** 后用 {@link resolveCdArg} 更新会话 `cwdRel`。
 */
export interface ITerminalCwdPrompt {
  /**
   * 判断该行是否为「整行 cd」（可选参数、可选引号包裹）。
   * @param trimmedLine 建议传入已 `trim` 的单行用户输入，与 shell 行语义一致。
   */
  isCdOnlyLine(trimmedLine: string): boolean;

  /**
   * 从「cd-only」行解析目标参数；无参数或仅有空白时视为 `~`（回到 workdir 根的会话语义）。
   * @param trimmedLine 通常为已通过 {@link isCdOnlyLine} 为真的行。
   */
  cdArgFromLine(trimmedLine: string): string;

  /**
   * 将 `cd` 参数解析为新的 **`cwdRel`**（相对 workdir，已归一化 `.` / `..` / 多余 `/`）。
   * @param currentRel 当前会话相对路径（空串为根）。
   * @param arg {@link cdArgFromLine} 的返回值或等价片段。
   */
  resolveCdArg(currentRel: string, arg: string): string;

  /**
   * 生成提示符中展示的「主路径」文案：`~/工作区目录名片段` + 可选 `/相对子路径`。
   * @param workdir 容器 workdir 绝对路径字符串（用于取目录名片段）。
   * @param cwdRel 当前会话相对 workdir 的路径。
   */
  formatPromptLabel(workdir: string, cwdRel: string): string;

  /**
   * 完整提示符一行，一般在 {@link formatPromptLabel} 后追加 ` $ `。
   */
  formatPromptLine(workdir: string, cwdRel: string): string;
}
