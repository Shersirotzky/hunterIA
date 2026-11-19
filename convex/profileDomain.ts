/** Presentation helpers keep unchanged structured imports byte-for-byte. */
export function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}
const labels: Record<string, string> = {
  title: "Cargo", company: "Empresa", description: "Descrição", startDate: "Início", endDate: "Fim",
  institution: "Instituição", degree: "Formação", name: "Nome", level: "Nível", minimum: "Mínimo", currency: "Moeda",
  listed: "Habilidades", text: "Texto", answer: "Resposta", question: "Pergunta",
};
export function readable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join("\n");
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${labels[key] ?? key}: ${readable(item)}`).join("\n");
  return "";
}
export function readableJson(raw: string) { return readable(parseJson(raw)); }
export function editedJson(original: string, text: string, list = false) {
  if (readableJson(original) === text) return original;
  if (list) return JSON.stringify(text.split(/[\n,;]/).map(x => x.trim()).filter(Boolean));
  return JSON.stringify(text.trim() ? [{ text: text.trim() }] : []);
}
export function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function importedContact(text: string) {
  return { email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "" };
}

/** One reviewed Q/A per line. Split only at the first colon. */
export function parseStandardAnswers(text: string): { question: string; answer: string }[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const colon = line.indexOf(":");
    if (colon <= 0 || !line.slice(colon + 1).trim()) throw new Error(`Resposta frequente ${index + 1}: use Pergunta: resposta, uma por linha.`);
    const question = line.slice(0, colon).trim(), answer = line.slice(colon + 1).trim();
    const key = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (seen.has(key)) throw new Error(`Pergunta duplicada: ${question}`);
    if (question.length > 2000 || answer.length > 20000) throw new Error("Pergunta ou resposta excede o tamanho permitido");
    seen.add(key); return { question, answer };
  });
}
export function readableAnswersJson(raw: string) {
  const value = parseJson(raw);
  if (Array.isArray(value)) return value.map(item => {
    if (item && typeof item === "object" && typeof item.question === "string" && typeof item.answer === "string") return `${item.question}: ${item.answer}`;
    if (item && typeof item === "object" && typeof item.text === "string") return item.text;
    return readable(item);
  }).filter(Boolean).join("\n");
  if (value && typeof value === "object") return Object.entries(value).map(([key, answer]) => `${key}: ${readable(answer)}`).join("\n");
  return typeof value === "string" ? value : "";
}
export function editedAnswersJson(original: string, text: string) {
  return readableAnswersJson(original) === text ? original : JSON.stringify(parseStandardAnswers(text));
}
