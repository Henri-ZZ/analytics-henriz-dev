import type { DistributionDimension, InstallationStatus } from "@/lib/edit-page-types";

/**
 * Edit Page 各分析页共用的展示常量与文案映射。
 * 无外部依赖、无副作用，服务端与客户端都可安全引用。
 */

/**
 * 「快速卸载」阈值：安装到卸载之间存活不超过这个秒数，就算装完马上就走。
 * UI 上的分界文案与 SQL 里的过滤共用这一个常量。
 */
export const FAST_UNINSTALL_SECONDS = 5 * 60;

/** 「快速卸载」的展示名；图表图例、明细标签、口径说明共用，避免各处写法不一致 */
export const FAST_UNINSTALL_LABEL = "快速卸载";

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

/**
 * 语言标签翻中文名，用 CLDR（Intl.DisplayNames）而不是手写字典，
 * 好处是长尾 locale（en-AU、es-AR…）不会漏，也不用维护映射表。
 *
 * 两个前提是安全的：
 * 1. 只在客户端拿到数据后渲染时才调用（列表/图表都是先 idle、点查询才有数据），
 *    不参与 SSR，所以不存在服务端与浏览器 ICU 版本差异导致的 hydration 不一致；
 * 2. 运行时若没有 Intl.DisplayNames 或查不到，退回原始标签，不会抛错。
 */
const displayNamesCache: Partial<Record<"language" | "region" | "script", Intl.DisplayNames | null>> = {};

function lookupDisplayName(kind: "language" | "region" | "script", code: string) {
  if (!(kind in displayNamesCache)) {
    try {
      displayNamesCache[kind] = new Intl.DisplayNames(["zh-CN"], { type: kind });
    } catch {
      displayNamesCache[kind] = null;
    }
  }

  const names = displayNamesCache[kind];
  if (!names) return undefined;

  try {
    const name = names.of(code);
    // 查不到时 DisplayNames 会把传入的 code 原样返回，这种情况当作未知处理
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

/** BCP-47 语言标签 → 中文展示名：en-US → 英语（美国）、zh-CN → 简体中文 */
export function localeLabel(value: string) {
  const tag = (value ?? "").trim();
  if (!tag || tag === "und") return "未知";

  const [language, ...rest] = tag.split("-");
  // 4 位子标签是文字系统（Hans/Hant），2 位字母或 3 位数字是地区
  const script = rest.find((part) => part.length === 4);
  const region = rest.find((part) => part.length === 2 || /^\d{3}$/.test(part));

  if (language === "zh") {
    // CLDR 只会给出「中文（中国）」，中文语境下按简繁区分更有用
    if (script === "Hant" || region === "TW" || region === "HK" || region === "MO") return "繁体中文";
    if (script === "Hans" || region === "CN" || region === "SG" || region === "MY") return "简体中文";
    return "中文";
  }

  const base = lookupDisplayName("language", language);
  if (!base) return tag;

  const detail = script ? lookupDisplayName("script", script) : region ? lookupDisplayName("region", region) : undefined;
  return detail ? `${base}（${detail}）` : base;
}

export const DISTRIBUTION_DIMENSION_OPTIONS: { value: DistributionDimension; label: string }[] = [
  { value: "browser", label: "浏览器" },
  { value: "os", label: "操作系统" },
  { value: "locale", label: "浏览器语言" },
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
    // 浏览器语言刻意不翻译：图表上用原始代码更紧凑，中文名放进 tooltip（见下方 dimensionTooltipLabel）
    case "licenseType":
      return licenseLabel(value);
    case "status":
      return statusLabel(value);
    default:
      return value;
  }
}

/** 语言展示对：原始代码 / 中文名。未知标签会回退成原值，这时只显示一次，避免 "xx-YY / xx-YY" */
export function localePairLabel(value: string) {
  const label = localeLabel(value);
  return label === value ? value : `${value} / ${label}`;
}

/**
 * tooltip 可以比图表标签更详细。
 * 目前只有语言需要：图表上显示 en-US，tooltip 显示 en-US / 英语（美国）。
 * 其他维度没有额外信息，返回 undefined，让图表回退用 label。
 */
export function dimensionTooltipLabel(dimension: DistributionDimension, value: string) {
  return dimension === "locale" ? localePairLabel(value) : undefined;
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
