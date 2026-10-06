/**
 * Edit Page 遥测数据的共享类型。
 *
 * 严格对应 edit-page-web 的 Prisma schema（Installation / UsageDaily），
 * 只做类型声明，不含任何运行时代码，因此可以安全地被客户端组件引用。
 */

export type InstallationStatus = "active" | "idle" | "churned" | "uninstalled";

export type InstallationRow = {
  /** Installation.installationId (UUID)，业务主键 */
  installationId: string;
  firstVersion: string;
  currentVersion: string;
  browser: string;
  browserMajorVersion: number | null;
  os: string;
  locale: string;
  distribution: string;
  /** free | premium */
  licenseType: string;
  /** ISO 8601 字符串 */
  firstSeenAt: string;
  /** ISO 8601 字符串 */
  lastSeenAt: string;
  /** ISO 8601 字符串；null 表示未观测到卸载 */
  uninstalledAt: string | null;
  /** 近 7 天 text.edit 次数 */
  edits7d: number;
  /** 近 7 天有使用记录的天数 */
  activeDays7d: number;
  /** 近 7 天全部事件次数 */
  events7d: number;
  /** 由 uninstalledAt / lastSeenAt 推导 */
  status: InstallationStatus;
  /** 距最近一次使用过去的天数 */
  daysSinceLastSeen: number;
};

export type DailyUsageRow = {
  /** YYYY-MM-DD（UTC 日历日） */
  date: string;
  /** text.edit */
  edits: number;
  /** edit.start */
  editStarts: number;
  /** dashboard.open */
  dashboardOpens: number;
  /** image.replace */
  imageReplaces: number;
  /** 当日全部事件次数 */
  events: number;
};

export type EditPageSummary = {
  total: number;
  active: number;
  idle: number;
  churned: number;
  uninstalled: number;
  edits7d: number;
  events7d: number;
  /** 近 7 天有使用记录的安装数 */
  usedLast7d: number;
};
