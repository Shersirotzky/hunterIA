"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ApplicationsPage() {
  const rows = useQuery(api.career.drafts);
  return <main className="page-stack"><h1>Candidaturas</h1>
    {rows === undefined ? <p>Carregando candidaturas…</p> : !rows.length ? <p>Nenhuma candidatura preparada.</p> :
      rows.map(({ id, draft, title, url }) => <article key={id} className="panel">
        <h2>{title}</h2><p>Rascunho para revisão</p>
        <dl>{Object.entries({ Nome: draft.name, "E-mail": draft.email, Telefone: draft.phone,
          Localidades: draft.locations?.join(", "), Modalidades: draft.modes?.join(", "), Cargos: draft.roles?.join(", "),
          Experiência: draft.summary, Competências: draft.skills.join(", ") }).map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{value || "Pendente"}</dd></div>)}</dl>
        <button type="button" className="button secondary" onClick={async () => {
          const { resumeDocument } = await import("@/lib/resume");
          const file = resumeDocument([draft.name, draft.email, draft.phone, draft.summary, draft.skills.join(", ")]);
          const href = URL.createObjectURL(file);
          const link = document.createElement("a");
          link.href = href; link.download = "curriculo.docx"; link.click();
          window.setTimeout(() => URL.revokeObjectURL(href), 1000);
        }}>Baixar currículo preenchido</button>
        {url?.startsWith("https://") && <a className="button secondary" href={url} rel="noreferrer" target="_blank">Abrir candidatura na plataforma</a>}
      </article>)}<Link href="/jobs">Ver vagas</Link></main>;
}
