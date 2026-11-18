import type { QueryCtx, MutationCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireOwner(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Unauthenticated");
  return identity.subject;
}

export async function requirePlatformAdmin(ctx: AuthCtx) {
  const subject = await requireOwner(ctx);
  const admin = await ctx.db.query("platformAdmins").withIndex("by_subject", (q) => q.eq("subject", subject)).unique();
  if (!admin) throw new Error("Forbidden");
  return subject;
}
