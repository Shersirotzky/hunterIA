import { components, internal } from "./_generated/api";
import { getAuthUserId, setupConvexAuth } from "@convex-dev/auth/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";

const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;
export const { signUpWithUsernamePassword, signInWithUsernamePassword, changePassword } = setupUsernamePassword(auth, {
  component: components.authPassword,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({ createUser: internal.users.createUser });

// The existing password components and user IDs are deliberately preserved.
// Only the Next.js callback can sign these short-lived, one-use assertions.
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { SignInComplete } from "@convex-dev/auth/ssr";
import { verifyLinkedinAssertion } from "./linkedinPolicy";

const linkedin: ReturnType<typeof auth.bindMethod<"linkedin", Record<string, never>>> = auth.bindMethod({ name: "linkedin", createUser: internal.users.createLinkedinUser });
export const signInWithLinkedin = linkedin.authMutation({
  args: { assertion: v.string() },
  handler: async (ctx, { assertion }): Promise<SignInComplete> => {
    const { identity, jti, linking } = await verifyLinkedinAssertion(assertion, process.env.LINKEDIN_BRIDGE_SECRET ?? "");
    const receiptOwner = `oauth:${jti}`;
    if (await ctx.db.query("auditLogs").withIndex("by_owner_created", q => q.eq("ownerUserId", receiptOwner)).first()) throw new ConvexError("EXPIRED_AUTHORIZATION");
    const currentUserId = await getAuthUserId(ctx);
    if (linking && !currentUserId) throw new ConvexError("SIGN_IN_REQUIRED");
    const connection = await ctx.db.query("externalConnections").withIndex("by_provider_subject", q => q.eq("provider", "linkedin")).filter(q => q.eq(q.field("subject"), identity.sub)).unique();
    if (linking && connection && connection.ownerUserId !== currentUserId!) throw new ConvexError("ACCOUNT_CONFLICT");
    if (linking) {
      const previous = await ctx.db.query("externalConnections").filter(q => q.and(q.eq(q.field("ownerUserId"), currentUserId!), q.eq(q.field("provider"), "linkedin"))).unique();
      if (previous && previous.subject !== identity.sub) throw new ConvexError("ACCOUNT_CONFLICT");
    }
    let userId: string | undefined = typeof connection?.ownerUserId === "string" ? connection.ownerUserId : (linking ? currentUserId! : undefined);
    if (!userId && identity.email) {
      const passwordAccount = await ctx.runQuery(components.authUsername.public.getUserIdByUsername, { username: identity.email });
      // Even a verified provider email does not authorize linking an existing account.
      if (passwordAccount) throw new ConvexError("EXISTING_ACCOUNT_SIGN_IN_REQUIRED");
    }
    const tokens = userId
      ? await ctx.convexAuth.completeSignIn({ userId, profile: {}, authenticatedBy: components.auth })
      : await ctx.convexAuth.completeSignUp({ profile: {}, authenticatedBy: components.auth });
    userId = tokens.userId;
    if (!connection) await ctx.db.insert("externalConnections", { ownerUserId: userId, provider: "linkedin", subject: identity.sub, profileJson: JSON.stringify(identity), verifiedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.runMutation(internal.users.importLinkedin, { userId, subject: identity.sub, name: identity.name, email: identity.email });
    await ctx.db.insert("auditLogs", { ownerUserId: receiptOwner, action: "linkedin_assertion_consumed", entityType: "auth", result: "success", createdAt: Date.now(), updatedAt: Date.now() });
    return { status: "complete", tokens };
  },
});
