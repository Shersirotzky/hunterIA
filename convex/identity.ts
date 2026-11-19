import { query } from "./_generated/server";
import { requireOwner } from "./lib/authz";
export const current = query({ args: {}, handler: async ctx => {
  const userId = await requireOwner(ctx);
  const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", userId)).unique();
  const connection = await ctx.db.query("externalConnections").withIndex("by_owner_provider", q => q.eq("ownerUserId", userId).eq("provider", "linkedin")).unique();
  return { userId, reviewed: profile?.sourceStatus === "approved", linkedinConnected: !!connection };
} });
