import { createRemoteJWKSet, jwtVerify } from "jose";
import { linkedinIdentity } from "@/convex/linkedinPolicy";

export function linkedinConfig() {
  const mock = process.env.NODE_ENV !== "production" && process.env.LINKEDIN_TEST_PROVIDER === "http://127.0.0.1:4400";
  return {
    authorization: mock ? "http://127.0.0.1:4400/authorize" : "https://www.linkedin.com/oauth/v2/authorization",
    token: mock ? "http://127.0.0.1:4400/token" : "https://www.linkedin.com/oauth/v2/accessToken",
    userinfo: mock ? "http://127.0.0.1:4400/userinfo" : "https://api.linkedin.com/v2/userinfo",
    jwks: mock ? "http://127.0.0.1:4400/jwks" : "https://www.linkedin.com/oauth/openid/jwks",
    issuer: mock ? "http://127.0.0.1:4400" : "https://www.linkedin.com",
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI,
  };
}
export type LinkedinFlow = { state: string; nonce: string; startedAt: number; linkingUser?: string };
export function oauthCookieOptions() {
  const password = process.env.APP_SESSION_SECRET;
  if (!password || password.length < 32) throw new Error("OAuth unavailable");
  return { password, cookieName: "hunter_linkedin_oauth", ttl: 600, cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" } };
}
export async function exchangeLinkedinCode(code: string, nonce: string) {
  const config = linkedinConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) throw new Error("CONFIGURATION");
  const tokenResponse = await fetch(config.token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error("PROVIDER");
  const tokens = await tokenResponse.json();
  if (typeof tokens.id_token !== "string" || typeof tokens.access_token !== "string") throw new Error("PROVIDER");
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(config.jwks)), { issuer: config.issuer, audience: config.clientId, algorithms: ["RS256"] });
  if (payload.nonce !== nonce) throw new Error("INVALID_NONCE");
  const response = await fetch(config.userinfo, { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("PROVIDER");
  const identity = linkedinIdentity.parse(await response.json());
  if (identity.sub !== payload.sub) throw new Error("INVALID_SUBJECT");
  return identity;
}
