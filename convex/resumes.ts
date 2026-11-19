"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { createHash } from "node:crypto";
import { verifyResumeProof, MAX_RESUME_BYTES } from "../lib/resume-proof";
import type { Id } from "./_generated/dataModel";

type ImportedResume = { fileName: string; mediaType: string; size: number; sha256: string; documentId: Id<"documents"> };
export const upload = action({
  args: { bytes: v.bytes(), fileName: v.string(), mediaType: v.string(), proof: v.string() },
  handler: async (ctx, args): Promise<ImportedResume> => {
    const owner = await ctx.runQuery(internal.resumesData.currentOwner, {});
    let verified;
    try { verified = await verifyResumeProof(args.proof, new Uint8Array(args.bytes), args.fileName, args.mediaType, owner); }
    catch { throw new ConvexError({ code: "INVALID_RESUME", message: "Prova de importação inválida ou expirada. Importe pela página do perfil." }); }
    const { jti, expiresAt, ...parsed } = verified;
    const storageId = await ctx.storage.store(new Blob([args.bytes], { type: parsed.mediaType }));
    try {
      const documentId: Id<"documents"> = await ctx.runMutation(internal.resumesData.record, { storageId, fileName: parsed.fileName, sha256: parsed.sha256, proofId: jti, expiresAt });
      return { ...parsed, documentId };
    } catch (error) { await ctx.storage.delete(storageId); throw error; }
  },
});
export const download = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args): Promise<{ bytes: ArrayBuffer; fileName: string; mediaType: string } | null> => {
    const document = await ctx.runQuery(internal.resumesData.ownedDocument, args);
    if (!document) return null;
    // storageId remains a string in documents; no publicly usable URL is returned.
    const blob = await ctx.storage.get(document.storageId as Id<"_storage">);
    if (!blob || blob.size > MAX_RESUME_BYTES) return null;
    const bytes = await blob.arrayBuffer();
    if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== document.sha256) throw new ConvexError({ code: "INTEGRITY_ERROR", message: "Integridade do original inválida." });
    return { bytes, fileName: document.fileName, mediaType: blob.type || "application/octet-stream" };
  },
});
