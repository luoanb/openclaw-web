import type { WebContainer } from "@webcontainer/api";

/** 预览面板生命周期：`idle` 未附着；`waiting` 已订阅等待 URL；`ready` 已写入 iframe；`load-error` 预留。 */
export type PreviewStatus = "idle" | "waiting" | "ready" | "load-error";

/** `sink` 收到的状态事件；`ready` 时含权威服务 URL 与端口。 */
export type PreviewStatusEvent = {
  status: PreviewStatus;
  /** 仅在 `ready` 等阶段由 WebContainer 提供 */
  url?: string;
  port?: number;
};

/**
 * 订阅 `server-ready` 并将权威预览 URL 写入 iframe 的契约。
 *
 * @returns 取消订阅函数（解除监听；不关闭 WebContainer）。
 */
export interface IWebOsPreviewAttachment {
  attach(
    wc: WebContainer,
    iframe: HTMLIFrameElement,
    sink: (ev: PreviewStatusEvent) => void,
  ): () => void;
}

/**
 * @deprecated 请使用 {@link IWebOsPreviewAttachment}。
 */
export type IPreviewAttachment = IWebOsPreviewAttachment;
