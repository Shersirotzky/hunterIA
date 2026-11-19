import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { linkedinConfig, oauthCookieOptions, type LinkedinFlow } from "@/lib/linkedin-oauth";

export async function GET(request: NextRequest) {
  try {
    const config = linkedinConfig();
    if (!config.clientId || !config.clientSecret || !config.redirectUri || !process.env.LINKEDIN_BRIDGE_SECRET) throw new Error("CONFIGURATION");
    const token = await convexAuthNextjsAccessToken();
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (token) client.setAuth(token);
    const linking = request.nextUrl.searchParams.get("mode") === "connect";
    const current = token ? await client.query(api.identity.current, {}) : null;
    if (linking && !current) return NextResponse.redirect(new URL("/signin?authError=sign_in_required", request.url));
    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");
    const url = new URL(config.authorization);
    url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, scope: "openid profile email", state, nonce }).toString();
    const response = NextResponse.redirect(url);
    const session = await getIronSession<{ flow?: LinkedinFlow }>(request, response, oauthCookieOptions());
    session.flow = { state, nonce, startedAt: Date.now(), ...(current ? { linkingUser: current.userId } : {}) };
    await session.save();
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/signin?authError=configuration", request.url));
  }
}
