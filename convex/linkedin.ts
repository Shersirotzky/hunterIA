import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/authz";
import { v } from "convex/values";

const lifetimeMs = 10 * 60 * 1000;

function connection(ctx: QueryCtx | MutationCtx, owner: string) {
  return ctx.db.query("externalConnections")
    .withIndex("by_owner_provider", (q) => q.eq("ownerUserId", owner).eq("provider", "linkedin")).unique();
}

function attempt(ctx: MutationCtx, owner: string) {
  return ctx.db.query("linkedInAttempts")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", owner)).unique();
}

export const status = query({
  args: {},
  handler: async (ctx) => {
    const existing = await connection(ctx, await requireOwner(ctx));
    return { expiresAt: existing?.authorizationExpiresAt ?? (existing ? 0 : null) };
  },
});

export const begin = internalMutation({
  args: { ownerUserId: v.string(), stateHash: v.string() },
  handler: async (ctx, args) => {
    const pending = await attempt(ctx, args.ownerUserId);
    const data = { ...args, expiresAt: Date.now() + lifetimeMs, consumed: false };
    if (pending) await ctx.db.replace(pending._id, data);
    else await ctx.db.insert("linkedInAttempts", data);
  },
});

export const consume = internalMutation({
  args: { ownerUserId: v.string(), stateHash: v.string() },
  handler: async (ctx, args) => {
    const pending = await attempt(ctx, args.ownerUserId);
    if (!pending || pending.consumed || pending.expiresAt <= Date.now() || pending.stateHash !== args.stateHash) return false;
    await ctx.db.patch(pending._id, { consumed: true });
    return true;
  },
});

export const confirm = internalMutation({
  args: {
    ownerUserId: v.string(),
    stateHash: v.string(),
    subject: v.string(),
    authorizationExpiresAt: v.number(),
    grantedScopes: v.array(v.string()),
  },
  handler: async (ctx, { stateHash, ...args }) => {
    const pending = await attempt(ctx, args.ownerUserId);
    const now = Date.now();
    if (!pending?.consumed || pending.stateHash !== stateHash || pending.expiresAt <= now) return false;
    const existing = await connection(ctx, args.ownerUserId);
    const data = {
      ...args, provider: "linkedin", profileJson: "{}",
      verifiedAt: now, updatedAt: now, createdAt: existing?.createdAt ?? now,
    };
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("externalConnections", data);
    await ctx.db.delete(pending._id);
    return true;
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const existing = await connection(ctx, owner);
    const pending = await attempt(ctx, owner);
    if (existing) await ctx.db.delete(existing._id);
    if (pending) await ctx.db.delete(pending._id);
  },
});
