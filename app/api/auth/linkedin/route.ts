import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { linkedInRequestOrigin } from "@/lib/linkedinRequest";

const cookieName = "linkedin_oauth_state";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const token = await convexAuthNextjsAccessToken();
    if (!token) return NextResponse.json({ error: "session" }, { status: 401, headers });
    return NextResponse.json(await fetchQuery(api.linkedin.status, {}, { token }), { headers });
  } catch {
    console.warn("[linkedin] status unavailable");
    return NextResponse.json({ error: "backend" }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const origin = linkedInRequestOrigin(request);
  if (!origin || request.headers.get("origin") !== origin) {
    return NextResponse.json({ error: "origin" }, { status: 403, headers });
  }

  const body = await request.json().catch(() => null);
  if (body?.operation !== "connect" && body?.operation !== "disconnect") {
    return NextResponse.json({ error: "request" }, { status: 400, headers });
  }

  try {
    const token = await convexAuthNextjsAccessToken();
    if (!token) return NextResponse.json({ error: "session" }, { status: 401, headers });
    if (body.operation === "disconnect") {
      await fetchMutation(api.linkedin.disconnect, {}, { token });
      const response = NextResponse.json({ expiresAt: null }, { headers });
      response.cookies.delete(cookieName);
      return response;
    }

    const result = await fetchAction(api.linkedinOAuth.start, { origin }, { token });
    if (!result) return NextResponse.json({ error: "configuration" }, { status: 503, headers });
    const response = NextResponse.json({ url: result.url }, { headers });
    response.cookies.set(cookieName, result.state, {
      httpOnly: true, secure: request.nextUrl.protocol === "https:",
      sameSite: "lax", path: "/", maxAge: 600,
    });
    return response;
  } catch {
    console.warn("[linkedin] request to Convex failed");
    return NextResponse.json({ error: "backend" }, { status: 503, headers });
  }
}
