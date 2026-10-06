import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export function GET() {
  const authUrl = new URL("/logout", process.env.HENRIZ_AUTH_BASE_URL ?? "https://auth.henriz.dev");
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
