import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./lib/authz";

export const currentOwner = internalQuery({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", ownerUserId)).unique();
  if (!profile) throw new Error("Crie seu perfil antes de importar um currículo.");
  return ownerUserId;
}});
export const record = internalMutation({
  args: { storageId: v.id("_storage"), fileName: v.string(), sha256: v.string(), proofId: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    const ownerUserId = await requireOwner(ctx);
    const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", ownerUserId)).unique();
    if (!profile) throw new Error("Perfil não encontrado.");
    const now = Date.now();
    if (now >= args.expiresAt) throw new Error("Prova de importação expirada.");
    const used = await ctx.db.query("auditLogs").withIndex("by_owner_created", q => q.eq("ownerUserId", ownerUserId).gte("createdAt", now - 120_000)).filter(q => q.and(q.eq(q.field("entityType"), "resume_import_proof"), q.eq(q.field("entityId"), args.proofId))).first();
    if (used) throw new Error("Prova de importação já utilizada.");
    const { proofId, expiresAt: _expiresAt, ...document } = args;
    const documentId = await ctx.db.insert("documents", { ownerUserId, kind: "resume", ...document, createdAt: now, updatedAt: now });
    await ctx.db.insert("auditLogs", { ownerUserId, action: "resume.import", entityType: "resume_import_proof", entityId: proofId, result: "success", createdAt: now, updatedAt: now });
    return documentId;
  },
});
export const ownedDocument = internalQuery({ args: { documentId: v.id("documents") }, handler: async (ctx, args) => {
  const ownerUserId = await requireOwner(ctx);
  const document = await ctx.db.get(args.documentId);
  if (!document || document.ownerUserId !== ownerUserId || document.kind !== "resume") return null;
  return document;
}});
export const list = query({ args: {}, handler: async (ctx) => {
  const ownerUserId = await requireOwner(ctx);
  const documents = await ctx.db.query("documents").withIndex("by_owner_kind", q => q.eq("ownerUserId", ownerUserId).eq("kind", "resume")).order("desc").take(50);
  return documents.map(({ _id, fileName, sha256, createdAt }) => ({ documentId: _id, fileName, sha256, createdAt }));
}});
