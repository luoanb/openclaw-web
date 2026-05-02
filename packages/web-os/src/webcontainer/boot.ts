import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import type { IBoot } from "./boot.contracts";
import { tree } from "./minimalWorkspaceTemplate";

export type { IBoot, IWebOsBoot } from "./boot.contracts";

export class Boot implements IBoot {
  private wcSingleton: Promise<WebContainer> | null = null;

  private workspaceContentMounted = false;

  boot(): Promise<WebContainer> {
    this.wcSingleton ??= WebContainer.boot();
    return this.wcSingleton;
  }

  /** 首次挂载内置最小模板；若已通过导入挂载则不再覆盖。 */
  async ensureWorkspace(wc: WebContainer): Promise<void> {
    if (this.workspaceContentMounted) return;
    await wc.mount(tree);
    this.workspaceContentMounted = true;
  }

  /** 从快照恢复并标记已挂载，使后续 `ensureWorkspace` 不再套用模板。 */
  async mountImportedWorkspace(
    wc: WebContainer,
    payload: FileSystemTree | ArrayBuffer,
  ): Promise<void> {
    await wc.mount(payload);
    this.workspaceContentMounted = true;
  }
}

/** @deprecated 请使用 {@link Boot}。 */
export { Boot as WebOsBoot };

/** 默认会话级引导器（与既有顶层函数 `bootWebContainer` 等行为一致）。 */
export const webOsBoot = new Boot();

export {
  FEASIBILITY_PATH,
  OPENCLAW_VERSION,
  tree,
} from "./minimalWorkspaceTemplate";

export function bootWebContainer(): Promise<WebContainer> {
  return webOsBoot.boot();
}

export async function ensureWorkspace(wc: WebContainer): Promise<void> {
  return webOsBoot.ensureWorkspace(wc);
}

export async function mountImportedWorkspace(
  wc: WebContainer,
  payload: FileSystemTree | ArrayBuffer,
): Promise<void> {
  return webOsBoot.mountImportedWorkspace(wc, payload);
}
