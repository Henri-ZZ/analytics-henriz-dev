import { NextRequest, NextResponse } from "next/server";
import { henrizAuth, henrizSsoEnabled } from "@/lib/henriz-auth";

export const runtime = "nodejs";
export function GET(request: NextRequest) {
  if (!henrizSsoEnabled()) return new NextResponse("Henriz SSO is not configured", { status: 503 });
  const { authorizeUrl, cookie } = henrizAuth().beginLogin(request.nextUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
