import "server-only";
import { neon } from "@neondatabase/serverless";
import type {
  DailyUsageRow,
  EditPageSummary,
  FilterOptions,
  InstallationRow,
  InstallationStatus,
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

function daysSince(iso: string) {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS));
}

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
      END AS "uninstalledAt"
    FROM "Installation" i
    ORDER BY i."lastSeenAt" DESC
    LIMIT ${limit}
  `) as unknown as RawInstallation[];

  return rows.map((row) => ({
    ...row,
    status: deriveStatus(row.uninstalledAt, row.lastSeenAt, cutoffs),
    daysSinceLastSeen: daysSince(row.lastSeenAt),
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
