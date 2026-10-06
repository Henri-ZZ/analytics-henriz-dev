import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction && process.env.HENRIZ_AUTH_BYPASS === "true") return NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token && (await verifySessionToken(token))) return NextResponse.next();
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/auth|auth/|_next/static|_next/image|favicon.ico).*)"],
};
