/**
 * Edit Page 遥测数据的共享类型。
 *
 * 严格对应 edit-page-web 的 Prisma schema（Installation / UsageDaily），
 * 只做类型声明，不含任何运行时代码，因此可以安全地被客户端组件引用。
 */

export type InstallationStatus = "active" | "idle" | "churned" | "uninstalled";

export type InstallationRow = {
  /** Installation.id，数据库自增数字主键 */
  id: number;
  /** Installation.installationId (UUID)，业务标识；不在主表展示，仅在展开面板里给出 */
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
  /** Installation.settings 原始 JSON */
  settings: Record<string, unknown>;
  /** Installation.optionalPermissions 原始 JSON */
  optionalPermissions: Record<string, unknown>;
  /** 由 uninstalledAt / lastSeenAt 与滚动窗口阈值推导 */
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
  /** 当日全部事件次数（各事件计数之和） */
  totalEvents: number;
  /** 当日原始 events 计数，键为事件名 */
  events: Record<string, number>;
};

/** 筛选下拉的候选项，全部从数据库去重查询得到 */
export type FilterOptions = {
  browsers: string[];
  systems: string[];
  /** distribution，分发渠道 */
  channels: string[];
  licenses: string[];
  versions: string[];
};

export type EditPageSummary = {
  total: number;
  active: number;
  idle: number;
  churned: number;
  uninstalled: number;
  /** 近 7 天全部安装的 text.edit 次数 */
  edits7d: number;
  /** 近 7 天全部安装的全部事件次数 */
  events7d: number;
  /** 近 7 天有使用记录的安装数 */
  usedLast7d: number;
};
