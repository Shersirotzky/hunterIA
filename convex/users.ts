import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createUser = internalMutation({
  args: { method: v.object({ name: v.literal("usernamePassword"), profile: v.object({}) }) },
  returns: v.id("users"),
  handler: async (ctx) => ctx.db.insert("users", { role: "customer", createdAt: Date.now() }),
});

export const createLinkedinUser = internalMutation({
  args: { method: v.object({ name: v.literal("linkedin"), profile: v.object({}) }) },
  returns: v.id("users"),
  handler: async (ctx) => ctx.db.insert("users", { role: "customer", createdAt: Date.now() }),
});

export const importLinkedin = internalMutation({
  args: { userId: v.string(), subject: v.string(), name: v.optional(v.string()), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", args.userId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { linkedinSubject: args.subject, ...(!existing.fullName && args.name ? { fullName: args.name } : {}), ...(!existing.email && args.email ? { email: args.email } : {}), updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("professionalProfiles", {
      ownerUserId: args.userId, linkedinSubject: args.subject, fullName: args.name, email: args.email,
      workHistoryJson: "[]", educationJson: "[]", skillsJson: "[]", languagesJson: "[]", targetRolesJson: "[]", locationsJson: "[]", workModesJson: "[]", salaryJson: "{}", preferredIndustriesJson: "[]", excludedIndustriesJson: "[]", standardAnswersJson: "{}", sourceStatus: "pending_review", createdAt: Date.now(), updatedAt: Date.now(),
    });
  },
});
