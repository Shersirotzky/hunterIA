"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

export default function JobsPage() {
  const jobs = useQuery(api.career.jobs);
  const sync = useAction(api.career.syncBoard);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const add = useMutation(api.career.addJob);
  const prepare = useMutation(api.career.prepare);
  const router = useRouter();
  const [error, setError] = useState("");
  return <main className="page-stack"><h1>Vagas compatíveis</h1>
    <form className="panel auth-form" onSubmit={async e => {
      e.preventDefault();
      const board = String(new FormData(e.currentTarget).get("board") ?? "");
      setBusy(true); setNotice("");
      try { const count = await sync({ board }); setNotice(count + " vagas no mural consultado."); }
      catch { setNotice("Confira o identificador do mural e tente novamente."); }
      finally { setBusy(false); }
    }}>
      <label>Mural público Greenhouse da empresa<input name="board" required placeholder="Identificador do mural" /></label>
      <button className="button secondary" disabled={busy}>{busy ? "Buscando…" : "Buscar vagas"}</button>
      <span role="status">{notice}</span>
    </form>
    <details className="panel"><summary>Adicionar vaga</summary>
      <form className="auth-form" onSubmit={async e => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = new FormData(form);
        const read = (key: string) => String(fields.get(key) ?? "").trim();
        try {
          await add({ title: read("title"), company: read("company"), url: read("url"),
            skills: read("skills").split(",").map(s => s.trim()).filter(Boolean) });
          form.reset(); setError("");
        } catch { setError("Confira o título, a empresa e o link HTTPS da vaga."); }
      }}>
        <label>Cargo<input required name="title" /></label><label>Empresa<input required name="company" /></label>
        <label>Link da vaga<input required type="url" name="url" /></label>
        <label>Competências exigidas, separadas por vírgulas<input name="skills" /></label>
        <button className="button secondary">Salvar vaga</button>
      </form></details>
    {error && <p role="alert">{error}</p>}
    {jobs === undefined ? <p>Carregando vagas…</p> : jobs.length === 0 ? <p>Adicione sua primeira vaga para comparar com o perfil.</p> : jobs.map(job =>
      <article key={job._id} className="panel"><h2>{job.title}</h2><p>{job.company}</p>
        <strong>{job.score === null ? "Perfil insuficiente para calcular" : job.score + (job.inferred ? "% do perfil citado na vaga" : "% dos critérios informados")}</strong>
        {job.role && <p>Cargo desejado compatível: {job.role}</p>}
        {!!job.matched.length && <p>Competências em comum: {job.matched.join(", ")}</p>}
        {!!job.missing.length && <p>Ausentes no perfil: {job.missing.join(", ")}</p>}
        <button className="button primary" onClick={async () => {
          try { await prepare({ jobId: job._id }); router.push("/applications"); }
          catch { setError("Antes de preparar a candidatura, confirme e salve seu perfil profissional."); }
        }}>Preparar candidatura</button>
      </article>)}</main>;
}
