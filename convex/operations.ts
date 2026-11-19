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

export const reserveApplicationSlot = mutation({ args: { jobId: v.id("jobs"), platform: v.string(), dailyBucket: v.optional(v.string()) }, handler: async (ctx, args) => {
  const ownerUserId = await requireOwner(ctx);
  const settings = await ctx.db.query("ownerSettings").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  if (!settings || settings.automationsPaused) throw new Error("Automation paused");
  const job = await ctx.db.get(args.jobId);
  if (!job || job.ownerUserId !== ownerUserId || job.status !== "open") throw new Error("Job unavailable");
  const authorization = await ctx.db.query("platformAuthorizations").withIndex("by_owner_platform", q => q.eq("ownerUserId", ownerUserId).eq("platform", args.platform)).unique();
  if (!authorization?.enabled || !authorization.autoSubmit || authorization.paused || !authorization.approvedAt) throw new Error("Platform not authorized");
  const dailyBucket = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const duplicate = await ctx.db.query("applications").withIndex("by_owner_job", (q) => q.eq("ownerUserId", ownerUserId).eq("jobId", args.jobId)).unique();
  if (duplicate) throw new Error("Application already exists");
  const todays = await ctx.db.query("applications").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).collect();
  const used = todays.filter((item) => item.dailyBucket === dailyBucket && !["cancelled", "failed"].includes(item.status)).length;
  if (used >= settings.dailyApplicationLimit) throw new Error("Daily application limit reached");
  const now = Date.now();
  return await ctx.db.insert("applications", { ownerUserId, jobId: args.jobId, platform: args.platform, dailyBucket, reservedAt: now, status: "preparing", createdAt: now, updatedAt: now });
}});
