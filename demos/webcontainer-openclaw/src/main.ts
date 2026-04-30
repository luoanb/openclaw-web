import "./style.css";
import "@xterm/xterm/css/xterm.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { attachPreview } from "./preview";
import {
  abortCurrentShell,
  clearTerminal,
  createLogRing,
  createProcessRef,
  runShellLine,
  runSpawn,
  writeCapped,
  type LogRing,
  type ProcessRef,
} from "./terminal";

/** 与仓库内 `demos/openclaw/package.json` 的 version 对齐，便于复现 */
const OPENCLAW_VERSION = "2026.4.27";

const FEASIBILITY_PATH = "docs/research/feasibility-openclaw-webcontainers.md";

const tree: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "wc-openclaw-sandbox",
          private: true,
          type: "module",
          dependencies: {
            openclaw: OPENCLAW_VERSION,
          },
        },
        null,
        2,
      ),
    },
  },
};

/** WebContainer.boot() 每页只能调用一次（官方约束） */
let wcSingleton: Promise<WebContainer> | null = null;
function bootWebContainer(): Promise<WebContainer> {
  wcSingleton ??= WebContainer.boot();
  return wcSingleton;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | boolean | (() => void)> = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "className") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (typeof v === "boolean") {
      if (v) node.setAttribute(k, "");
    } else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

let workspaceMounted = false;
async function ensureWorkspace(wc: WebContainer): Promise<void> {
  if (workspaceMounted) return;
  await wc.mount(tree);
  workspaceMounted = true;
}

function createXterm(host: HTMLElement): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    cursorBlink: false,
    disableStdin: true,
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    theme: {
      background: "#161b22",
      foreground: "#e6edf3",
      cursor: "#58a6ff",
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(host);
  const ro = new ResizeObserver(() => {
    try {
      fit.fit();
    } catch {
      /* host may be 0-sized briefly */
    }
  });
  ro.observe(host);
  requestAnimationFrame(() => fit.fit());
  return { term, fit };
}

function mountApp(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const isolated = globalThis.crossOriginIsolated;
  const banner = el("div", {
    className: `banner ${isolated ? "ok" : "warn"}`,
  });
  banner.textContent = isolated
    ? "crossOriginIsolated：已就绪，可启动 WebContainer。"
    : "当前页面未处于 crossOriginIsolated 环境。请确认通过本 demo 的 Vite dev/preview 访问（已配置 COOP/COEP），并硬刷新。";

  const hint = el("p", { className: "lede" }, [
    "在 WebContainer 内执行命令或一键 PoC。沙箱边界与限制见仓库内 ",
  ]);
  const docRef = el("code", {}, [FEASIBILITY_PATH]);
  hint.append(docRef, document.createTextNode("。"));

  const termHost = el("div", {
    className: "terminal-host",
    role: "log",
    "aria-live": "polite",
    "aria-label": "终端输出",
  });
  termHost.tabIndex = 0;
  const { term, fit } = createXterm(termHost);

  const ring: LogRing = createLogRing();
  const processRef: ProcessRef = createProcessRef();

  let busy = false;

  const cmdInput = el("textarea", {
    className: "cmd-input",
    rows: "3",
    spellcheck: "false",
    placeholder:
      "输入一行 shell（由 sh -c 执行），例如 npx openclaw --help 或 npx serve -l 3000 …",
    "aria-label": "要执行的 shell 命令",
  }) as HTMLTextAreaElement;

  const runBtn = el("button", { type: "button", className: "btn-primary" }, [
    "执行",
  ]) as HTMLButtonElement;
  const abortBtn = el("button", { type: "button", className: "btn-danger" }, [
    "中止",
  ]) as HTMLButtonElement;
  abortBtn.title = "中止当前子进程（依赖 WebContainer kill）";
  abortBtn.disabled = true;

  const pocBtn = el("button", { type: "button" }, [
    "一键安装并探测 openclaw",
  ]) as HTMLButtonElement;

  const shortcuts = el("div", { className: "shortcuts" }, []);
  const preset = (label: string, text: string) => {
    const b = el("button", { type: "button", className: "btn-ghost" }, [label]);
    b.addEventListener("click", () => {
      cmdInput.value = text;
      cmdInput.focus();
    });
    shortcuts.append(b);
  };
  preset("npx openclaw --help", "npx openclaw --help");
  preset("npm run dev（若 package 中有脚本）", "npm run dev");
  preset("静态站示例", "npx serve -l 3000");

  const previewIframe = el("iframe", {
    className: "preview-frame",
    title: "WebContainer 预览",
  }) as HTMLIFrameElement;
  previewIframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups",
  );

  const previewStatus = el("div", { className: "preview-status" });
  const previewHelp = el("p", { className: "preview-help" }, [
    "预览 URL 来自 WebContainer 的 server-ready 事件（请勿手动拼接不可信地址）。受浏览器 COEP/混合内容等策略影响时 iframe 可能空白，详见 ",
  ]);
  const wcDoc = el(
    "a",
    {
      href: "https://webcontainers.io/",
      target: "_blank",
      rel: "noreferrer",
    },
    ["webcontainers.io"],
  );
  previewHelp.append(wcDoc, document.createTextNode(" 文档。"));

  function setPreviewMessage(html: string): void {
    previewStatus.innerHTML = html;
  }

  setPreviewMessage(
    '<span class="muted">先 boot 容器；在容器内启动 HTTP 服务后，由 server-ready 填充预览。</span>',
  );

  let detachPreview: (() => void) | null = null;
  function wirePreview(wc: WebContainer): void {
    if (detachPreview) return;
    detachPreview = attachPreview(wc, previewIframe, (ev) => {
      if (ev.status === "waiting") {
        setPreviewMessage(
          '已订阅 <code>server-ready</code>；在终端运行例如 <code>npx serve -l 3000</code> 等待端口就绪…',
        );
        return;
      }
      if (ev.status === "ready" && ev.url) {
        setPreviewMessage(
          `就绪：端口 <strong>${String(ev.port ?? "?")}</strong> → <code>${escapeHtml(ev.url)}</code>`,
        );
      }
    });
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function syncActionState(): void {
    const canRun = isolated && !busy;
    runBtn.disabled = !canRun;
    pocBtn.disabled = !canRun;
    abortBtn.disabled = !processRef.current;
  }

  syncActionState();

  previewIframe.addEventListener("error", () => {
    setPreviewMessage(
      '<span class="warn">预览 iframe 加载出错（可能与 COEP / 混合内容有关）。可尝试「新标签打开」。</span>',
    );
  });

  const openPreviewBtn = el("button", { type: "button" }, [
    "新标签打开预览",
  ]) as HTMLButtonElement;
  openPreviewBtn.addEventListener("click", () => {
    const u = previewIframe.src;
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  });

  const refreshPreviewBtn = el("button", { type: "button" }, [
    "刷新预览",
  ]) as HTMLButtonElement;
  refreshPreviewBtn.addEventListener("click", () => {
    const u = previewIframe.src;
    if (u) previewIframe.src = u;
  });

  runBtn.addEventListener("click", async () => {
    if (busy || !isolated) {
      if (!isolated) {
        writeCapped(term, ring, "\r\n[中止] 需要 crossOriginIsolated。\r\n");
      }
      return;
    }
    const line = cmdInput.value;
    if (!line.trim()) return;
    busy = true;
    syncActionState();
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      await ensureWorkspace(wc);
      await runShellLine(
        wc,
        line,
        term,
        ring,
        processRef,
        syncActionState,
      );
    } catch (e) {
      writeCapped(
        term,
        ring,
        `\r\n[错误] ${e instanceof Error ? e.message : String(e)}\r\n`,
      );
    } finally {
      busy = false;
      syncActionState();
      requestAnimationFrame(() => fit.fit());
    }
  });

  abortBtn.addEventListener("click", () => {
    abortCurrentShell(processRef);
    queueMicrotask(syncActionState);
  });

  pocBtn.addEventListener("click", async () => {
    if (busy || !isolated) {
      if (!isolated) {
        writeCapped(term, ring, "\r\n[中止] 需要 crossOriginIsolated。\r\n");
      }
      return;
    }
    busy = true;
    syncActionState();
    clearTerminal(term, ring);
    writeCapped(term, ring, "WebContainer.boot() …\r\n");
    try {
      const wc = await bootWebContainer();
      wirePreview(wc);
      writeCapped(term, ring, "已 boot。mount 最小 package.json …\r\n");
      await ensureWorkspace(wc);
      const installCode = await runSpawn(
        wc,
        term,
        ring,
        processRef,
        "npm",
        ["install"],
        "$ npm install",
        syncActionState,
      );
      if (installCode !== 0) {
        writeCapped(
          term,
          ring,
          `\r\n[npm install 非零退出] PoC 结束。若含 native 构建失败，与 ${FEASIBILITY_PATH} 一致。\r\n`,
        );
        return;
      }
      await runSpawn(
        wc,
        term,
        ring,
        processRef,
        "npx",
        ["openclaw", "--help"],
        "$ npx openclaw --help",
        syncActionState,
      );
      writeCapped(
        term,
        ring,
        "\r\n[完成] 若 --help 成功，仅说明 CLI 可加载；完整 gateway 仍受可行性文档约束。\r\n",
      );
    } catch (e) {
      writeCapped(
        term,
        ring,
        `\r\n[错误] ${e instanceof Error ? e.message : String(e)}\r\n`,
      );
    } finally {
      busy = false;
      syncActionState();
      requestAnimationFrame(() => fit.fit());
    }
  });

  const terminalPanel = el("section", { className: "panel terminal-panel" }, []);
  terminalPanel.append(
    el("h2", { className: "panel-title" }, ["终端"]),
    termHost,
    el("div", { className: "cmd-row" }, [cmdInput, runBtn, abortBtn]),
    el("div", { className: "shortcut-label" }, ["快捷填入："]),
    shortcuts,
    el("div", { className: "actions" }, [pocBtn]),
  );

  const previewPanel = el("section", { className: "panel preview-panel" }, []);
  previewPanel.append(
    el("h2", { className: "panel-title" }, ["预览"]),
    previewStatus,
    previewIframe,
    el("div", { className: "preview-toolbar" }, [
      openPreviewBtn,
      refreshPreviewBtn,
    ]),
    previewHelp,
  );

  const workspace = el("div", { className: "workspace" }, [
    terminalPanel,
    previewPanel,
  ]);

  root.replaceChildren(
    el("h1", {}, ["WebContainer · OpenClaw"]),
    banner,
    hint,
    workspace,
  );
}

mountApp();
