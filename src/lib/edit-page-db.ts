import "server-only";
import { neon } from "@neondatabase/serverless";
import type { DailyUsageRow, EditPageSummary, InstallationRow, InstallationStatus } from "@/lib/edit-page-types";

/** 明细表格默认展示的天数 */
export const EDIT_PAGE_USAGE_DAYS = 30;
/** 列表一次最多取多少条安装 */
export const EDIT_PAGE_LIST_LIMIT = 500;

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

function daysSince(iso: string) {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function deriveStatus(uninstalledAt: string | null, lastSeenAt: string): InstallationStatus {
  if (uninstalledAt) return "uninstalled";
  const days = daysSince(lastSeenAt);
  if (days <= 7) return "active";
  if (days <= 30) return "idle";
  return "churned";
}

/** 列表查询：安装基础信息 + 近 7 天聚合 */
export async function listInstallations(limit = EDIT_PAGE_LIST_LIMIT): Promise<InstallationRow[]> {
  const sql = db();
  const rows = (await sql`
    SELECT
      i."installationId"::text AS "installationId",
      i."firstVersion",
      i."currentVersion",
      i."browser",
      i."browserMajorVersion",
      i."os",
      i."locale",
      i."distribution",
      i."licenseType",
      to_char(i."firstSeenAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "firstSeenAt",
      to_char(i."lastSeenAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "lastSeenAt",
      CASE
        WHEN i."uninstalledAt" IS NULL THEN NULL
        ELSE to_char(i."uninstalledAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      END AS "uninstalledAt",
      COALESCE(agg."edits7d", 0)::int AS "edits7d",
      COALESCE(agg."activeDays7d", 0)::int AS "activeDays7d",
      COALESCE(agg."events7d", 0)::int AS "events7d"
    FROM "Installation" i
    LEFT JOIN (
      SELECT
        ud."installationId",
        SUM(
          CASE
            WHEN COALESCE(ud."events" ->> 'text.edit', '') ~ '^[0-9]+$'
            THEN (ud."events" ->> 'text.edit')::bigint
            ELSE 0
          END
        ) AS "edits7d",
        COUNT(*)::int AS "activeDays7d",
        SUM(
          COALESCE(
            (
              SELECT SUM(CASE WHEN value ~ '^[0-9]+$' THEN value::bigint ELSE 0 END)
              FROM jsonb_each_text(ud."events")
            ),
            0
          )
        ) AS "events7d"
      FROM "UsageDaily" ud
      WHERE ud."date" >= CURRENT_DATE - 6
      GROUP BY ud."installationId"
    ) agg ON agg."installationId" = i."installationId"
    ORDER BY i."lastSeenAt" DESC
    LIMIT ${limit}
  `) as unknown as RawInstallation[];

  return rows.map((row) => ({
    ...row,
    status: deriveStatus(row.uninstalledAt, row.lastSeenAt),
    daysSinceLastSeen: daysSince(row.lastSeenAt),
  }));
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
      )::int AS "events"
    FROM "UsageDaily" ud
    WHERE ud."installationId" = ${installationId}::uuid
      AND ud."date" >= CURRENT_DATE - (${days}::int - 1)
    ORDER BY ud."date" DESC
  `) as unknown as DailyUsageRow[];
}

export function summarizeInstallations(list: InstallationRow[]): EditPageSummary {
  return {
    total: list.length,
    active: list.filter((item) => item.status === "active").length,
    idle: list.filter((item) => item.status === "idle").length,
    churned: list.filter((item) => item.status === "churned").length,
    uninstalled: list.filter((item) => item.status === "uninstalled").length,
    edits7d: list.reduce((total, item) => total + item.edits7d, 0),
    events7d: list.reduce((total, item) => total + item.events7d, 0),
    usedLast7d: list.filter((item) => item.activeDays7d > 0).length,
  };
}
