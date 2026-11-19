"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { list } from "@/lib/jobFit";

export default function ProfilePage() {
  const profile = useQuery(api.career.profile);
  const save = useMutation(api.career.save);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (profile === undefined) return <main>Carregando perfil…</main>;
  let minimum = "";
  try { const value = JSON.parse(profile?.salaryJson ?? "{}").minimum; if (typeof value === "string" || typeof value === "number") minimum = String(value); } catch { /* Legacy profile */ }
  return <main className="page-stack"><h1>Seu perfil profissional</h1>
    <p>Revise os dados do LinkedIn e complete as informações que serão usadas nas vagas e candidaturas.</p>
    <form className="panel auth-form" onSubmit={async e => {
      e.preventDefault();
      const fields = new FormData(e.currentTarget);
      const read = (key: string) => String(fields.get(key) ?? "").trim();
      const items = (key: string) => read(key).split(",").map(s => s.trim()).filter(Boolean);
      setBusy(true);
      try {
        await save({ fullName: read("name"), email: read("email"), phone: read("phone"), summary: read("summary"),
          skills: items("skills"), roles: items("roles"), locations: read("locations"), modes: read("modes"), salary: read("salary") });
        setMessage("Perfil salvo para suas candidaturas.");
      } catch { setMessage("Não foi possível salvar seu perfil."); }
      finally { setBusy(false); }
    }}>
      <label>Importar exportação do LinkedIn (ZIP ou CSV)
        <input type="file" multiple accept=".zip,.csv" onChange={async event => {
          const form = event.currentTarget.form;
          const files = Array.from(event.currentTarget.files ?? []);
          if (!form || !files.length) return;
          setBusy(true);
          try {
            const { readLinkedInExport } = await import("@/lib/linkedinExport");
            const data = await readLinkedInExport(files);
            const skills = form.elements.namedItem("skills") as HTMLInputElement;
            const name = form.elements.namedItem("name") as HTMLInputElement;
            const summary = form.elements.namedItem("summary") as HTMLTextAreaElement;
            skills.value = [...new Set([...skills.value.split(",").map(x => x.trim()).filter(Boolean), ...data.skills])].join(", ");
            if (!name.value) name.value = data.fullName;
            summary.value = [...new Set([summary.value, ...data.history].filter(Boolean))].join("\n");
            setMessage("Dados importados. Revise os campos antes de salvar.");
          } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao importar arquivo."); }
          finally { setBusy(false); }
        }} />
      </label>
      <label>Nome completo<input required name="name" defaultValue={profile?.fullName} /></label>
      <label>E-mail<input type="email" name="email" defaultValue={profile?.email} /></label>
      <label>Telefone<input type="tel" name="phone" defaultValue={profile?.phone} /></label>
      <label>Experiência e formação<textarea name="summary" defaultValue={profile?.summary} /></label>
      <label>Cargos desejados, separados por vírgulas<input name="roles" defaultValue={list(profile?.targetRolesJson).join(", ")} /></label>
      <label>Competências, separadas por vírgulas<input name="skills" defaultValue={list(profile?.skillsJson).join(", ")} /></label>
      <label>Localidades desejadas<input name="locations" defaultValue={list(profile?.locationsJson).join(", ")} /></label>
      <label>Modalidades de trabalho<input name="modes" placeholder="Remoto, híbrido ou presencial" defaultValue={list(profile?.workModesJson).join(", ")} /></label>
      <label>Salário mínimo<input name="salary" defaultValue={minimum} /></label>
      <button disabled={busy} className="button primary">{busy ? "Salvando…" : "Confirmar e salvar perfil"}</button>
      <p role="status">{message}</p>
    </form><Link href="/jobs">Ver vagas compatíveis</Link><Link href="/admin">Gerenciar conexão com LinkedIn</Link></main>;
}
