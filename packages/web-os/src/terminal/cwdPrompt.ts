import type { ITerminalCwdPrompt } from "./cwdPrompt.contracts";

const CD_ONLY = /^\s*cd(?:\s+(?<arg>.+))?\s*$/;

export class TerminalCwdPrompt {
  private static normalizePosixRel(rel: string): string {
    const segments = rel.split("/").filter(Boolean);
    const stack: string[] = [];
    for (const s of segments) {
      if (s === "..") {
        stack.pop();
      } else if (s !== ".") {
        stack.push(s);
      }
    }
    return stack.join("/");
  }

  private static stripQuotes(raw: string): string {
    const t = raw.trim();
    if (t.length >= 2) {
      const q = t[0]!;
      if ((q === '"' || q === "'") && t[t.length - 1] === q) {
        return t.slice(1, -1).trim();
      }
    }
    return t;
  }

  /**
   * 是否为「整行 cd」；与 one-shot `sh -c` 语义一致，仅此类行在 exit 0 后更新会话 cwd。
   */
  static isCdOnlyLine(trimmedLine: string): boolean {
    return CD_ONLY.test(trimmedLine);
  }

  /** 从 cd-only 行取出目标参数（无参数等价于 `~`）。 */
  static cdArgFromLine(trimmedLine: string): string {
    const m = trimmedLine.match(CD_ONLY);
    const g = m?.groups as { arg?: string } | undefined;
    const raw = g?.arg?.trim() ?? "";
    return TerminalCwdPrompt.stripQuotes(raw);
  }

  static resolveCdArg(currentRel: string, arg: string): string {
    const a = arg.trim();
    if (!a || a === "~") return "";
    if (a === "/") return "";
    if (a.startsWith("~/")) {
      return TerminalCwdPrompt.normalizePosixRel(a.slice(2));
    }
    if (a.startsWith("/")) {
      return TerminalCwdPrompt.normalizePosixRel(a.slice(1));
    }
    return TerminalCwdPrompt.normalizePosixRel(
      TerminalCwdPrompt.joinSteps(currentRel, a),
    );
  }

  private static joinSteps(baseRel: string, step: string): string {
    const base = baseRel.split("/").filter(Boolean);
    const more = step.split("/").filter(Boolean);
    return [...base, ...more].join("/");
  }

  /** 展示路径：`~/工作区目录名` + 可选 `/相对子路径` */
  static formatPromptLabel(workdir: string, cwdRel: string): string {
    const rel = TerminalCwdPrompt.normalizePosixRel(cwdRel);
    const norm = workdir.replace(/\/+$/, "").trim();
    if (!norm) {
      return rel ? `~/${rel}` : "~";
    }
    const parts = norm.split("/").filter(Boolean);
    const leaf = parts.length ? parts[parts.length - 1]! : "workspace";
    const home = `~/${leaf}`;
    if (!rel) return home;
    return `${home}/${rel}`;
  }

  static formatPromptLine(workdir: string, cwdRel: string): string {
    return `${TerminalCwdPrompt.formatPromptLabel(workdir, cwdRel)} $ `;
  }
}

export const terminalCwdPrompt: ITerminalCwdPrompt = TerminalCwdPrompt; // 校验：将类（构造函数）赋值给接口类型的变量