import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { terms } from "./jobDomain";
import { validEmail } from "./profileDomain";
import { requireOwner } from "./lib/authz";

const profileArgs = {
  linkedinSubject: v.optional(v.string()),
  fullName: v.optional(v.string()),
  email: v.optional(v.string()),
  location: v.optional(v.string()),
  resumeText: v.optional(v.string()),
  resumeName: v.optional(v.string()),
  resumeDocumentId: v.optional(v.id("documents")),
  seniority: v.optional(v.string()),
  yearsExperience: v.optional(v.number()),
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
  const { linkedinSubject: _ignored, ...fields } = args;
  for (const [key, value] of Object.entries(fields)) {
    if (key.endsWith("Json")) JSON.parse(value as string);
  }
  if (fields.resumeDocumentId) {
    const document = await ctx.db.get(fields.resumeDocumentId);
    if (!document || document.ownerUserId !== ownerUserId || document.kind !== "resume") throw new Error("Currículo não encontrado");
  }
  if (fields.yearsExperience !== undefined && (!Number.isFinite(fields.yearsExperience) || fields.yearsExperience < 0 || fields.yearsExperience > 80)) throw new Error("Informe anos de experiência entre 0 e 80");
  if (fields.email && !validEmail(fields.email)) throw new Error("E-mail inválido");
  if ((fields.resumeText?.length ?? 0) > 100000) throw new Error("Currículo excede 100 mil caracteres");
  const data = { ...fields, linkedinSubject: existing?.linkedinSubject ?? ownerUserId, ownerUserId, sourceStatus: "pending_review" as const, updatedAt: now };
  if (existing) { await ctx.db.patch(existing._id, data); return existing._id; }
  return await ctx.db.insert("professionalProfiles", { ...data, createdAt: now });
}});

export const approve = mutation({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  const existing = await ctx.db.query("professionalProfiles").withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId)).unique();
  if (!existing) throw new Error("Profile not found");
  if (!existing.fullName?.trim()) throw new Error("Informe seu nome antes de aprovar");
  if (!terms(existing.targetRolesJson).length) throw new Error("Informe ao menos um cargo desejado antes de aprovar");
  await ctx.db.patch(existing._id, { sourceStatus: "approved", updatedAt: Date.now() });
  return existing._id;
}});
