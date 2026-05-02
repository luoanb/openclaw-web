import { WebContainer, type FileSystemTree } from "@webcontainer/api";

export const OPENCLAW_VERSION = "2026.4.27";

export const FEASIBILITY_PATH = "docs/research/feasibility-openclaw-webcontainers.md";

export const tree: FileSystemTree = {
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

let wcSingleton: Promise<WebContainer> | null = null;

export function bootWebContainer(): Promise<WebContainer> {
  wcSingleton ??= WebContainer.boot();
  return wcSingleton;
}

/**
 * 是否已为当前会话挂载过 **初始模板**（package.json）或任意 **用户导入** 树。
 * - `ensureWorkspace`：仅在首次挂载 PoC 模板；避免重复 mount 覆盖用户变更。
 * - `mountImportedWorkspace`：导入快照时总是 `mount`，并标记已挂载，使后续 `ensureWorkspace` 不再套用模板。
 */
let workspaceContentMounted = false;

/** 首次进入 demo / PoC / 终端命令：挂载内置最小 `package.json` 工作区（仅一次）。 */
export async function ensureWorkspace(wc: WebContainer): Promise<void> {
  if (workspaceContentMounted) return;
  await wc.mount(tree);
  workspaceContentMounted = true;
}

/**
 * 从 IndexedDB 快照恢复：覆盖当前虚拟文件系统。
 * 与 `ensureWorkspace` 分层，避免旧实现里「已 mount 则短路」导致导入无法执行。
 * `payload` 与官方 API 一致：`FileSystemTree`（json 导出）或 `ArrayBuffer`（binary 快照）。
 */
export async function mountImportedWorkspace(
  wc: WebContainer,
  payload: FileSystemTree | ArrayBuffer,
): Promise<void> {
  await wc.mount(payload);
  workspaceContentMounted = true;
}
