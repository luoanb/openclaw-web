import type { Terminal } from "@xterm/xterm";
import type { TerminalConfig } from "./config.contracts";

/** `writeCapped` 可选行为（前台流式输出等）。 */
export type WriteCappedOptions = {
  /**
   * 为 true 时表示子进程 stdout 正在流式写入：在不超过「硬上限」前**不做** `clear`+全量重同步，
   * 仅 `term.write(chunk)`；进程结束后由调用方执行 `compactToCap` 再按 `logMaxBytes`/`logMaxLines` 压回。
   */
  streamingForeground?: boolean;
};

/** 终端日志环形缓冲：按配置做字节与行数截断，并写入 xterm。 */
export class TerminalLogBuffer {
  /** 内部累积缓冲；调用方通过 `writeCapped` / `clear` / `compactToCap` 间接操作，不直接读写。 */
  private buf = "";

  private static applyLineCap(s: string, maxLines: number, marker: string): string {
    const lines = s.split(/\r?\n/);
    if (lines.length <= maxLines) return s;
    return marker + lines.slice(-maxLines).join("\n");
  }

  /** 按字节与行数上限计算截断后的字符串（不写终端）。 */
  static applyByteAndLineCap(s: string, cfg: TerminalConfig): string {
    let out = s;
    const marker = cfg.truncateMarker;
    if (out.length > cfg.logMaxBytes) {
      const keep = cfg.logMaxBytes - marker.length;
      out = marker + out.slice(-keep);
    }
    return TerminalLogBuffer.applyLineCap(out, cfg.logMaxLines, marker);
  }

  clear(term: Terminal): void {
    this.buf = "";
    term.clear();
  }

  /**
   * 在**非**流式前台输出阶段调用：若 `this.buf` 超出配置上限，则 `clear` 并以截断后的缓冲重写终端。
   * 典型时机：子进程输出泵结束后、提示符回写前。
   */
  compactToCap(term: Terminal, cfg: TerminalConfig): void {
    const out = TerminalLogBuffer.applyByteAndLineCap(this.buf, cfg);
    if (out === this.buf) return;
    this.buf = out;
    term.clear();
    term.write(out);
  }

  /**
   * 将 chunk 写入缓冲并按配置截断（字节 + 行数上限）。
   * `streamingForeground` 时推迟「破坏性」截断，避免 `clear()` 破坏 TUI 局部重绘（硬上限处仍可能强制同步）。
   */
  writeCapped(
    term: Terminal,
    chunk: string,
    cfg: TerminalConfig,
    opts?: WriteCappedOptions,
  ): void {
    if (opts?.streamingForeground) {
      this.buf += chunk;
      const hard =
        cfg.logMaxBytes * Math.max(1, cfg.logForegroundHardMaxFactor);
      if (this.buf.length > hard) {
        const out = TerminalLogBuffer.applyByteAndLineCap(this.buf, cfg);
        this.buf = out;
        term.clear();
        term.write(out);
        return;
      }
      const outIf = TerminalLogBuffer.applyByteAndLineCap(this.buf, cfg);
      if (outIf !== this.buf) {
        term.write(chunk);
        return;
      }
      term.write(chunk);
      return;
    }

    this.buf += chunk;
    let out = this.buf;
    const marker = cfg.truncateMarker;
    if (out.length > cfg.logMaxBytes) {
      const keep = cfg.logMaxBytes - marker.length;
      out = marker + out.slice(-keep);
    }
    out = TerminalLogBuffer.applyLineCap(out, cfg.logMaxLines, marker);
    if (out !== this.buf) {
      this.buf = out;
      term.clear();
      term.write(out);
      return;
    }
    term.write(chunk);
  }
}
