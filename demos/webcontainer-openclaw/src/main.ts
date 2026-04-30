import "./style.css";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";

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

async function drainProcessOutput(
  stream: ReadableStream<string>,
  onChunk: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) onChunk(value);
    }
  } finally {
    reader.releaseLock();
  }
}

async function spawnLogged(
  wc: WebContainer,
  command: string,
  args: string[],
  append: (line: string) => void,
): Promise<number> {
  append(`\n$ ${command} ${args.join(" ")}\n`);
  const proc = await wc.spawn(command, args);
  const [, code] = await Promise.all([
    drainProcessOutput(proc.output, (t) => append(t)),
    proc.exit,
  ]);
  append(`\n[exit ${code}]\n`);
  return code;
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

  const hint = el("p", {}, [
    "在 WebContainer 内执行 npm install 与 openclaw CLI 探测。安装或运行失败亦属预期，详见仓库内 ",
  ]);
  const docRef = el("code", {}, [FEASIBILITY_PATH]);
  hint.append(docRef, document.createTextNode("。"));

  const logEl = el("pre", { "aria-live": "polite" });
  const lines: string[] = [];
  const append = (chunk: string) => {
    lines.push(chunk);
    logEl.textContent = lines.join("");
    logEl.scrollTop = logEl.scrollHeight;
  };

  let busy = false;

  const btn = el("button", { type: "button" }, ["在 WebContainer 中安装并探测 openclaw"]);
  btn.addEventListener("click", async () => {
    if (busy) return;
    if (!isolated) {
      append("\n[中止] 需要 crossOriginIsolated。\n");
      return;
    }
    busy = true;
    btn.toggleAttribute("disabled", true);
    lines.length = 0;
    logEl.textContent = "";
    append("WebContainer.boot() …\n");
    try {
      const wc = await bootWebContainer();
      append("已 boot。mount 最小 package.json …\n");
      await wc.mount(tree);
      const installCode = await spawnLogged(wc, "npm", ["install"], append);
      if (installCode !== 0) {
        append(
          `\n[npm install 非零退出] PoC 结束。若含 native 构建失败，与 ${FEASIBILITY_PATH} 一致。\n`,
        );
        return;
      }
      await spawnLogged(wc, "npx", ["openclaw", "--help"], append);
      append("\n[完成] 若 --help 成功，仅说明 CLI 可加载；完整 gateway 仍受可行性文档约束。\n");
    } catch (e) {
      append(`\n[错误] ${e instanceof Error ? e.message : String(e)}\n`);
    } finally {
      busy = false;
      btn.toggleAttribute("disabled", false);
    }
  });

  const actions = el("div", { className: "actions" }, [btn]);

  root.replaceChildren(
    el("h1", {}, ["WebContainer · OpenClaw PoC"]),
    banner,
    hint,
    actions,
    logEl,
  );
}

mountApp();
