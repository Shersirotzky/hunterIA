import { httpCookies, writeAuthCookies } from "@convex-dev/auth/ssr";
import { fetchAction } from "convex/nextjs";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { linkedInRequestOrigin } from "@/lib/linkedinRequest";

const cookieName = "linkedin_oauth_state";
const stateFormat = /^[a-f0-9]{64}$/;

export async function GET(request: NextRequest) {
  function finish(outcome: string, clearCookie = true) {
    const query = new URLSearchParams({ linkedin: outcome });
    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: `/admin?${query}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
    if (clearCookie) response.cookies.delete(cookieName);
    return response;
  }

  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const expectedState = request.cookies.get(cookieName)?.value ?? "";
  const loginCookie = request.cookies.get("linkedin_signin")?.value;
  const [loginState, verifier] = (loginCookie ?? "").split(".");
  if (loginCookie && stateFormat.test(loginState) && state.length === 64 && loginState === state && verifier && stateFormat.test(verifier)) {
    const origin = linkedInRequestOrigin(request);
    if (!origin) return new Response(null, { status: 400 });
    const back = (path: string) => {
      const response = new NextResponse(null, { status: 303, headers: {
        Location: path, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      } });
      response.cookies.set("linkedin_signin", "", { path: "/api/auth/linkedin/callback", maxAge: 0 });
      return response;
    };
    const code = params.get("code");
    const error = params.get("error");
    if (error || !code) {
      const denied = ["access_denied", "user_cancelled_authorize", "user_cancelled_login"].includes(error ?? "");
      return back("/signin?linkedin=" + (denied ? "cancelled" : "provider"));
    }
    try {
      const result = await fetchAction(api.linkedinOAuth.signIn, { origin, verifier, code });
      if ("error" in result) return back("/signin?linkedin=" + encodeURIComponent(result.error));
      const jar = httpCookies(request);
      await writeAuthCookies(jar, result.tokens, { secure: origin.startsWith("https:") });
      const response = back("/profile");
      jar.applyTo(response.headers);
      return response;
    } catch { return back("/signin?linkedin=provider"); }
  }
  if (state.length !== 64 || expectedState.length !== 64
    || !stateFormat.test(state) || !stateFormat.test(expectedState)
    || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) return finish("invalid_state", false);

  const origin = linkedInRequestOrigin(request);
  if (!origin) return finish("configuration");

  try {
    const token = await convexAuthNextjsAccessToken();
    if (!token) return finish("session");
    const code = params.get("code") ?? undefined;
    const error = params.get("error");
    const knownErrors = ["access_denied", "user_cancelled_login", "user_cancelled_authorize",
      "unauthorized_scope_error", "invalid_scope", "unauthorized_client"];
    const result = await fetchAction(api.linkedinOAuth.complete, {
      state, code: code && code.length <= 4096 ? code : undefined,
      error: error ? (knownErrors.includes(error) ? error : "provider_error") : undefined,
      origin,
    }, { token });
    return finish(result);
  } catch {
    console.warn("[linkedin] callback could not reach Convex");
    return finish("backend");
  }
}
