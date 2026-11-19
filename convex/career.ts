import { decodeJwt } from "jose";
import { createFunctionHandle } from "convex/server";
import type { TokenBundle } from "@convex-dev/auth/ssr";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { components, internal } from "./_generated/api";
import { internalMutation, query, mutation, action } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { rank, list } from "../lib/jobFit";

const identityFields = {
  subject: v.string(), name: v.optional(v.string()), email: v.optional(v.string()), authorizationExpiresAt: v.number(),
};

function emptyProfile(ownerUserId: string, linkedinSubject: string) {
  return { ownerUserId, linkedinSubject, workHistoryJson: "[]", educationJson: "[]", skillsJson: "[]",
    languagesJson: "[]", targetRolesJson: "[]", locationsJson: "[]", workModesJson: "[]", salaryJson: "{}",
    preferredIndustriesJson: "[]", excludedIndustriesJson: "[]", standardAnswersJson: "{}",
    sourceStatus: "pending_review" as const, createdAt: Date.now(), updatedAt: Date.now() };
}
function getProfile(ctx: QueryCtx | MutationCtx, owner: string) {
  return ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", owner)).unique();
}
async function careerProfile(ctx: QueryCtx | MutationCtx, owner: string) {
  const stable = await getProfile(ctx, owner);
  if (stable) return stable;
  const session = await ctx.auth.getUserIdentity();
  return session ? getProfile(ctx, session.subject) : null;
}
async function ownerId(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx, components.auth);
  if (!id) throw new Error("Entre no Hunter IA para continuar.");
  return id;
}
export const recordLogin = internalMutation({
  args: identityFields,
  handler: async (ctx, { subject, name, email, authorizationExpiresAt }): Promise<TokenBundle> => {
    const linked = await ctx.db.query("linkedinAccounts").withIndex("by_subject", q => q.eq("subject", subject)).unique();
    const auth = components.auth.public;
    const options = {
      claims: { method: "linkedin", profile: {} }, componentPath: "auth",
      accessTokenTtlSeconds: 60, refreshInactivityTimeoutSeconds: 30 * 86400, sessionMaxLifetimeSeconds: 30 * 86400,
    };
    let existingUserId = linked?.userId;
    if (!existingUserId) {
      const bindings = await ctx.db.query("externalConnections").withIndex("by_provider_subject", q =>
        q.eq("provider", "linkedin").eq("subject", subject)).collect();
      const owners = new Set<string>();
      for (const binding of bindings) {
        const owner = binding.ownerAccountId ?? (await ctx.runQuery(auth.getSession, { sessionId: binding.ownerUserId }))?.userId;
        if (!owner) throw new Error("Entre com o método anterior e reconecte seu LinkedIn.");
        owners.add(owner);
      }
      if (owners.size > 1) throw new Error("LinkedIn associado a mais de uma conta.");
      const first = [...owners][0];
      if (first) existingUserId = ctx.db.normalizeId("users", first) ?? undefined;
    }
    const tokens = existingUserId
      ? await ctx.runMutation(auth._internal_dangerous_signIn, { ...options, userId: existingUserId })
      : await ctx.runMutation(auth._internal_dangerous_signUp, {
        ...options, createUserHandle: await createFunctionHandle(internal.users.createLinkedInUser),
      });
    const owner = tokens.userId;
    const userId = ctx.db.normalizeId("users", owner);
    if (!userId) throw new Error("Invalid user");
    if (!linked) await ctx.db.insert("linkedinAccounts", { subject, userId });
    const sessionId = decodeJwt(tokens.accessToken).sub;
    if (!sessionId) throw new Error("Invalid session");
    const now = Date.now();
    await ctx.db.insert("externalConnections", { ownerUserId: sessionId, ownerAccountId: owner, provider: "linkedin", subject,
      profileJson: "{}", authorizationExpiresAt, verifiedAt: now, createdAt: now, updatedAt: now });
    const current = await getProfile(ctx, owner);
    const imported = { fullName: current?.fullName ?? name, email: current?.email ?? email, updatedAt: Date.now() };
    if (current) await ctx.db.patch(current._id, imported);
    else await ctx.db.insert("professionalProfiles", { ...emptyProfile(owner, subject), ...imported });
    return tokens;
  },
});

export const profile = query({
  args: {}, handler: async (ctx) => careerProfile(ctx, await ownerId(ctx)),
});
export const save = mutation({
  args: { fullName: v.string(), email: v.string(), phone: v.string(), summary: v.string(), skills: v.array(v.string()), roles: v.array(v.string()), locations: v.optional(v.string()), modes: v.optional(v.string()), salary: v.optional(v.string()) },
  handler: async (ctx, { skills, roles, locations, modes, salary, ...fields }) => {
    const owner = await ownerId(ctx);
    if (skills.length > 200 || roles.length > 100 || [...skills, ...roles].some(x => x.length > 200)
      || Object.values(fields).some(x => x.length > 12000)) throw new Error("Perfil muito longo.");
    const current = await careerProfile(ctx, owner);
    const data = { ...fields, ownerUserId: owner,
      locationsJson: locations === undefined ? current?.locationsJson ?? "[]" : JSON.stringify(locations.split(",").map(x => x.trim()).filter(Boolean)),
      workModesJson: modes === undefined ? current?.workModesJson ?? "[]" : JSON.stringify(modes.split(",").map(x => x.trim()).filter(Boolean)),
      salaryJson: salary === undefined ? current?.salaryJson ?? "{}" : JSON.stringify({ minimum: salary }),
      skillsJson: JSON.stringify(skills), targetRolesJson: JSON.stringify(roles),
      sourceStatus: "approved" as const, updatedAt: Date.now() };
    if (current) await ctx.db.patch(current._id, data);
    else await ctx.db.insert("professionalProfiles", { ...emptyProfile(owner, ""), ...data });
  },
});

export const jobs = query({
  args: {}, handler: async (ctx) => {
    const owner = await ownerId(ctx);
    const profile = await careerProfile(ctx, owner);
    const rows = await ctx.db.query("jobs").withIndex("by_owner_source_id", q => q.eq("ownerUserId", owner)).collect();
    return rows.filter(j => j.status === "open").map(job => ({ ...job,
      ...rank(list(profile?.targetRolesJson), list(profile?.skillsJson), job.title, job.skills ?? [], job.description),
    })).sort((a,b) => (b.score ?? -1) - (a.score ?? -1) || b.collectedAt - a.collectedAt);
  },
});
export const addJob = mutation({
  args: { title: v.string(), company: v.string(), url: v.string(), skills: v.array(v.string()) },
  handler: async (ctx, { title, company, url, skills }) => {
    const ownerUserId = await ownerId(ctx);
    const link = new URL(url);
    if (link.protocol !== "https:" || link.username || link.password || !title.trim() || !company.trim()
      || title.length > 300 || company.length > 300 || skills.length > 150) throw new Error("Confira os dados da vaga.");
    const canonicalUrl = link.toString();
    const current = await ctx.db.query("jobs").withIndex("by_owner_source_id", q =>
      q.eq("ownerUserId", ownerUserId).eq("source","manual").eq("sourceId",canonicalUrl)).unique();
    const data = { ownerUserId, title, company, skills, source: "manual", sourceId: canonicalUrl, canonicalUrl,
      status: "open" as const, collectedAt: Date.now() };
    if (current) await ctx.db.patch(current._id, data);
    else await ctx.db.insert("jobs", { ...data, createdAt: Date.now(), updatedAt: Date.now() });
  },
});
export const prepare = mutation({
  args: { jobId: v.id("jobs") }, handler: async (ctx, { jobId }) => {
    const owner = await ownerId(ctx);
    const job = await ctx.db.get(jobId);
    if (!job || job.ownerUserId !== owner || job.status !== "open") throw new Error("Vaga indisponível.");
    const profile = await careerProfile(ctx, owner);
    if (profile?.sourceStatus !== "approved") throw new Error("Revise e salve seu perfil primeiro.");
    const exists = await ctx.db.query("applications").withIndex("by_owner_job", q => q.eq("ownerUserId", owner).eq("jobId", jobId)).unique();
    if (exists) return exists._id;
    const draft = { name: profile.fullName ?? "", email: profile.email ?? "", phone: profile.phone ?? "",
      summary: profile.summary ?? "", skills: list(profile.skillsJson), locations: list(profile.locationsJson), roles: list(profile.targetRolesJson), modes: list(profile.workModesJson) };
    return ctx.db.insert("applications", { ownerUserId: owner, jobId, draft, platform: job.source, status: "needs_review",
      createdAt: Date.now(), updatedAt: Date.now() });
  },
});
export const drafts = query({
  args: {}, handler: async (ctx) => {
    const owner = await ownerId(ctx);
    const rows = await ctx.db.query("applications").withIndex("by_owner", q => q.eq("ownerUserId", owner)).order("desc").collect();
    return Promise.all(rows.filter(row => row.draft).map(async row => {
      const job = await ctx.db.get(row.jobId);
      return { id: row._id, draft: row.draft!, title: job?.title, url: job?.canonicalUrl };
    }));
  },
});

const posting = v.object({ sourceId: v.string(), title: v.string(), canonicalUrl: v.string(), description: v.string() });

export const syncBoard = action({
  args: { board: v.string() },
  handler: async (ctx, args): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    const session = identity ? await ctx.runQuery(components.auth.public.getSession, { sessionId: identity.subject }) : null;
    const owner = session?.userId;
    if (!owner) throw new Error("Entre novamente.");
    const board = args.board.toLowerCase().trim();
    if (!/^[a-z0-9_-]{1,80}$/.test(board)) throw new Error("Informe o identificador do mural Greenhouse.");
    const response = await fetch("https://boards-api.greenhouse.io/v1/boards/" + board + "/jobs?content=true", {
      redirect: "error", signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Mural indisponível.");
    const body = await response.json() as { jobs: { id: number; absolute_url: string; title: string; content?: string }[] };
    if (!Array.isArray(body.jobs)) throw new Error("Resposta inválida.");
    const postings = body.jobs.filter(j => Number.isSafeInteger(j.id) && typeof j.title === "string" &&
      typeof j.absolute_url === "string" && j.absolute_url.startsWith("https://")).map(j => ({
      sourceId: String(j.id), title: j.title.slice(0,300), canonicalUrl: j.absolute_url,
      description: (j.content ?? "").replace(/&amp;/g, "&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").slice(0,12000),
    }));
    for (let i = 0; i < postings.length; i += 20) {
      await ctx.runMutation(internal.career.storePostings, { owner, board, postings: postings.slice(i, i + 20) });
    }
    await ctx.runMutation(internal.career.closeMissing, { owner, board, active: postings.map(j => j.sourceId) });
    return postings.length;
  },
});
export const storePostings = internalMutation({
  args: { owner: v.string(), board: v.string(), postings: v.array(posting) },
  handler: async (ctx, { owner, board, postings }) => {
    const source = "greenhouse/" + board;
    for (const job of postings) {
      const current = await ctx.db.query("jobs").withIndex("by_owner_source_id", q =>
        q.eq("ownerUserId", owner).eq("source", source).eq("sourceId",job.sourceId)).unique();
      const now = Date.now();
      const data = { ...job, company: board, source, ownerUserId: owner, updatedAt: now, collectedAt: now, status: "open" as const };
      if (current) await ctx.db.patch(current._id, data);
      else await ctx.db.insert("jobs", { ...data, createdAt: now });
    }
  },
});
export const closeMissing = internalMutation({
  args: { owner: v.string(), board: v.string(), active: v.array(v.string()) },
  handler: async (ctx, { owner, board, active }) => {
    const rows = await ctx.db.query("jobs").withIndex("by_owner_source_id", q =>
      q.eq("ownerUserId", owner).eq("source", "greenhouse/" + board)).collect();
    const ids = new Set(active);
    for (const row of rows) if (!ids.has(row.sourceId) && row.status === "open") await ctx.db.patch(row._id, { status: "closed", updatedAt: Date.now() });
  },
});
