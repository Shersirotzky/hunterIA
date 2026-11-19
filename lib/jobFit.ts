export function list(value?: string): string[] {
  try {
    const items: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(items) ? items.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function rank(roles: string[], skills: string[], title: string, requirements: string[], description = "") {
  const known = new Set(skills.map(normalize));
  const required = [...new Map(requirements.filter(s => s.trim()).map(s => [normalize(s), s])).values()];
  const inferred = !required.length && Boolean(description);
  const words = " " + normalize(description).replace(/[^a-z0-9+#.]+/g, " ") + " ";
  const mentioned = skills.filter(skill => skill.trim() && words.includes(" " + normalize(skill) + " "));
  const matched = required.filter(skill => known.has(normalize(skill)));
  const missing = required.filter(skill => !known.has(normalize(skill)));
  const titleWords = " " + normalize(title).replace(/[^a-z0-9+#.]+/g, " ") + " ";
  const role = roles.find(r => r.trim() && titleWords.includes(" " + normalize(r) + " "));
  const count = (inferred ? skills.length : required.length) + (roles.length ? 1 : 0);
  const score = count && (skills.length || roles.length) ? Math.round(100 * ((inferred ? mentioned.length : matched.length) + (role ? 1 : 0)) / count) : null;
  return { score, matched: inferred ? mentioned : matched, missing, role: role ?? null, inferred };
}
