import { NextResponse } from "next/server";
import { getUninstallDetail, isEditPageDbConfigured } from "@/lib/edit-page-db";

export const runtime = "nodejs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 卸载分析：某一天卸载掉的安装明细（点击柱状图的某一天时按需加载） */
export async function GET(request: Request) {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";

  if (!DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getUninstallDetail(date));
  } catch (error) {
    console.error("[edit-page] failed to load uninstall detail", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
