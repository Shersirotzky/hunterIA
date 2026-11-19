import { createHash, randomBytes } from "node:crypto";
import { fetchAction } from "convex/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { linkedInRequestOrigin } from "@/lib/linkedinRequest";

export async function POST(request: NextRequest) {
  const origin = linkedInRequestOrigin(request);
  if (!origin || request.headers.get("origin") !== origin) return new Response(null, { status: 403 });
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(32).toString("hex");
  const nonce = createHash("sha256").update(verifier).digest("hex");
  try {
    const url = await fetchAction(api.linkedinOAuth.loginUrl, { origin, state, nonce });
    if (!url) return NextResponse.redirect(new URL("/signin?linkedin=configuration", origin), 303);
    const response = NextResponse.redirect(url, 303);
    response.cookies.set("linkedin_signin", state + "." + verifier, {
      path: "/api/auth/linkedin/callback", maxAge: 600, httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/signin?linkedin=provider", origin), 303);
  }
}
