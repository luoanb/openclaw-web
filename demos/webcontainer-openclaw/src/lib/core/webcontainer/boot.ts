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

let workspaceMounted = false;

export async function ensureWorkspace(wc: WebContainer): Promise<void> {
  if (workspaceMounted) return;
  await wc.mount(tree);
  workspaceMounted = true;
}
