import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";

export type LinkedInIdentity = {
  ownerUserId: string;
  name?: string;
  email?: string;
  picture?: string;
  connectedAt: number;
};

export type AppSession = {
  identity?: LinkedInIdentity;
};

export function getSessionOptions() {
  const password = process.env.APP_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("APP_SESSION_SECRET must be configured with at least 32 characters.");
  }

  return {
    password,
    cookieName: "hunter_ia_session",
    ttl: 60 * 60 * 24 * 30,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getAppSession(): Promise<IronSession<AppSession>> {
  return getIronSession<AppSession>(await cookies(), getSessionOptions());
}

/** Supplemental LinkedIn data only. Convex Auth is the application session. */
export async function getLinkedInIdentity() {
  const session = await getAppSession();
  return session.identity ?? null;
}
