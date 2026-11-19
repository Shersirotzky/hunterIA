"use node";

import { createHash, randomBytes } from "node:crypto";
import { createLocalJWKSet, errors, jwtVerify } from "jose";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function configuration() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(localhost && url.protocol === "http:"))
      || url.pathname !== "/api/auth/linkedin/callback"
      || url.search || url.hash || url.username || url.password) return null;
    return { clientId, clientSecret, redirectUri, origin: url.origin };
  } catch {
    return null;
  }
}

const hash = (state: string) => createHash("sha256").update(state).digest("hex");

export const start = action({
  args: { origin: v.string() },
  handler: async (ctx, { origin }): Promise<{ url: string; state: string } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");
    const config = configuration();
    if (!config || config.origin !== origin) return null;

    const state = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.linkedin.begin, { ownerUserId: identity.subject, stateHash: hash(state) });
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.search = new URLSearchParams({
      response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri,
      state, scope: "openid",
    }).toString();
    return { url: url.toString(), state };
  },
});

type Outcome = "connected" | "invalid_state" | "cancelled" | "configuration" | "provider" | "expired";

export const complete = action({
  args: { state: v.string(), code: v.optional(v.string()), error: v.optional(v.string()), origin: v.string() },
  handler: async (ctx, { state, code, error, origin }): Promise<Outcome> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");
    if (state.length !== 64 || !/^[a-f0-9]{64}$/.test(state)) return "invalid_state";
    const pending = { ownerUserId: identity.subject, stateHash: hash(state) };
    if (!(await ctx.runMutation(internal.linkedin.consume, pending))) return "invalid_state";
    if (error) {
      if (["access_denied", "user_cancelled_login", "user_cancelled_authorize"].includes(error)) return "cancelled";
      if (["unauthorized_scope_error", "invalid_scope", "unauthorized_client"].includes(error)) return "configuration";
      return "provider";
    }
    if (!code || code.length > 4096) return "provider";
    const config = configuration();
    if (!config || config.origin !== origin) return "configuration";

    const result = await exchange(config, code);
    if (typeof result === "string") return result;
    const { subject, expiresAt } = result;
    const saved = await ctx.runMutation(internal.linkedin.confirm, {
      ...pending, subject, authorizationExpiresAt: expiresAt, grantedScopes: ["openid"],
    });
    return saved ? "connected" : "invalid_state";
  },
});

async function exchange(config: NonNullable<ReturnType<typeof configuration>>, code: string, nonce?: string) {
    let profile: { subject: string; name?: string; email?: string };
    let expiresAt: number;
    try {
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code", code, client_id: config.clientId,
          client_secret: config.clientSecret, redirect_uri: config.redirectUri,
        }),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!tokenResponse.ok) {
        const failure = await tokenResponse.json().catch(() => null);
        if (failure?.error === "invalid_client" || tokenResponse.status === 401) return "configuration";
        if (failure?.error === "invalid_grant") return "expired";
        return "provider";
      }

      const token = await tokenResponse.json();
      if (typeof token.id_token !== "string" || !token.id_token
        || !Number.isSafeInteger(token.expires_in) || token.expires_in <= 0) return "provider";
      expiresAt = Date.now() + token.expires_in * 1000;
      const requested = nonce ? ["openid", "profile", "email"] : ["openid"];
      const scopes: string[] = typeof token.scope === "string" ? token.scope.split(/[\s,]+/) : requested;
      if (!scopes.includes("openid") || scopes.some((scope) => scope && !requested.includes(scope))) return "configuration";

      const keys = await fetch("https://www.linkedin.com/oauth/openid/jwks", {
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!keys.ok) return "provider";
      const { payload } = await jwtVerify(token.id_token, createLocalJWKSet(await keys.json()), {
        issuer: "https://www.linkedin.com",
        audience: config.clientId,
        algorithms: ["RS256"],
        requiredClaims: ["iat", "exp", "sub"],
        maxTokenAge: "10m",
        clockTolerance: 5,
      });
      if (!payload.sub?.trim() || payload.sub.length > 255
        || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) return "provider";
      if (nonce && payload.nonce !== nonce) return "invalid_state";
      profile = { subject: payload.sub };
      if (nonce) {
        if (typeof payload.name === "string") profile.name = payload.name.slice(0, 250);
        if (typeof payload.email === "string") profile.email = payload.email.slice(0, 320);
        if ((!profile.name || !profile.email) && typeof token.access_token === "string") {
          const response = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: "Bearer " + token.access_token }, redirect: "error", signal: AbortSignal.timeout(8000),
          });
          if (response.ok) {
            const info = await response.json();
            if (info.sub !== profile.subject) return "provider";
            if (!profile.name && typeof info.name === "string") profile.name = info.name.slice(0, 250);
            if (!profile.email && typeof info.email === "string") profile.email = info.email.slice(0, 320);
          }
        }
      }
    } catch (error) {
      return error instanceof errors.JWTExpired ? "expired" : "provider";
    }

    if (expiresAt <= Date.now()) return "expired";
    return { ...profile, expiresAt };
}

export const loginUrl = action({
  args: { origin: v.string(), state: v.string(), nonce: v.string() },
  handler: async (_, { origin, state, nonce }) => {
    const config = configuration();
    if (!config || config.origin !== origin || ![state, nonce].every(x => /^[a-f0-9]{64}$/.test(x))) return null;
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId,
      redirect_uri: config.redirectUri, scope: "openid profile email", state, nonce }).toString();
    return url.toString();
  },
});

export const signIn = action({
  args: { origin: v.string(), code: v.string(), verifier: v.string() },
  handler: async (ctx, { origin, code, verifier }): Promise<{ tokens: import("@convex-dev/auth/ssr").TokenBundle } | { error: string }> => {
    const config = configuration();
    if (!config || config.origin !== origin) return { error: "configuration" };
    if (!/^[a-f0-9]{64}$/.test(verifier) || !code || code.length > 4096) return { error: "invalid_state" };
    const profile = await exchange(config, code, hash(verifier));
    if (typeof profile === "string") return { error: profile };
    const { expiresAt, ...identity } = profile;
    const tokens = await ctx.runMutation(internal.career.recordLogin, {
      ...identity, authorizationExpiresAt: expiresAt,
    });
    return { tokens };
  },
});
