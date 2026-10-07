import type { DistributionDimension, InstallationStatus } from "@/lib/edit-page-types";

/**
 * Edit Page 各分析页共用的展示常量。
 * 纯数据、无运行时代码，客户端可以安全引用。
 */

export const BROWSER_LABELS: Record<string, string> = {
  chrome: "Chrome",
  edge: "Edge",
  brave: "Brave",
  opera: "Opera",
  vivaldi: "Vivaldi",
  other_chromium: "Chromium",
};

export const OS_LABELS: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  chromeos: "ChromeOS",
  android: "Android",
  other: "Other",
};

export const STATUS_META: Record<InstallationStatus, { label: string; dot: string; text: string }> = {
  active: { label: "活跃", dot: "bg-emerald-500", text: "text-emerald-700" },
  idle: { label: "沉默", dot: "bg-amber-400", text: "text-amber-700" },
  churned: { label: "流失", dot: "bg-rose-400", text: "text-rose-600" },
  uninstalled: { label: "已卸载", dot: "bg-[#b6bdb9]", text: "text-[var(--subtle)]" },
};

export function browserLabel(value: string) {
  return BROWSER_LABELS[value] ?? value;
}

export function osLabel(value: string) {
  return OS_LABELS[value] ?? value;
}

export function licenseLabel(value: string) {
  if (value === "premium") return "Premium";
  if (value === "free") return "Free";
  return value;
}

export function statusLabel(value: string) {
  return STATUS_META[value as InstallationStatus]?.label ?? value;
}

export const DISTRIBUTION_DIMENSION_OPTIONS: { value: DistributionDimension; label: string }[] = [
  { value: "browser", label: "浏览器" },
  { value: "os", label: "操作系统" },
  { value: "distribution", label: "渠道" },
  { value: "licenseType", label: "授权" },
  { value: "currentVersion", label: "版本" },
  { value: "status", label: "状态" },
];

/** 把某个维度下的原始值翻成展示用文案 */
export function dimensionValueLabel(dimension: DistributionDimension, value: string) {
  switch (dimension) {
    case "browser":
      return browserLabel(value);
    case "os":
      return osLabel(value);
    case "licenseType":
      return licenseLabel(value);
    case "status":
      return statusLabel(value);
    default:
      return value;
  }
}

/** 图表配色：优先明快的红 / 黄 / 绿 / 蓝，再补其他鲜艳色 */
export const CHART_COLORS = [
  "#ef4444", // 红
  "#eab308", // 黄
  "#22c55e", // 绿
  "#3b82f6", // 蓝
  "#a855f7", // 紫
  "#06b6d4", // 青
  "#f97316", // 橙
  "#ec4899", // 品红
  "#84cc16", // 黄绿
  "#8b5cf6", // 蓝紫
  "#14b8a6", // 蓝绿
  "#f43f5e", // 玫红
];

export function chartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
