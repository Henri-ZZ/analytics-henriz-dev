import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("zh-CN");

export function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}
