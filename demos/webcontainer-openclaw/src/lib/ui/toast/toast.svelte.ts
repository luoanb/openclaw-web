export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

/** 供 ToastRegion 与编译器建立响应式依赖。 */
export const items = $state<ToastItem[]>([]);

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dismissToast(id: string): void {
  const i = items.findIndex((t) => t.id === id);
  if (i !== -1) items.splice(i, 1);
}

/**
 * 展示一条自动消失的提示（默认 5s，duration: 0 表示不自动关闭）。
 */
export function toast(
  message: string,
  opts?: { variant?: ToastVariant; duration?: number },
): void {
  const variant = opts?.variant ?? "info";
  const duration = opts?.duration ?? 5000;
  const id = nextId();
  items.push({ id, message, variant });
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
}
