import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const clientId = process.env.LINKEDIN_CLIENT_ID;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

export async function GET() {
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "LinkedIn OAuth is not configured on the server." },
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authorizationUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", "openid profile email");

  return NextResponse.redirect(authorizationUrl);
}
