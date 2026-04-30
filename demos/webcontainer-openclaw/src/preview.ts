import type { WebContainer } from "@webcontainer/api";

export type PreviewStatus = "idle" | "waiting" | "ready" | "load-error";

export type PreviewStatusEvent = {
  status: PreviewStatus;
  url?: string;
  port?: number;
};

/**
 * 订阅 `server-ready`，把权威预览 URL 交给 iframe；返回取消订阅。
 */
export function attachPreview(
  wc: WebContainer,
  iframe: HTMLIFrameElement,
  sink: (ev: PreviewStatusEvent) => void,
): () => void {
  sink({ status: "waiting" });
  const unsub = wc.on("server-ready", (port, url) => {
    sink({ status: "ready", url, port });
    iframe.src = url;
  });
  return () => {
    unsub();
  };
}
