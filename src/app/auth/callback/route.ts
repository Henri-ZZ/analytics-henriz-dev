import { NextRequest, NextResponse } from "next/server";
import { henrizAuth, henrizSsoEnabled } from "@/lib/henriz-auth";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!henrizSsoEnabled()) return new NextResponse("Henriz SSO is not configured", { status: 503 });
  const auth = henrizAuth();
  const result = await auth.completeLogin({ code: request.nextUrl.searchParams.get("code"), state: request.nextUrl.searchParams.get("state"), transaction: request.cookies.get(auth.transactionCookieName)?.value });
  const cleared = auth.clearTransaction();
  if (!result) {
    const retry = NextResponse.redirect(new URL("/auth/login", request.url));
    retry.cookies.set(cleared.name, cleared.value, cleared.options);
    return retry;
  }
  const response = NextResponse.redirect(new URL(result.returnTo, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(result.claims), sessionCookieOptions);
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
}
