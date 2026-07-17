import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO-8601 timestamp to "YYYY-MM-DD HH:mm" (date with hyphens,
 * time with colons). Parses in local timezone to avoid off-by-one display.
 *
 * Example:
 *   formatDateTime("2026-06-16T12:34:56.789Z")  → "2026-06-16 20:34"
 *   formatDateTime("2026-06-16T12:34:56.789")   → "2026-06-16 12:34"
 */
export function formatDateTime(iso: string): string {
  if (!iso) {
    return "";
  }

  // Append Z if missing so that temporal treats it as UTC
  const normalized = iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`;
  const d = new Date(normalized);

  if (isNaN(d.getTime())) {
    // Fallback: just drop the time part after T for invalid dates
    return iso.replace(/[T].*$/, "").replace(/[-]/g, "-");
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
