import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SignJWT } from "jose";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { writeAuthCookies } from "@convex-dev/auth/ssr";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { exchangeLinkedinCode, oauthCookieOptions, type LinkedinFlow } from "@/lib/linkedin-oauth";

export async function GET(request: NextRequest) {
  let response = NextResponse.redirect(new URL("/signin?authError=provider", request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  try {
    const session = await getIronSession<{ flow?: LinkedinFlow }>(request, response, oauthCookieOptions());
    const flow = session.flow;
    session.destroy();
    const state = request.nextUrl.searchParams.get("state") ?? "";
    if (!flow || Date.now() - flow.startedAt > 600000 || Buffer.byteLength(state) !== Buffer.byteLength(flow.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))) throw new Error("expired");
    if (request.nextUrl.searchParams.has("error")) throw new Error(request.nextUrl.searchParams.get("error") === "access_denied" ? "cancelled" : "provider");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("expired");
    const identity = await exchangeLinkedinCode(code, flow.nonce);
    const secret = process.env.LINKEDIN_BRIDGE_SECRET;
    if (!secret || secret.length < 32) throw new Error("configuration");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const currentToken = await convexAuthNextjsAccessToken();
    if (currentToken) client.setAuth(currentToken);
    if (flow.linkingUser) {
      const current = currentToken ? await client.query(api.identity.current, {}) : null;
      if (current?.userId !== flow.linkingUser) throw new Error("sign_in_required");
    }
    const assertion = await new SignJWT({ identity, linking: !!flow.linkingUser }).setProtectedHeader({ alg: "HS256" }).setIssuer("hunter-linkedin-callback").setAudience("hunter-convex").setJti(randomUUID()).setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));
    const result = await client.mutation(api.auth.signInWithLinkedin, { assertion });
    client.setAuth(result.tokens.accessToken);
    const current = await client.query(api.identity.current, {});
    response = NextResponse.redirect(new URL(current.reviewed ? "/" : "/profile?onboarding=1", request.url));
    await writeAuthCookies({
      get: name => request.cookies.get(name)?.value,
      set: (name, value, options) => { response.cookies.set(name, value, options); },
      delete: name => { response.cookies.delete(name); },
    }, result.tokens, { secure: process.env.NODE_ENV === "production" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const key = message.includes("ACCOUNT_CONFLICT") || message.includes("EXISTING_ACCOUNT_SIGN_IN_REQUIRED") ? "account_conflict" : ["cancelled", "expired", "configuration", "sign_in_required"].includes(message) ? message : "provider";
    response = NextResponse.redirect(new URL(`/signin?authError=${key}`, request.url));
  }
  response.cookies.delete("hunter_linkedin_oauth");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
