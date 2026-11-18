import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { getSessionOptions, type AppSession } from "@/lib/session";

const clientId = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("linkedin_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/?linkedin_error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid LinkedIn OAuth state." }, { status: 400 });
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "LinkedIn OAuth is not configured on the server." },
      { status: 500 },
    );
  }

  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "LinkedIn token exchange failed." }, { status: 502 });
  }

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) {
    return NextResponse.json({ error: "LinkedIn did not return an access token." }, { status: 502 });
  }

  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    return NextResponse.json({ error: "LinkedIn profile request failed." }, { status: 502 });
  }

  const profile = await profileResponse.json();
  const response = NextResponse.redirect(new URL("/signup?linkedin=connected", request.url));
  const session = await getIronSession<AppSession>(request, response, getSessionOptions());
  session.identity = {
    ownerUserId: String(profile.sub),
    name: typeof profile.name === "string" ? profile.name : undefined,
    email: typeof profile.email === "string" ? profile.email : undefined,
    picture: typeof profile.picture === "string" ? profile.picture : undefined,
    connectedAt: Date.now(),
  };
  await session.save();
  response.cookies.delete("linkedin_oauth_state");
  return response;
}
