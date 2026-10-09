import "server-only";
import { neon } from "@neondatabase/serverless";
import { FAST_UNINSTALL_SECONDS } from "@/lib/edit-page-display";
import { displayDaysAgo } from "@/lib/timezone";
import type {
  DailyUsageRow,
  DeletedInstallationsResult,
  DistributionDimension,
  DistributionResult,
  EditPageSummary,
  EventDailyResult,
  FilterOptions,
  InstallationRow,
  InstallationStatus,
  UninstallDailyPoint,
  UninstallDailyResult,
  UninstallDetailResult,
  UninstallDetailRow,
} from "@/lib/edit-page-types";

/** 明细表格默认展示的天数 */
export const EDIT_PAGE_USAGE_DAYS = 30;
/** 一次最多加载多少条安装（超过时页面会提示用筛选缩小范围） */
export const EDIT_PAGE_LIST_LIMIT = 2000;

const DAY_MS = 86_400_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 是否已配置 Edit Page 的 Neon 连接串 */
export function isEditPageDbConfigured() {
  return Boolean(process.env.EDIT_PAGE_DATABASE_URL);
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

let cachedClient: ReturnType<typeof neon> | null = null;

function db() {
  const url = process.env.EDIT_PAGE_DATABASE_URL;
  if (!url) throw new Error("EDIT_PAGE_DATABASE_URL is not configured");
  cachedClient ??= neon(url);
  return cachedClient;
}

type RawInstallation = Omit<InstallationRow, "status" | "daysSinceLastSeen">;

type StatusCutoffs = { activeCutoff: string; churnCutoff: string };

/** 生成秒精度 ISO 串，与 SQL 里 to_char(..., 'YYYY-MM-DD"T"HH24:MI:SS"Z"') 的格式保持一致 */
function isoSecond(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * 状态阈值：以当前时刻为基准的滚动窗口。
 * 同一组 cutoff 会同时用于 JS 推导和 SQL 汇总，保证两处口径一致。
 */
function statusCutoffs(): StatusCutoffs {
  const now = Date.now();
  return {
    activeCutoff: isoSecond(new Date(now - 7 * DAY_MS)),
    churnCutoff: isoSecond(new Date(now - 30 * DAY_MS)),
  };
}

function deriveStatus(uninstalledAt: string | null, lastSeenAt: string, cutoffs: StatusCutoffs): InstallationStatus {
  if (uninstalledAt) return "uninstalled";
  if (lastSeenAt >= cutoffs.activeCutoff) return "active";
  if (lastSeenAt >= cutoffs.churnCutoff) return "idle";
  return "churned";
}

/** 安装列表：基础信息 + 推导状态，按最近活跃倒序 */
export async function listInstallations(limit = EDIT_PAGE_LIST_LIMIT): Promise<InstallationRow[]> {
  const sql = db();
  const cutoffs = statusCutoffs();

  const rows = (await sql`
    SELECT
      i."id",
      -- 稠密序号：按 id 升序全局编号，最老的安装是 1。
      -- 窗口函数在 ORDER BY / LIMIT 之前计算，所以即使列表被截断，序号仍是真实全局序号。
      (ROW_NUMBER() OVER (ORDER BY i."id"))::int AS "seq",
      i."installationId"::text AS "installationId",
      i."firstVersion",
      i."currentVersion",
      i."browser",
      i."browserMajorVersion",
      i."os",
      i."locale",
      i."distribution",
      i."licenseType",
      i."settings",
      i."optionalPermissions",
      to_char(i."firstSeenAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "firstSeenAt",
      to_char(i."lastSeenAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "lastSeenAt",
      CASE
        WHEN i."uninstalledAt" IS NULL THEN NULL
        ELSE to_char(i."uninstalledAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      END AS "uninstalledAt",
      CASE
        WHEN i."filteredAt" IS NULL THEN NULL
        ELSE to_char(i."filteredAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      END AS "filteredAt"
    FROM "Installation" i
    ORDER BY i."lastSeenAt" DESC
    LIMIT ${limit}
  `) as unknown as RawInstallation[];

  return rows.map((row) => ({
    ...row,
    status: deriveStatus(row.uninstalledAt, row.lastSeenAt, cutoffs),
    daysSinceLastSeen: displayDaysAgo(row.lastSeenAt),
  }));
}

/** 筛选下拉候选：浏览器 / 操作系统 / 授权 / 版本，各自全量去重 */
export async function getFilterOptions(): Promise<FilterOptions> {
  const sql = db();

  const [row] = (await sql`
    SELECT
      ARRAY(SELECT DISTINCT "browser" FROM "Installation") AS "browsers",
      ARRAY(SELECT DISTINCT "os" FROM "Installation") AS "systems",
      ARRAY(SELECT DISTINCT "distribution" FROM "Installation") AS "channels",
      ARRAY(SELECT DISTINCT "licenseType" FROM "Installation") AS "licenses",
      ARRAY(SELECT DISTINCT "currentVersion" FROM "Installation") AS "versions"
  `) as unknown as [
    { browsers: string[]; systems: string[]; channels: string[]; licenses: string[]; versions: string[] },
  ];

  return {
    // DISTINCT 的返回顺序是不确定的，统一排一下，避免下拉选项每次刷新都在变
    browsers: [...(row.browsers ?? [])].sort(),
    systems: [...(row.systems ?? [])].sort(),
    channels: [...(row.channels ?? [])].sort(),
    licenses: [...(row.licenses ?? [])].sort(),
    // 版本号按语义排序（2.10.0 排在 2.2.2 之前），而不是纯字典序
    versions: [...(row.versions ?? [])].sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }),
    ),
  };
}

/** 顶部指标：不受表格筛选影响的全量概览 */
export async function getInstallationSummary(): Promise<EditPageSummary> {
  const sql = db();
  const { activeCutoff, churnCutoff } = statusCutoffs();

  const [row] = (await sql`
    SELECT
      (SELECT COUNT(*) FROM "Installation")::int AS "total",
      (SELECT COUNT(*) FROM "Installation" WHERE "filteredAt" IS NOT NULL)::int AS "filtered",
      (SELECT COUNT(*) FROM "Installation" WHERE "uninstalledAt" IS NOT NULL)::int AS "uninstalled",
      (
        SELECT COUNT(*) FROM "Installation"
        WHERE "uninstalledAt" IS NULL AND "lastSeenAt" >= ${activeCutoff}::timestamptz
      )::int AS "active",
      (
        SELECT COUNT(*) FROM "Installation"
        WHERE "uninstalledAt" IS NULL
          AND "lastSeenAt" >= ${churnCutoff}::timestamptz
          AND "lastSeenAt" < ${activeCutoff}::timestamptz
      )::int AS "idle",
      (
        SELECT COUNT(*) FROM "Installation"
        WHERE "uninstalledAt" IS NULL AND "lastSeenAt" < ${churnCutoff}::timestamptz
      )::int AS "churned",
      (
        SELECT COALESCE(SUM(
          CASE WHEN COALESCE("events" ->> 'text.edit', '') ~ '^[0-9]+$' THEN ("events" ->> 'text.edit')::bigint ELSE 0 END
        ), 0)
        FROM "UsageDaily"
        WHERE "date" >= CURRENT_DATE - 6
      )::int AS "edits7d",
      (
        SELECT COALESCE(SUM(
          CASE WHEN v.value ~ '^[0-9]+$' THEN v.value::bigint ELSE 0 END
        ), 0)
        FROM "UsageDaily" ud, jsonb_each_text(ud."events") AS v(key, value)
        WHERE ud."date" >= CURRENT_DATE - 6
      )::int AS "events7d",
      (
        SELECT COUNT(DISTINCT "installationId") FROM "UsageDaily" WHERE "date" >= CURRENT_DATE - 6
      )::int AS "usedLast7d"
  `) as unknown as [EditPageSummary];

  return row;
}

export const DISTRIBUTION_DIMENSIONS: DistributionDimension[] = [
  "browser",
  "os",
  "locale",
  "distribution",
  "licenseType",
  "currentVersion",
  "status",
];

export function isDistributionDimension(value: string): value is DistributionDimension {
  return (DISTRIBUTION_DIMENSIONS as string[]).includes(value);
}

/**
 * 分布分析：统计「所选时间范围内有使用记录」的安装，按指定维度分组。
 *
 * 口径说明：时间范围筛的是 UsageDaily 里有行（即当天有上报）的安装；
 * 维度取值来自 Installation 上的属性，其中 status 的当前状态是相对「现在」推导的
 * （所以区间越近，status 里「活跃」的占比越高，这是符合定义的）。
 */
export async function getInstallationDistribution(
  dimension: DistributionDimension,
  start: string,
  end: string,
): Promise<DistributionResult> {
  const sql = db();
  const { activeCutoff, churnCutoff } = statusCutoffs();

  const rows = (await sql`
    WITH scoped AS (
      SELECT
        i."browser",
        i."os",
        i."locale",
        i."distribution",
        i."licenseType",
        i."currentVersion",
        CASE
          WHEN i."uninstalledAt" IS NOT NULL THEN 'uninstalled'
          WHEN i."lastSeenAt" >= ${activeCutoff}::timestamptz THEN 'active'
          WHEN i."lastSeenAt" >= ${churnCutoff}::timestamptz THEN 'idle'
          ELSE 'churned'
        END AS "status"
      FROM "Installation" i
      WHERE i."filteredAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM "UsageDaily" ud
          WHERE ud."installationId" = i."installationId"
            AND ud."date" >= ${start}::date
            AND ud."date" <= ${end}::date
        )
    )
    SELECT
      CASE ${dimension}::text
        WHEN 'browser' THEN "browser"
        WHEN 'os' THEN "os"
        WHEN 'locale' THEN "locale"
        WHEN 'distribution' THEN "distribution"
        WHEN 'licenseType' THEN "licenseType"
        WHEN 'currentVersion' THEN "currentVersion"
        ELSE "status"
      END AS "value",
      COUNT(*)::int AS "count"
    FROM scoped
    GROUP BY 1
    ORDER BY 2 DESC, 1 ASC
  `) as unknown as { value: string; count: number }[];

  return {
    dimension,
    start,
    end,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    items: rows,
  };
}

/**
 * 打上 / 取消「过滤」标记。
 *
 * filteredAt 非空即"已过滤"，所以取消过滤就是写回 NULL。
 * WHERE 里带了状态条件，所以只更新真正需要变的行，返回值是"实际改动行数"——
 * 对同一批重复点标记不会虚增计数。
 */
export async function setInstallationsFiltered(installationIds: string[], filtered: boolean): Promise<number> {
  const ids = [...new Set(installationIds.filter(isUuid))];
  if (ids.length === 0) return 0;

  const sql = db();
  const rows = (filtered
    ? await sql`
        UPDATE "Installation" SET "filteredAt" = now()
        WHERE "installationId" = ANY(${ids}::uuid[]) AND "filteredAt" IS NULL
        RETURNING 1
      `
    : await sql`
        UPDATE "Installation" SET "filteredAt" = NULL
        WHERE "installationId" = ANY(${ids}::uuid[]) AND "filteredAt" IS NOT NULL
        RETURNING 1
      `) as unknown as unknown[];

  return rows.length;
}

/**
 * 物理删除安装及其关联数据。
 *
 * UsageDaily / TelemetryRequest 的外键本来就是 ON DELETE CASCADE，
 * 但这里仍按「先子后父」显式删除：一是不依赖外键定义，二是能拿到各表真实的删除行数用于回显。
 * 三条语句放在一个事务里，避免出现「子表删了、父表没删」的中间态。
 */
export async function deleteInstallations(installationIds: string[]): Promise<DeletedInstallationsResult> {
  const ids = [...new Set(installationIds.filter(isUuid))];
  if (ids.length === 0) return { installations: 0, usage: 0, requests: 0 };

  const sql = db();
  const [usage, requests, installations] = (await sql.transaction([
    sql`DELETE FROM "UsageDaily" WHERE "installationId" = ANY(${ids}::uuid[]) RETURNING 1`,
    sql`DELETE FROM "TelemetryRequest" WHERE "installationId" = ANY(${ids}::uuid[]) RETURNING 1`,
    sql`DELETE FROM "Installation" WHERE "installationId" = ANY(${ids}::uuid[]) RETURNING 1`,
  ])) as unknown as [unknown[], unknown[], unknown[]];

  return { installations: installations.length, usage: usage.length, requests: requests.length };
}

/** 单个安装近 N 天的每日使用明细 */
export async function getInstallationDailyUsage(installationId: string, days = EDIT_PAGE_USAGE_DAYS): Promise<DailyUsageRow[]> {
  if (!isUuid(installationId)) return [];

  const sql = db();
  return (await sql`
    SELECT
      to_char(ud."date", 'YYYY-MM-DD') AS "date",
      (CASE WHEN COALESCE(ud."events" ->> 'text.edit', '') ~ '^[0-9]+$' THEN (ud."events" ->> 'text.edit')::bigint ELSE 0 END)::int AS "edits",
      (CASE WHEN COALESCE(ud."events" ->> 'edit.start', '') ~ '^[0-9]+$' THEN (ud."events" ->> 'edit.start')::bigint ELSE 0 END)::int AS "editStarts",
      (CASE WHEN COALESCE(ud."events" ->> 'dashboard.open', '') ~ '^[0-9]+$' THEN (ud."events" ->> 'dashboard.open')::bigint ELSE 0 END)::int AS "dashboardOpens",
      (CASE WHEN COALESCE(ud."events" ->> 'image.replace', '') ~ '^[0-9]+$' THEN (ud."events" ->> 'image.replace')::bigint ELSE 0 END)::int AS "imageReplaces",
      COALESCE(
        (
          SELECT SUM(CASE WHEN value ~ '^[0-9]+$' THEN value::bigint ELSE 0 END)
          FROM jsonb_each_text(ud."events")
        ),
        0
      )::int AS "totalEvents",
      ud."events" AS "events"
    FROM "UsageDaily" ud
    WHERE ud."installationId" = ${installationId}::uuid
      AND ud."date" >= CURRENT_DATE - (${days}::int - 1)
    ORDER BY ud."date" DESC
  `) as unknown as DailyUsageRow[];
}

/**
 * 事件分析：给定事件键与日期区间（闭区间），返回逐日数值。
 * 用 generate_series 生成连续日期，缺数据的日子补 0，方便直接画折线图。
 *
 * unique = true 时按「去重安装数」统计（同一天同一安装只算 1 次），
 * 否则统计事件计数之和。
 */
export async function getEventDailyCounts(
  keys: string[],
  start: string,
  end: string,
  unique = false,
): Promise<EventDailyResult> {
  const sql = db();
  const rows = (await sql`
    WITH days AS (
      SELECT generate_series(${start}::date, ${end}::date, interval '1 day')::date AS day
    ),
    selected AS (
      SELECT unnest(string_to_array(${keys.join(",")}, ',')) AS key
    )
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS "date",
      s.key AS "key",
      COALESCE((
        SELECT CASE
          WHEN ${unique}::boolean THEN COUNT(DISTINCT ud."installationId")
          ELSE SUM(CASE WHEN e.value ~ '^[0-9]+$' THEN e.value::bigint ELSE 0 END)
        END
        FROM "UsageDaily" ud, jsonb_each_text(ud."events") AS e(key, value)
        WHERE ud."date" = d.day AND e.key = s.key
          AND NOT EXISTS (
            SELECT 1 FROM "Installation" i
            WHERE i."installationId" = ud."installationId" AND i."filteredAt" IS NOT NULL
          )
      ), 0)::int AS "count"
    FROM days d
    CROSS JOIN selected s
    ORDER BY d.day, s.key
  `) as unknown as { date: string; key: string; count: number }[];

  const dates: string[] = [];
  const countsByKey = new Map<string, number[]>(keys.map((key) => [key, []]));
  let cursor = "";

  for (const row of rows) {
    if (row.date !== cursor) {
      cursor = row.date;
      dates.push(row.date);
    }
    countsByKey.get(row.key)?.push(row.count);
  }

  return {
    days: dates.length,
    start,
    end,
    unique,
    dates,
    series: keys.map((key) => {
      const counts = countsByKey.get(key) ?? [];
      return { key, counts, total: counts.reduce((sum, value) => sum + value, 0) };
    }),
  };
}

/**
 * 卸载分析：按展示时区（UTC+8）的日历日，统计每日新增安装、卸载数、快速卸载数。
 *
 * 两个口径说明：
 * 1. 日轴是 firstSeenAt / uninstalledAt 换算到 UTC+8 后的自然日，
 *    **不是** UsageDaily.date 那套「客户端按 UTC 上报的日历日」——这里统计的是服务端瞬时刻，
 *    所以和事件页、分布页的时间轴口径不同，别混着对；
 * 2. 已打过滤标的安装全部排除，与分布分析、事件分析保持一致。
 */
export async function getUninstallDaily(start: string, end: string): Promise<UninstallDailyResult> {
  const sql = db();

  const days = (await sql`
    WITH days AS (
      SELECT generate_series(${start}::date, ${end}::date, interval '1 day')::date AS day
    )
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS "date",
      (
        SELECT COUNT(*) FROM "Installation" i
        WHERE i."filteredAt" IS NULL
          AND (i."firstSeenAt" AT TIME ZONE 'Asia/Shanghai')::date = d.day
      )::int AS "installs",
      (
        SELECT COUNT(*) FROM "Installation" i
        WHERE i."filteredAt" IS NULL
          AND i."uninstalledAt" IS NOT NULL
          AND (i."uninstalledAt" AT TIME ZONE 'Asia/Shanghai')::date = d.day
      )::int AS "uninstalls",
      (
        SELECT COUNT(*) FROM "Installation" i
        WHERE i."filteredAt" IS NULL
          AND i."uninstalledAt" IS NOT NULL
          AND (i."uninstalledAt" AT TIME ZONE 'Asia/Shanghai')::date = d.day
          AND i."uninstalledAt" - i."firstSeenAt" <= make_interval(secs => ${FAST_UNINSTALL_SECONDS}::int)
      )::int AS "fastUninstalls"
    FROM days d
    ORDER BY d.day
  `) as unknown as UninstallDailyPoint[];

  return { start, end, days };
}

/**
 * 卸载分析：某一天（展示时区的日历日）卸载掉的安装明细。
 * 按存活时长升序，装完马上就走的排在最前面。
 */
export async function getUninstallDetail(date: string): Promise<UninstallDetailResult> {
  const sql = db();

  const rows = (await sql`
    WITH ranked AS (
      SELECT "installationId", (ROW_NUMBER() OVER (ORDER BY "id"))::int AS "seq"
      FROM "Installation"
    )
    SELECT
      i."installationId"::text AS "installationId",
      r."seq",
      to_char(i."firstSeenAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "firstSeenAt",
      to_char(i."uninstalledAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "uninstalledAt",
      ROUND(EXTRACT(EPOCH FROM (i."uninstalledAt" - i."firstSeenAt")))::int AS "survivalSeconds",
      (i."uninstalledAt" - i."firstSeenAt" <= make_interval(secs => ${FAST_UNINSTALL_SECONDS}::int)) AS "fast",
      i."currentVersion",
      i."distribution",
      i."browser",
      i."browserMajorVersion",
      i."os",
      i."locale",
      i."licenseType"
    FROM "Installation" i
    JOIN ranked r ON r."installationId" = i."installationId"
    WHERE i."filteredAt" IS NULL
      AND i."uninstalledAt" IS NOT NULL
      AND (i."uninstalledAt" AT TIME ZONE 'Asia/Shanghai')::date = ${date}::date
    ORDER BY "survivalSeconds" ASC, i."id" ASC
  `) as unknown as UninstallDetailRow[];

  return { date, rows };
}
