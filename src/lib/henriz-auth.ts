import { createHenrizAuthClient } from "@/lib/henriz-auth-client";

export function henrizSsoEnabled() { return Boolean(process.env.HENRIZ_AUTH_CLIENT_ID && process.env.HENRIZ_AUTH_CLIENT_SECRET && process.env.HENRIZ_AUTH_REDIRECT_URI); }
export function henrizAuth() {
  const clientId = process.env.HENRIZ_AUTH_CLIENT_ID; const clientSecret = process.env.HENRIZ_AUTH_CLIENT_SECRET; const redirectUri = process.env.HENRIZ_AUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Henriz SSO is not configured");
  return createHenrizAuthClient({ baseUrl: process.env.HENRIZ_AUTH_BASE_URL ?? "https://auth.henriz.dev", clientId, clientSecret, redirectUri, transactionCookieName: "__Host-henri_analytics_oauth" });
}
