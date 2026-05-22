import type { Terminal } from "@xterm/xterm";

/** 与 demo 终端 UI 约束一致（对应 web-os 包内 `terminal.config.json` 默认值）。 */
export type TerminalUiConfig = {
  logMaxBytes: number;
  logMaxLines: number;
  logForegroundHardMaxFactor: number;
  maxCmdLen: number;
  truncateStrategy: "drop-head";
  truncateMarker: string;
};

export const DEFAULT_TERMINAL_UI_CONFIG: TerminalUiConfig = {
  logMaxBytes: 409600,
  logMaxLines: 2000,
  logForegroundHardMaxFactor: 4,
  maxCmdLen: 8192,
  truncateStrategy: "drop-head",
  truncateMarker: "\r\n[… 日志已截断 …]\r\n",
};

export type WriteCappedOptions = {
  streamingForeground?: boolean;
};

/** xterm 日志环形缓冲：按配置截断后写入终端（自包含，不依赖 web-os `terminal`）。 */
export class TerminalLogBuffer {
  private buf = "";

  private static applyLineCap(s: string, maxLines: number, marker: string): string {
    const lines = s.split(/\r?\n/);
    if (lines.length <= maxLines) return s;
    return marker + lines.slice(-maxLines).join("\n");
  }

  static applyByteAndLineCap(s: string, cfg: TerminalUiConfig): string {
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

  compactToCap(term: Terminal, cfg: TerminalUiConfig): void {
    const out = TerminalLogBuffer.applyByteAndLineCap(this.buf, cfg);
    if (out === this.buf) return;
    this.buf = out;
    term.clear();
    term.write(out);
  }

  writeCapped(
    term: Terminal,
    chunk: string,
    cfg: TerminalUiConfig,
    opts?: WriteCappedOptions,
  ): void {
    if (opts?.streamingForeground) {
      this.buf += chunk;
      const hard = cfg.logMaxBytes * Math.max(1, cfg.logForegroundHardMaxFactor);
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
