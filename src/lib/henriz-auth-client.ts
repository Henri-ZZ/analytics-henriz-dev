import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type HenrizAuthMethod = "passkey" | "totp" | "bootstrap";
export interface HenrizClaims { sub: string; auth_time: number; auth_method: HenrizAuthMethod; central_session_id: string; issued_at: number }
type AuthCookie = { name: string; value: string; options: { httpOnly: true; secure: true; sameSite: "lax"; path: "/"; maxAge: number } };

function sameString(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export function sanitizeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

export function createHenrizAuthClient(options: { baseUrl: string; clientId: string; clientSecret: string; redirectUri: string; transactionCookieName?: string }) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const transactionCookieName = options.transactionCookieName ?? `__Host-${options.clientId}_oauth`;
  function beginLogin(returnTo: string | null | undefined): { authorizeUrl: string; cookie: AuthCookie } {
    const verifier = randomBytes(64).toString("base64url"); const state = randomBytes(32).toString("base64url");
    const authorizeUrl = new URL(`${baseUrl}/authorize`);
    authorizeUrl.search = new URLSearchParams({ response_type: "code", client_id: options.clientId, redirect_uri: options.redirectUri, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    const transaction = Buffer.from(JSON.stringify({ state, verifier, returnTo: sanitizeReturnTo(returnTo) })).toString("base64url");
    return { authorizeUrl: authorizeUrl.toString(), cookie: { name: transactionCookieName, value: transaction, options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 } } };
  }
  async function completeLogin(input: { code: string | null; state: string | null; transaction: string | undefined }) {
    const { code, state, transaction } = input;
    if (!code || !state || !transaction || !/^[A-Za-z0-9._~-]{32,512}$/.test(state)) return null;
    let parsed: { state?: unknown; verifier?: unknown; returnTo?: unknown };
    try { parsed = JSON.parse(Buffer.from(transaction, "base64url").toString("utf8")); } catch { return null; }
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string" || !sameString(parsed.state, state)) return null;
    try {
      const response = await fetch(`${baseUrl}/api/token`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString("base64")}` }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: options.redirectUri, code_verifier: parsed.verifier }) });
      if (!response.ok) return null;
      const claims = (await response.json()) as Partial<HenrizClaims>;
      if (typeof claims.sub !== "string" || typeof claims.auth_time !== "number" || typeof claims.central_session_id !== "string" || !["passkey", "totp", "bootstrap"].includes(claims.auth_method ?? "")) return null;
      return { claims: claims as HenrizClaims, returnTo: sanitizeReturnTo(typeof parsed.returnTo === "string" ? parsed.returnTo : null) };
    } catch { return null; }
  }
  function clearTransaction(): AuthCookie { return { name: transactionCookieName, value: "", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 } }; }
  return { transactionCookieName, beginLogin, completeLogin, clearTransaction };
}
