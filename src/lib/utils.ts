import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("zh-CN");

export function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

/** 秒数 → 易读时长：22 秒 / 2 分 16 秒 / 4.5 小时 / 3.2 天 */
export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} 秒`;

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest > 0 ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
  }

  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)} 小时`;
  return `${(seconds / 86_400).toFixed(1)} 天`;
}
