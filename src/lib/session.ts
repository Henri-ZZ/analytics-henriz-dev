import { SignJWT, jwtVerify } from "jose";
import type { HenrizClaims } from "@/lib/henriz-auth-client";

export const SESSION_COOKIE_NAME = "__Host-henri_analytics_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;
function secret() { const value = process.env.AUTH_JWT_SECRET; if (!value || value.length < 32) throw new Error("AUTH_JWT_SECRET must be at least 32 characters"); return new TextEncoder().encode(value); }
export async function createSessionToken(claims: HenrizClaims) { return new SignJWT({ authMethod: claims.auth_method, authTime: claims.auth_time }).setProtectedHeader({ alg: "HS256" }).setSubject(claims.sub).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE}s`).sign(secret()); }
export async function verifySessionToken(token: string) { try { const { payload } = await jwtVerify(token, secret()); return typeof payload.sub === "string" ? payload : null; } catch { return null; } }
export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_MAX_AGE };
