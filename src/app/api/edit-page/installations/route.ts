import { NextResponse } from "next/server";
import { getFilterOptions, getInstallationSummary, isEditPageDbConfigured, listInstallations } from "@/lib/edit-page-db";

export const runtime = "nodejs";

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
