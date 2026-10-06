import { NextResponse } from "next/server";
import { EDIT_PAGE_USAGE_DAYS, getInstallationDailyUsage, isEditPageDbConfigured, isUuid } from "@/lib/edit-page-db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ installationId: string }> }) {
  const { installationId } = await params;

  if (!isEditPageDbConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  if (!isUuid(installationId)) {
    return NextResponse.json({ error: "invalid_installation_id" }, { status: 400 });
  }

  try {
    const days = await getInstallationDailyUsage(installationId, EDIT_PAGE_USAGE_DAYS);
    return NextResponse.json({ installationId, days });
  } catch (error) {
    console.error("[edit-page] failed to load daily usage", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
