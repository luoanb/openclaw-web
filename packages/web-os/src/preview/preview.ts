import type { WebContainer } from "@webcontainer/api";
import type { IWebOsPreviewAttachment, PreviewStatusEvent } from "./preview.contracts";

export class WebOsPreviewAttachment implements IWebOsPreviewAttachment {
  attach(
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
}

export const webOsPreviewAttachment = new WebOsPreviewAttachment();

export function attachPreview(
  wc: WebContainer,
  iframe: HTMLIFrameElement,
  sink: (ev: PreviewStatusEvent) => void,
): () => void {
  return webOsPreviewAttachment.attach(wc, iframe, sink);
}
