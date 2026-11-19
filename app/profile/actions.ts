"use server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { editedJson, editedAnswersJson } from "@/convex/profileDomain";

export async function saveProfile(form: FormData) {
  const token = await requireToken();
  const existing = await fetchQuery(api.profile.get, {}, { token });
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const jsonField = (key: string, original: string, list = false) => editedJson(original, String(form.get(key) ?? ""), list);
  await fetchMutation(api.profile.save, {
    fullName: text("fullName"), email: text("email"), location: text("location"),
    seniority: text("seniority"), yearsExperience: text("yearsExperience") ? Number(text("yearsExperience")) : undefined,
    headline: text("headline"), summary: text("summary"), workAuthorization: text("workAuthorization"),
    resumeText: text("resumeText"), resumeName: text("resumeName"),
    resumeDocumentId: text("resumeDocumentId") ? text("resumeDocumentId") as Id<"documents"> : undefined,
    workHistoryJson: jsonField("workHistoryJson", existing?.workHistoryJson ?? "[]"),
    educationJson: jsonField("educationJson", existing?.educationJson ?? "[]"),
    skillsJson: jsonField("skillsJson", existing?.skillsJson ?? "[]", true),
    languagesJson: jsonField("languagesJson", existing?.languagesJson ?? "[]", true),
    targetRolesJson: jsonField("targetRolesJson", existing?.targetRolesJson ?? "[]", true),
    locationsJson: jsonField("locationsJson", existing?.locationsJson ?? "[]", true),
    workModesJson: jsonField("workModesJson", existing?.workModesJson ?? "[]", true),
    salaryJson: jsonField("salaryJson", existing?.salaryJson ?? "{}"),
    preferredIndustriesJson: jsonField("preferredIndustriesJson", existing?.preferredIndustriesJson ?? "[]", true),
    excludedIndustriesJson: jsonField("excludedIndustriesJson", existing?.excludedIndustriesJson ?? "[]", true),
    standardAnswersJson: editedAnswersJson(existing?.standardAnswersJson ?? "{}", String(form.get("standardAnswersJson") ?? "")),
  }, { token });
  revalidatePath("/profile");
}
export async function approveProfile() {
  await fetchMutation(api.profile.approve, {}, { token: await requireToken() });
  revalidatePath("/profile");
  redirect("/jobs");
}
async function requireToken() {
  const token = await convexAuthNextjsAccessToken();
  if (!token) throw new Error("Entre novamente para continuar");
  return token;
}
