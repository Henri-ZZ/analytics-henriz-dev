import { NextResponse } from "next/server";
import {
  deleteInstallations,
  getFilterOptions,
  getInstallationSummary,
  isEditPageDbConfigured,
  listInstallations,
  setInstallationsFiltered,
} from "@/lib/edit-page-db";

export const runtime = "nodejs";

/** 单次最多操作多少个安装，防止误传超大数组 */
const MAX_BATCH_IDS = 200;

/** 破坏性/写操作前的同源校验（会话 Cookie 是 SameSite=Lax，这里是纵深防御） */
function isCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

/** 安装列表 + 筛选候选值 + 顶部汇总，一次查询返回，避免客户端发三个请求 */
export async function GET() {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  try {
    const [rows, options, summary] = await Promise.all([
      listInstallations(),
      getFilterOptions(),
      getInstallationSummary(),
    ]);

    return NextResponse.json({ rows, options, summary });
  } catch (error) {
    console.error("[edit-page] failed to load installations", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}

/**
 * 打上 / 取消「过滤」标记。
 *
 * 过滤是软标记：数据仍在库里，只是不再参与分布分析与事件分析，
 * 也作为硬删除的前置条件（避免手滑直接删数据）。
 */
export async function PATCH(request: Request) {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }
  if (isCrossOrigin(request)) {
    return NextResponse.json({ error: "cross_origin_rejected" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { installationIds?: unknown; filtered?: unknown }
    | null;

  const ids = Array.isArray(body?.installationIds)
    ? body.installationIds.filter((id): id is string => typeof id === "string")
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (ids.length > MAX_BATCH_IDS) {
    return NextResponse.json({ error: "too_many_ids" }, { status: 400 });
  }
  if (typeof body?.filtered !== "boolean") {
    return NextResponse.json({ error: "invalid_filtered" }, { status: 400 });
  }

  try {
    const updated = await setInstallationsFiltered(ids, body.filtered);
    console.warn(`[edit-page] filtered=${body.filtered} updated=${updated} ids=${ids.join(",")}`);
    return NextResponse.json({ updated });
  } catch (error) {
    console.error("[edit-page] failed to update filter flag", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

/**
 * 删除安装及其关联数据（UsageDaily / TelemetryRequest），**不可撤销**。
 *
 * 会连物理删除的原因：产品侧的保留策略本来就是到期物理删除，这里保持一致。
 * 注意副作用：删掉 TelemetryRequest 会一并丢掉 requestId 幂等记录，
 * 客户端若还在重试同一个批次，那批计数会被当成新数据再写一次。
 */
export async function DELETE(request: Request) {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }
  if (isCrossOrigin(request)) {
    return NextResponse.json({ error: "cross_origin_rejected" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { installationIds?: unknown } | null;
  const ids = Array.isArray(body?.installationIds)
    ? body.installationIds.filter((id): id is string => typeof id === "string")
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (ids.length > MAX_BATCH_IDS) {
    return NextResponse.json({ error: "too_many_ids" }, { status: 400 });
  }

  try {
    const result = await deleteInstallations(ids);
    // 审计留痕：破坏性操作至少要在服务端日志里能查到删了什么
    console.warn(
      `[edit-page] deleted installations=${result.installations} usage=${result.usage} requests=${result.requests} ids=${ids.join(",")}`,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[edit-page] failed to delete installations", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
