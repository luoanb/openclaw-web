export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
}

export const toastItems = $state<ToastItem[]>([]);

let sequence = 0;

export function dismissToast(id: string): void {
  const index = toastItems.findIndex((item) => item.id === id);
  if (index !== -1) {
    toastItems.splice(index, 1);
  }
}

export function toast(message: string, options: ToastOptions = {}): void {
  const variant = options.variant ?? "info";
  const duration = options.duration ?? 4000;
  const id = `toast-${Date.now()}-${sequence++}`;

  toastItems.push({ id, message, variant });

  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
}
