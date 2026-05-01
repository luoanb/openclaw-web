import type { Terminal } from "@xterm/xterm";
import type { TerminalConfig } from "./config";

/** 终端日志环形缓冲：按配置做字节与行数截断，并写入 xterm。 */
export class TerminalLogBuffer {
  /** 内部累积缓冲；调用方通过 `writeCapped` / `clear` 间接操作，不直接读写。 */
  private buf = "";

  private static applyLineCap(s: string, maxLines: number, marker: string): string {
    const lines = s.split(/\r?\n/);
    if (lines.length <= maxLines) return s;
    return marker + lines.slice(-maxLines).join("\n");
  }

  clear(term: Terminal): void {
    this.buf = "";
    term.clear();
  }

  /**
   * 将 chunk 写入缓冲并按配置截断（字节 + 行数上限）。
   */
  writeCapped(term: Terminal, chunk: string, cfg: TerminalConfig): void {
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
