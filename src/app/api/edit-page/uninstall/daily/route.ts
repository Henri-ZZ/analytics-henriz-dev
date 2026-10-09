import { NextResponse } from "next/server";
import { getUninstallDaily, isEditPageDbConfigured } from "@/lib/edit-page-db";

export const runtime = "nodejs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

/** 卸载分析：逐日的新增安装 / 卸载 / 快速卸载数量（按展示时区的日历日） */
export async function GET(request: Request) {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  if ((endMs - startMs) / DAY_MS + 1 > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "range_too_long" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getUninstallDaily(start, end));
  } catch (error) {
    console.error("[edit-page] failed to load uninstall trend", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
