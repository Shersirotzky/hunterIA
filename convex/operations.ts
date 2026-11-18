import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./lib/authz";

export const dashboard = query({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  const settings = await ctx.db.query("ownerSettings").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  const runs = await ctx.db.query("automationRuns").withIndex("by_owner_scheduled", (q) => q.eq("ownerUserId", ownerUserId)).order("desc").take(5);
  const applications = await ctx.db.query("applications").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).order("desc").take(10);
  return { profileStatus: profile?.sourceStatus ?? "missing", settings, runs, applications };
}});

export const ensureSettings = mutation({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  const current = await ctx.db.query("ownerSettings").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  if (current) return current._id;
  const now = Date.now();
  return await ctx.db.insert("ownerSettings", { ownerUserId, timezone: "America/Fortaleza", minimumMatchScore: 85, dailyApplicationLimit: 10, automationsPaused: true, emailMonitoringEnabled: false, pushNotificationsEnabled: false, createdAt: now, updatedAt: now });
}});

export const reserveApplicationSlot = mutation({ args: { jobId: v.id("jobs"), platform: v.string(), dailyBucket: v.string() }, handler: async (ctx, args) => {
  const ownerUserId = await requireOwner(ctx);
  const settings = await ctx.db.query("ownerSettings").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  if (!settings || settings.automationsPaused) throw new Error("Automation paused");
  const duplicate = await ctx.db.query("applications").withIndex("by_owner_job", (q) => q.eq("ownerUserId", ownerUserId).eq("jobId", args.jobId)).unique();
  if (duplicate) throw new Error("Application already exists");
  const todays = await ctx.db.query("applications").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).collect();
  const used = todays.filter((item) => item.dailyBucket === args.dailyBucket && !["cancelled", "failed"].includes(item.status)).length;
  if (used >= settings.dailyApplicationLimit) throw new Error("Daily application limit reached");
  const now = Date.now();
  return await ctx.db.insert("applications", { ownerUserId, jobId: args.jobId, platform: args.platform, dailyBucket: args.dailyBucket, reservedAt: now, status: "preparing", createdAt: now, updatedAt: now });
}});
