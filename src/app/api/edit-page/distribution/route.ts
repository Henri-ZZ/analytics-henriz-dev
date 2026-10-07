import { NextResponse } from "next/server";
import { getInstallationDistribution, isDistributionDimension, isEditPageDbConfigured } from "@/lib/edit-page-db";

export const runtime = "nodejs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

export async function GET(request: Request) {
  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dimension = searchParams.get("dimension") ?? "";
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  if (!isDistributionDimension(dimension)) {
    return NextResponse.json({ error: "invalid_dimension" }, { status: 400 });
  }

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
    return NextResponse.json(await getInstallationDistribution(dimension, start, end));
  } catch (error) {
    console.error("[edit-page] failed to load distribution", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
