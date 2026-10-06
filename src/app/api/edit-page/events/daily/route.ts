import { NextResponse } from "next/server";
import { getEventDailyCounts, isEditPageDbConfigured } from "@/lib/edit-page-db";
import { EDIT_PAGE_COUNTER_KEY_SET } from "@/lib/edit-page-events";

export const runtime = "nodejs";

const MAX_KEYS = 12;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);

  // 只接受已知的事件键，避免任意字符串进入查询
  const keys = (searchParams.get("keys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => EDIT_PAGE_COUNTER_KEY_SET.has(key))
    .slice(0, MAX_KEYS);

  if (keys.length === 0) {
    return NextResponse.json({ error: "no_valid_keys" }, { status: 400 });
  }

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

  const unique = searchParams.get("unique") === "1";

  try {
    const result = await getEventDailyCounts(keys, start, end, unique);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[edit-page] failed to load event daily counts", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
