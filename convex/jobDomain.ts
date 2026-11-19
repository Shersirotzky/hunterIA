/** Ranking v2: fixed 100-point evidence weights; unknown data never implies a failed requirement. */
export function terms(raw: string): string[] {
  try { const parsed: unknown = JSON.parse(raw); const value = parsed && typeof parsed === "object" && "listed" in parsed ? parsed.listed : parsed; return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && !!x.trim()) : []; } catch { return []; }
}
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export type Criterion = { label: string; state: "matched" | "not_matched" | "unknown"; evidence: string; weight: number };
type RankProfile = { targetRolesJson: string; skillsJson: string; locationsJson: string; seniority?: string; yearsExperience?: number; workModesJson?: string; languagesJson?: string; workHistoryJson?: string };
type RankJob = { title: string; description?: string; location?: string; seniority?: string; workMode?: string; languagesJson?: string; minimumYearsExperience?: number };
function alias(value: string, groups: string[][]) { const key = normalize(value); return groups.find(group => group.some(item => normalize(item) === key))?.[0] ?? key; }
const mode = (value: string) => alias(value, [["remote","remoto","remota"],["hybrid","hibrido","hibrida"],["onsite","on-site","presencial"]]);
const level = (value: string) => alias(value, [["junior","jr","junior level","entry level"],["mid","pleno","mid-level","intermediate"],["senior","sr","senior level"],["lead","lideranca","tech lead"],["manager","gerencia"],["director","diretoria"]]);
const language = (value: string) => alias(value, [["english","ingles"],["portuguese","portugues"],["spanish","espanhol"],["french","frances"],["german","alemao"]]);
function proficiency(raw?: string) {
  if (!raw) return undefined;
  const key = normalize(raw);
  const levels: Record<string,number> = { basic:1, basico:1, beginner:1, a1:1, a2:1, intermediate:2, intermediario:2, b1:2, b2:3, advanced:3, avancado:3, c1:4, fluent:4, fluente:4, c2:5, native:5, nativo:5 };
  return levels[key];
}
function languages(raw?: string): { name: string; level?: number }[] {
  let value: unknown; try { value = JSON.parse(raw ?? "[]"); } catch { return []; }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    value = Array.isArray(object.listed) ? object.listed : Object.entries(object).map(([name, data]) => ({ name, level: typeof data === "string" ? data : data && typeof data === "object" ? (data as Record<string,unknown>).level : undefined }));
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item === "string") { const [name, ...rest] = item.split(":"); return name.trim() ? [{ name: language(name.trim()), level: proficiency(rest.join(":").trim()) }] : []; }
    if (item && typeof item === "object") { const name = item.name ?? item.language; const rawLevel = item.level ?? item.proficiency; return typeof name === "string" ? [{ name: language(name), level: typeof rawLevel === "string" ? proficiency(rawLevel) : undefined }] : []; }
    return [];
  });
}
export function rank(profile: RankProfile, job: RankJob) {
  const reasons: string[] = [], criteria: Criterion[] = [];
  let earned = 0, knownWeight = 0;
  const add = (label: string, weight: number, state: Criterion["state"], evidence: string, ratio = state === "matched" ? 1 : 0) => {
    criteria.push({label, weight, state, evidence});
    if (state !== "unknown") { knownWeight += weight; earned += weight * ratio; }
    if (state === "matched") reasons.push(`${label}: ${evidence}`);
  };
  const matched = (list: string[], text: string) => list.filter(term => normalize(text).includes(normalize(term)));
  const roles = terms(profile.targetRolesJson), skills = [...new Set(terms(profile.skillsJson).map(normalize))], places = terms(profile.locationsJson);
  const foundRoles = matched(roles, job.title), foundSkills = matched(skills, `${job.title} ${job.description ?? ""}`), foundPlaces = matched(places, job.location ?? "");
  add("Cargo",35,!roles.length || !job.title.trim() ? "unknown" : foundRoles.length ? "matched" : "not_matched", foundRoles.join(", ") || "Cargo desejado ou correspondência não informado");
  add("Habilidades",25,!skills.length || (!job.description?.trim() && foundSkills.length < skills.length) ? "unknown" : foundSkills.length ? "matched" : "not_matched", foundSkills.join(", ") || "Sem descrição suficiente ou correspondência", skills.length ? foundSkills.length / skills.length : 0);
  add("Local",10,!places.length || !job.location?.trim() ? "unknown" : foundPlaces.length ? "matched" : "not_matched", foundPlaces.join(", ") || "Local não informado ou sem correspondência");
  add("Senioridade",10,!profile.seniority?.trim() || !job.seniority?.trim() ? "unknown" : level(profile.seniority) === level(job.seniority) ? "matched" : "not_matched", profile.seniority && job.seniority ? `Desejada: ${profile.seniority}; vaga: ${job.seniority}` : "Senioridade estruturada não informada");
  const modes = terms(profile.workModesJson ?? "[]");
  add("Modalidade",10,!modes.length || !job.workMode?.trim() ? "unknown" : modes.some(item => mode(item) === mode(job.workMode!)) ? "matched" : "not_matched", job.workMode || "Modalidade estruturada não informada");
  const spoken = languages(profile.languagesJson), required = languages(job.languagesJson);
  let languageState: Criterion["state"] = !spoken.length || !required.length ? "unknown" : "matched";
  if (languageState !== "unknown") for (const need of required) {
    const actual = spoken.find(item => item.name === need.name);
    if (!actual || (need.level !== undefined && actual.level !== undefined && actual.level < need.level)) { languageState = "not_matched"; break; }
    if (need.level !== undefined && actual.level === undefined) languageState = "unknown";
  }
  add("Idiomas",5,languageState,required.length ? required.map(item => `${item.name}${item.level ? ` (nível ${item.level})` : ""}`).join(", ") : "Requisitos de idioma não informados");
  const years = profile.yearsExperience;
  const minimum = job.minimumYearsExperience;
  add("Experiência",5,years === undefined || minimum === undefined || !Number.isFinite(years) || !Number.isFinite(minimum) ? "unknown" : years >= minimum ? "matched" : "not_matched", years !== undefined && minimum !== undefined ? `${years} ano(s) informados; mínimo publicado: ${minimum}` : "Anos de experiência ou mínimo estruturado não informados");
  add("Salário",0,"unknown","Não avaliado"); add("Autorização de trabalho",0,"unknown","Não avaliado");
  return { score: Math.round(earned), knownWeight, reasons, criteria };
}
export function recommended<T extends { status: string; match: { score: number } }>(jobs: T[]) { return jobs.filter(job => job.status === "open" && job.match.score >= 85); }
export type JobQuestion = { key: string; label: string; required: boolean; type: "text" | "email" | "select" | "multi" | "resume" | "attachment"; options: { label: string; value: string }[]; sensitive: boolean; fileOnly?: boolean };
const sensitiveQuestion = (label: string) => /race|racial|ethnic|gender|sex|pronoun|religio|disabil|veteran|nationality|citizenship|immigra|visa|birth|age\b|salary|salari|consent|privacy|gdpr|work.authoriz|autoriz|deficien|genero|etnia|orienta|gravidez/i.test(normalize(label));
export function greenhouseQuestions(raw: unknown): JobQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0,200).flatMap((item, index) => {
    if (!item || typeof item !== "object" || typeof item.label !== "string" || !Array.isArray(item.fields) || !item.fields.length) return [];
    const fields = item.fields.filter((field: unknown): field is { name: string; type: string; values?: { label?: string; value?: unknown }[] } => !!field && typeof field === "object" && typeof (field as {name?:unknown}).name === "string" && typeof (field as {type?:unknown}).type === "string");
    const first = fields[0]; if (!first) return [];
    const isResume = fields.some((field: {name:string}) => /^(resume|resume_text)$/.test(field.name));
    const type: JobQuestion["type"] = isResume ? "resume" : fields.some((field: {type:string}) => field.type === "input_file") ? "attachment" : /multi.*multi/.test(first.type) ? "multi" : /select/.test(first.type) ? "select" : first.name === "email" ? "email" : "text";
    const options = Array.isArray(first.values) ? first.values.slice(0,500).flatMap((option: {label?:unknown;value?:unknown}) => typeof option.label === "string" && (typeof option.value === "string" || typeof option.value === "number") ? [{label:option.label,value:String(option.value)}] : []) : [];
    return [{ key: `${index}:${first.name}`, label: item.label.slice(0,2000), required: item.required === true, type, options, sensitive: sensitiveQuestion(item.label) || sensitiveQuestion(first.name), fileOnly: isResume && !fields.some((field: {type:string}) => field.type !== "input_file") }];
  });
}
export function readQuestions(raw?: string): JobQuestion[] {
  try { const value = JSON.parse(raw ?? "[]"); return Array.isArray(value) ? value.filter(q => q && typeof q.key === "string" && typeof q.label === "string" && Array.isArray(q.options)) : []; } catch { return []; }
}
export function readResponses(raw?: string): Record<string, string> {
  try { const value = JSON.parse(raw ?? "{}"); if (value && typeof value === "object" && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).filter((pair): pair is [string,string] => typeof pair[1] === "string")); } catch { /* Invalid responses need review. */ }
  return {};
}
export function prefillQuestions(questions: JobQuestion[], snapshot: { fullName: string; email: string; location: string; resumeText: string }, answersRaw: string): Record<string, string> {
  let answers: Record<string,string> = {};
  try {
    const value = JSON.parse(answersRaw);
    if (Array.isArray(value)) answers = Object.fromEntries(value.filter(x => typeof x?.question === "string" && typeof x?.answer === "string").map(x => [normalize(x.question),x.answer]));
    else if (value && typeof value === "object") answers = Object.fromEntries(Object.entries(value).filter((pair): pair is [string,string] => typeof pair[1] === "string").map(([key,val]) => [normalize(key),val]));
  } catch { /* No guesses from free text. */ }
  const result: Record<string,string> = {};
  for (const q of questions) {
    if (q.sensitive || q.type === "attachment") continue;
    const name = q.key.split(":").slice(1).join(":");
    const names = snapshot.fullName.trim().split(/\s+/);
    let value = ({first_name:names[0],last_name:names.length > 1 ? names.slice(1).join(" ") : "",name:snapshot.fullName,full_name:snapshot.fullName,email:snapshot.email,location:snapshot.location,location_name:snapshot.location,resume:snapshot.resumeText,resume_text:snapshot.resumeText} as Record<string,string>)[name] ?? answers[normalize(q.label)] ?? "";
    if (q.type === "select") value = q.options.find(option => normalize(option.label) === normalize(value) || option.value === value)?.value ?? "";
    if (q.type === "multi") value = ""; // Multi-choice answers require deliberate selection.
    if (value.trim()) result[q.key] = value;
  }
  return result;
}
export function missingQuestions(snapshot: { questionsJson: string; responsesJson: string; resumeText: string; resumeDocumentId: string }) {
  const responses = readResponses(snapshot.responsesJson);
  return readQuestions(snapshot.questionsJson).flatMap(q => {
    if (!q.required) return [];
    const answer = responses[q.key]?.trim() ?? "";
    if (q.type === "resume") return snapshot.resumeText.trim() && (!q.fileOnly || snapshot.resumeDocumentId) ? [] : [q.label];
    if (q.type === "attachment") return [q.label + " (anexo específico pendente no site externo)"];
    if (!answer) return [q.label];
    if (q.type === "select" && !q.options.some(option => option.value === answer)) return [q.label];
    if (q.type === "multi") { try { const values = JSON.parse(answer); if (!Array.isArray(values) || !values.length || values.some(item => !q.options.some(option => option.value === item))) return [q.label]; } catch { return [q.label]; } }
    if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return [q.label];
    return [];
  });
}
export type ApplicationSnapshot = {
  fullName: string; email: string; location: string; headline: string; summary: string;
  experience: string; education: string; skills: string; answers: string;
  resumeName: string; resumeText: string; resumeDocumentId: string; questionsJson: string; questionsStatus: string; responsesJson: string; capturedAt: number; profileUpdatedAt: number;
};
export function readSnapshot(raw?: string): ApplicationSnapshot {
  let value: Record<string, unknown> = {};
  try { const parsed: unknown = JSON.parse(raw ?? "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed as Record<string, unknown>; } catch { /* Legacy rows need explicit review. */ }
  const text = (key: string) => typeof value[key] === "string" ? value[key] as string : "";
  return { fullName: text("fullName"), email: text("email"), location: text("location"), headline: text("headline"), summary: text("summary"), experience: text("experience"), education: text("education"), skills: text("skills"), answers: text("answers"), resumeName: text("resumeName"), resumeText: text("resumeText"), resumeDocumentId: text("resumeDocumentId"), questionsJson: text("questionsJson"), questionsStatus: text("questionsStatus"), responsesJson: text("responsesJson"), capturedAt: typeof value.capturedAt === "number" ? value.capturedAt : 0, profileUpdatedAt: typeof value.profileUpdatedAt === "number" ? value.profileUpdatedAt : 0 };
}
export function missingFields(snapshot: Pick<ApplicationSnapshot, "fullName" | "email" | "resumeText"> & Partial<Pick<ApplicationSnapshot, "questionsJson" | "responsesJson" | "resumeDocumentId">>) {
  const missing: string[] = [];
  if (!snapshot.fullName.trim()) missing.push("Nome completo");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(snapshot.email.trim())) missing.push("E-mail válido");
  if (!snapshot.resumeText.trim()) missing.push("Texto do currículo");
  missing.push(...missingQuestions({questionsJson:snapshot.questionsJson ?? "[]",responsesJson:snapshot.responsesJson ?? "{}",resumeText:snapshot.resumeText,resumeDocumentId:snapshot.resumeDocumentId ?? ""}));
  return [...new Set(missing)];
}
export function reviewSnapshot(original: ApplicationSnapshot, fields: Partial<ApplicationSnapshot>) {
  const next = { ...original, ...fields, capturedAt: original.capturedAt, profileUpdatedAt: original.profileUpdatedAt, questionsJson: original.questionsJson, questionsStatus: original.questionsStatus };
  const missing = missingFields(next);
  if (missing.length) throw new Error(`Preencha os campos obrigatórios: ${missing.join(", ")}`);
  if (Object.values(next).some(value => typeof value === "string" && value.length > 100000)) throw new Error("Campo excede 100 mil caracteres");
  return next;
}
export function safeUrl(raw: string) { const url = new URL(raw); if (url.protocol !== "https:" || url.username || url.password) throw new Error("URL externa inválida"); return url.href; }
export function boardSlug(raw: string) { if (!/^[a-zA-Z0-9_-]{1,80}$/.test(raw)) throw new Error("Board Greenhouse inválido"); return raw; }
export function transition(status: string, event: "review" | "forward" | "confirm", reviewed: boolean, evidence = "") {
  if (event === "review" && ["preparing", "ready"].includes(status)) return "ready";
  if (event === "forward" && status === "ready" && reviewed) return "ready";
  if (event === "confirm" && status === "ready" && reviewed && evidence.trim().length >= 10) return "confirmed";
  throw new Error("Revise o rascunho e informe evidência de envio antes de confirmar.");
}
