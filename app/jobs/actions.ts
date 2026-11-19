"use server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Id } from "@/convex/_generated/dataModel";
export async function collectJobs(form: FormData) {
  await fetchAction(api.jobs.collect, { board: String(form.get("board") ?? "").trim() }, { token: await requireToken() });
  revalidatePath("/jobs");
}
export async function prepareOnOpen(jobId: string) {
  const token = await requireToken();
  await fetchAction(api.jobs.refreshQuestions, { jobId: jobId as Id<"jobs"> }, { token });
  const id = await fetchMutation(api.jobs.prepare, { jobId: jobId as Id<"jobs">, resumeChoice: "profile" }, { token });
  revalidatePath("/applications");
  return id;
}
export async function prepareApplication(form: FormData) {
  const choice = String(form.get("resumeChoice") ?? "profile");
  if (choice !== "profile" && choice !== "custom" && choice !== "later") throw new Error("Escolha um currículo válido");
  const id = await fetchMutation(api.jobs.prepare, {
    jobId: String(form.get("jobId")) as Id<"jobs">, resumeChoice: choice,
    resumeText: String(form.get("resumeText") ?? ""), resumeName: String(form.get("resumeName") ?? ""),
  }, { token: await requireToken() });
  revalidatePath("/applications");
  redirect(`/applications#${id}`);
}
export async function updateApplication(form: FormData) {
  const event = String(form.get("event"));
  if (event !== "review" && event !== "forward" && event !== "confirm") throw new Error("Ação inválida");
  const responses: Record<string,string> = {};
  for (const key of new Set([...form.keys()].filter(key => key.startsWith("question:")))) {
    const values = form.getAll(key).map(String);
    responses[key.slice("question:".length)] = form.get(`multi:${key.slice("question:".length)}`) === "true" ? JSON.stringify(values) : values[0] ?? "";
  }
  await fetchMutation(api.jobs.updateApplication, { id: String(form.get("id")) as Id<"applications">, event, draft: form.has("draft") ? String(form.get("draft")) : undefined, evidence: form.has("evidence") ? String(form.get("evidence")) : undefined,
    fields: event === "review" ? {
      fullName: String(form.get("fullName") ?? "").trim(), email: String(form.get("email") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(), experience: String(form.get("experience") ?? "").trim(),
      skills: String(form.get("skills") ?? "").trim(), answers: String(form.get("answers") ?? "").trim(),
      resumeName: String(form.get("resumeName") ?? "").trim(), resumeText: String(form.get("resumeText") ?? "").trim(),
      resumeDocumentId: form.get("resumeDocumentId") ? String(form.get("resumeDocumentId")) as Id<"documents"> : undefined, responsesJson: JSON.stringify(responses),
    } : undefined,
  }, { token: await requireToken() });
  revalidatePath("/applications");
}

async function requireToken() {
  const token = await convexAuthNextjsAccessToken();
  if (!token) throw new Error("Entre novamente para continuar");
  return token;
}
