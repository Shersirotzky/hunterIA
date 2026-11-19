import Papa from "papaparse";
import { unzipSync, strFromU8 } from "fflate";

const accepted = /^(Skills|Positions|Education|Profile)\.csv$/i;
const maxBytes = 4_000_000;
export async function readLinkedInExport(files: File[]) {
  const skills = new Set<string>();
  const history = new Set<string>();
  let fullName = "";
  let recognized = false;
  let bytes = 0;
  function read(name: string, content: string) {
    const kind = name.split("/").pop() ?? "";
    if (!accepted.test(kind)) return;
    recognized = true;
    const result = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true });
    if (result.errors.some(x => x.code === "MissingQuotes")) throw new Error("CSV inválido.");
    for (const row of result.data) {
      if (/^Skills/i.test(kind) && row.Name?.trim()) skills.add(row.Name.trim());
      if (/^Positions/i.test(kind)) {
        const entry = [row.Title, row["Company Name"], row["Started On"], row["Finished On"], row.Description].filter(Boolean).join(" · ");
        if (entry) history.add(entry);
      }
      if (/^Education/i.test(kind)) {
        const entry = [row["School Name"], row["Degree Name"], row["Start Date"], row["End Date"], row.Notes].filter(Boolean).join(" · ");
        if (entry) history.add(entry);
      }
      if (/^Profile/i.test(kind)) {
        fullName = [row["First Name"], row["Last Name"]].filter(Boolean).join(" ");
        if (row.Summary) history.add(row.Summary);
      }
    }
  }
  for (const file of files) {
    if (file.size > 32_000_000) throw new Error("Escolha os arquivos CSV individuais para esta exportação.");
    if (/\.zip$/i.test(file.name)) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
        if (!accepted.test(entry.name.split("/").pop() ?? "")) return false;
        bytes += entry.originalSize;
        if (bytes > maxBytes) throw new Error("Os CSVs excedem o limite de 4 MB.");
        return true;
      } });
      Object.entries(entries).forEach(([name, data]) => read(name, strFromU8(data)));
    } else if (accepted.test(file.name)) {
      bytes += file.size;
      if (bytes > maxBytes) throw new Error("Os CSVs excedem o limite de 4 MB.");
      read(file.name, await file.text());
    }
  }
  if (!recognized || (!skills.size && !history.size && !fullName)) throw new Error("Selecione Skills.csv, Positions.csv, Education.csv, Profile.csv ou o ZIP do LinkedIn.");
  return { skills: [...skills], history: [...history], fullName };
}
