import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { readableJson } from "./profileDomain";
import { requireOwner } from "./lib/authz";
import { boardSlug, rank, safeUrl, transition, readSnapshot, reviewSnapshot, greenhouseQuestions, prefillQuestions, readQuestions } from "./jobDomain";

export const list = query({ args: {}, handler: async ctx => {
  const owner = await requireOwner(ctx);
  const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", owner)).unique();
  const jobs = await ctx.db.query("jobs").withIndex("by_owner", q => q.eq("ownerUserId", owner)).collect();
  return jobs.map(job => ({ ...job, match: profile ? rank(profile, job) : rank({ targetRolesJson: "[]", skillsJson: "[]", locationsJson: "[]" }, job) })).sort((a,b) => b.match.score - a.match.score || a.source.localeCompare(b.source) || a.sourceId.localeCompare(b.sourceId));
}});
export const detail = query({ args: { jobId: v.id("jobs") }, handler: async (ctx, { jobId }) => {
  const owner = await requireOwner(ctx);
  const job = await ctx.db.get(jobId);
  if (!job || job.ownerUserId !== owner) return null;
  const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", owner)).unique();
  const existing = await ctx.db.query("applications").withIndex("by_owner_job", q => q.eq("ownerUserId", owner).eq("jobId", jobId)).unique();
  return { job, match: rank(profile ?? { targetRolesJson: "[]", skillsJson: "[]", locationsJson: "[]" }, job), profileApproved: profile?.sourceStatus === "approved", resumeName: profile?.resumeName || "Currículo do perfil", hasResume: !!profile?.resumeText?.trim(), applicationId: existing?._id };
}});
export const sourceJob = internalQuery({ args: { jobId: v.id("jobs") }, handler: async (ctx, {jobId}) => {
  const owner = await requireOwner(ctx); const job = await ctx.db.get(jobId);
  if (!job || job.ownerUserId !== owner) throw new Error("Vaga não encontrada");
  return job;
}});
export const recordQuestions = internalMutation({ args: { owner: v.string(), jobId: v.id("jobs"), questionsJson: v.string(), questionsStatus: v.string() }, handler: async (ctx, args) => {
  const job = await ctx.db.get(args.jobId);
  if (!job || job.ownerUserId !== args.owner) throw new Error("Vaga não encontrada");
  await ctx.db.patch(job._id, {questionsJson:args.questionsJson,questionsStatus:args.questionsStatus,updatedAt:Date.now()});
}});
export const refreshQuestions = action({ args: { jobId: v.id("jobs") }, handler: async (ctx, {jobId}): Promise<void> => {
  const job = await ctx.runQuery(internal.jobs.sourceJob, {jobId});
  // A prior successful capture keeps tests deterministic and avoids redundant public requests.
  if (job.questionsStatus === "available") return;
  let questionsJson = "[]", questionsStatus = "unknown";
  try {
    if (!job.source.startsWith("greenhouse:") || !/^\d+$/.test(job.sourceId)) throw new Error("Fonte sem formulário público");
    const board = boardSlug(job.source.slice("greenhouse:".length));
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${job.sourceId}?questions=true`, {signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error("Formulário indisponível");
    const payload = await response.json();
    if (!Array.isArray(payload.questions)) throw new Error("Perguntas não publicadas");
    questionsJson = JSON.stringify(greenhouseQuestions(payload.questions)); questionsStatus = "available";
  } catch { /* An unavailable form is unknown, never a fulfilled requirement. */ }
  await ctx.runMutation(internal.jobs.recordQuestions, {owner:job.ownerUserId,jobId,questionsJson,questionsStatus});
}});
const jobFields = { seniority: v.optional(v.string()), workMode: v.optional(v.string()), languagesJson: v.optional(v.string()), minimumYearsExperience: v.optional(v.number()), questionsJson: v.optional(v.string()), questionsStatus: v.optional(v.string()), sourceId: v.string(), title: v.string(), canonicalUrl: v.string(), location: v.string(), description: v.string() };
export const ingest = internalMutation({ args: { owner: v.string(), board: v.string(), jobs: v.array(v.object(jobFields)) }, handler: async (ctx, args) => {
  const now = Date.now(); const source = `greenhouse:${boardSlug(args.board)}`;
  for (const job of args.jobs) {
    const existing = await ctx.db.query("jobs").withIndex("by_owner_source_id", q => q.eq("ownerUserId", args.owner).eq("source", source).eq("sourceId", job.sourceId)).unique();
    const data = { ...job, canonicalUrl: safeUrl(job.canonicalUrl), company: args.board, source, ownerUserId: args.owner, status: "open" as const, collectedAt: now, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, data); else await ctx.db.insert("jobs", { ...data, createdAt: now });
  }
  return args.jobs.length;
}});
export const currentOwner = internalQuery({ args: {}, handler: async ctx => await requireOwner(ctx) });
export const collect = action({ args: { board: v.string() }, handler: async (ctx, args): Promise<number> => {
  const owner: string = await ctx.runQuery(internal.jobs.currentOwner, {});
  const board = boardSlug(args.board);
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Greenhouse: HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.jobs) || payload.jobs.length > 5000) throw new Error("Resposta Greenhouse inválida");
  const jobs = payload.jobs.map((j: { id: number; title: string; absolute_url: string; location?: { name?: string }; content?: string; metadata?: {name?: string; value?: unknown}[] }) => {
    if (!Number.isSafeInteger(j.id) || typeof j.title !== "string" || typeof j.absolute_url !== "string") throw new Error("Vaga inválida");
    const metadata = Array.isArray(j.metadata) ? j.metadata : [];
    const meta = (names: string[]) => metadata.find(item => typeof item.name === "string" && names.includes(item.name.toLowerCase().trim()))?.value;
    const seniority = meta(["seniority", "experience level", "senioridade"]);
    const workMode = meta(["work mode", "workplace type", "modalidade"]);
    const requiredLanguages = meta(["required languages", "languages", "idiomas"]);
    const minimumYears = meta(["minimum years experience", "minimum years of experience", "minimum experience years"]);
    return { ...(typeof seniority === "string" ? {seniority} : {}), ...(typeof workMode === "string" ? {workMode} : {}), ...(Array.isArray(requiredLanguages) ? {languagesJson:JSON.stringify(requiredLanguages)} : {}), ...(typeof minimumYears === "number" && minimumYears >= 0 ? {minimumYearsExperience:minimumYears} : {}), sourceId: String(j.id), title: j.title, canonicalUrl: safeUrl(j.absolute_url), location: j.location?.name ?? "", description: (j.content ?? "").replace(/<[^>]*>/g, " ").slice(0, 30000) };
  });
  return await ctx.runMutation(internal.jobs.ingest, { owner, board, jobs });
}});
export const prepare = mutation({ args: { jobId: v.id("jobs"), resumeChoice: v.optional(v.union(v.literal("profile"), v.literal("custom"), v.literal("later"))), resumeText: v.optional(v.string()), resumeName: v.optional(v.string()) }, handler: async (ctx, { jobId, resumeChoice, resumeText, resumeName }) => {
  const owner = await requireOwner(ctx); const job = await ctx.db.get(jobId);
  if (!job || job.ownerUserId !== owner || job.status !== "open") throw new Error("Vaga indisponível");
  const profile = await ctx.db.query("professionalProfiles").withIndex("by_owner", q => q.eq("ownerUserId", owner)).unique();
  if (!profile || profile.sourceStatus !== "approved") throw new Error("Aprove seu perfil primeiro");
  const existing = await ctx.db.query("applications").withIndex("by_owner_job", q => q.eq("ownerUserId", owner).eq("jobId", jobId)).unique();
  if (existing) return existing._id;
  const now = Date.now();
  const chosen = resumeChoice ?? "profile";
  const snapshot = {
    fullName: profile.fullName ?? "", email: profile.email ?? "", location: profile.location ?? "",
    headline: profile.headline ?? "", summary: profile.summary ?? "",
    experience: readableJson(profile.workHistoryJson), education: readableJson(profile.educationJson),
    skills: readableJson(profile.skillsJson), answers: readableJson(profile.standardAnswersJson),
    resumeName: chosen === "profile" ? profile.resumeName || "Currículo do perfil" : resumeName || "Currículo específico",
    resumeDocumentId: chosen === "profile" ? profile.resumeDocumentId ?? "" : "",
    resumeText: chosen === "profile" ? profile.resumeText ?? "" : chosen === "custom" ? resumeText ?? "" : "",
    questionsJson: job.questionsJson ?? "[]", questionsStatus: job.questionsStatus ?? "unknown", responsesJson: "{}",
    capturedAt: now, profileUpdatedAt: profile.updatedAt,
  };
  snapshot.responsesJson = JSON.stringify(prefillQuestions(readQuestions(snapshot.questionsJson), snapshot, profile.standardAnswersJson));
  if (profile.resumeDocumentId && chosen === "profile") { const document = await ctx.db.get(profile.resumeDocumentId); if (!document || document.ownerUserId !== owner || document.kind !== "resume") throw new Error("Currículo não encontrado"); }
  if (snapshot.resumeText.length > 100000) throw new Error("Currículo excede 100 mil caracteres");
  const draft = `${snapshot.fullName}\n${snapshot.email}\n${snapshot.location}\n${snapshot.headline}\n${snapshot.summary}\n\nExperiência:\n${snapshot.experience}\n\nHabilidades:\n${snapshot.skills}\n\nRespostas frequentes:\n${snapshot.answers}\n\nInteresse na vaga: ${job.title}\n\nRevise os campos obrigatórios e complete as perguntas da empresa no site externo.`;
  return await ctx.db.insert("applications", { ownerUserId: owner, jobId, status: "preparing", snapshotJson: JSON.stringify(snapshot), ...(chosen === "profile" && profile.resumeDocumentId ? { resumeDocumentId: profile.resumeDocumentId } : {}), draft, createdAt: now, updatedAt: now });
}});
export const applications = query({ args: {}, handler: async ctx => {
  const owner = await requireOwner(ctx);
  const rows = await ctx.db.query("applications").withIndex("by_owner", q => q.eq("ownerUserId", owner)).collect();
  return await Promise.all(rows.map(async row => { const job = await ctx.db.get(row.jobId); return { ...row, job: job?.ownerUserId === owner ? job : null }; }));
}});
const reviewFields = v.object({ fullName: v.string(), email: v.string(), location: v.string(), experience: v.string(), skills: v.string(), answers: v.string(), resumeName: v.string(), resumeText: v.string(), resumeDocumentId: v.optional(v.id("documents")), responsesJson: v.optional(v.string()) });
export const updateApplication = mutation({ args: { id: v.id("applications"), event: v.union(v.literal("review"), v.literal("forward"), v.literal("confirm")), draft: v.optional(v.string()), evidence: v.optional(v.string()), fields: v.optional(reviewFields) }, handler: async (ctx, args) => {
  const owner = await requireOwner(ctx); const row = await ctx.db.get(args.id);
  if (!row || row.ownerUserId !== owner) throw new Error("Candidatura não encontrada");
  if (args.event === "confirm" && row.status === "confirmed" && row.confirmationEvidence === args.evidence?.trim()) return;
  if (args.event === "review" && !args.draft?.trim()) throw new Error("Rascunho vazio");
  if ((args.draft?.length ?? 0) > 100000) throw new Error("Rascunho excede 100 mil caracteres");
  if (args.fields?.resumeDocumentId) { const document = await ctx.db.get(args.fields.resumeDocumentId); if (!document || document.ownerUserId !== owner || document.kind !== "resume") throw new Error("Currículo não encontrado"); }
  const reviewed = args.event === "review" ? reviewSnapshot(readSnapshot(row.snapshotJson), args.fields ? {...args.fields,resumeDocumentId:args.fields.resumeDocumentId ?? "",responsesJson:args.fields.responsesJson ?? "{}"} : readSnapshot(row.reviewedSnapshotJson ?? row.snapshotJson)) : null;
  if (args.event !== "review") reviewSnapshot(readSnapshot(row.reviewedSnapshotJson), {});
  const status = transition(row.status, args.event, !!row.reviewedAt, args.evidence);
  const now = Date.now();
  await ctx.db.patch(row._id, { status, updatedAt: now, ...(args.event === "review" ? { draft: args.draft, reviewedAt: now, reviewedSnapshotJson: JSON.stringify(reviewed), resumeDocumentId: args.fields?.resumeDocumentId } : args.event === "forward" ? { forwardedAt: now } : { confirmationEvidence: args.evidence!.trim(), submittedAt: now }) });
}});
