export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

export const items = $state<ToastItem[]>([]);

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dismissToast(id: string): void {
  const index = items.findIndex((toast) => toast.id === id);
  if (index !== -1) items.splice(index, 1);
}

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
