import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireOwner(ctx: AuthCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

export async function requirePlatformAdmin(ctx: AuthCtx) {
  const subject = await requireOwner(ctx);
  const admin = await ctx.db.query("platformAdmins").withIndex("by_subject", (q) => q.eq("subject", subject)).unique();
  if (!admin) throw new Error("Forbidden");
  return subject;
}
