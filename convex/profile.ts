import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./lib/authz";

const profileArgs = {
  linkedinSubject: v.string(),
  fullName: v.optional(v.string()),
  headline: v.optional(v.string()),
  summary: v.optional(v.string()),
  workHistoryJson: v.string(),
  educationJson: v.string(),
  skillsJson: v.string(),
  languagesJson: v.string(),
  targetRolesJson: v.string(),
  locationsJson: v.string(),
  workModesJson: v.string(),
  salaryJson: v.string(),
  workAuthorization: v.optional(v.string()),
  preferredIndustriesJson: v.string(),
  excludedIndustriesJson: v.string(),
  standardAnswersJson: v.string(),
};

export const get = query({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  return await ctx.db.query("professionalProfiles").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
}});

export const save = mutation({ args: profileArgs, handler: async (ctx, args) => {
  const ownerUserId = await requireOwner(ctx);
  const now = Date.now();
  const existing = await ctx.db.query("professionalProfiles").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  const data = { ...args, ownerUserId, sourceStatus: "pending_review" as const, updatedAt: now };
  if (existing) { await ctx.db.patch(existing._id, data); return existing._id; }
  return await ctx.db.insert("professionalProfiles", { ...data, createdAt: now });
}});

export const approve = mutation({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  const existing = await ctx.db.query("professionalProfiles").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  if (!existing) throw new Error("Profile not found");
  await ctx.db.patch(existing._id, { sourceStatus: "approved", updatedAt: Date.now() });
  return existing._id;
}});
