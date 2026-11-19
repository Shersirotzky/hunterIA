import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { collectJobs } from "./actions";
import { Submit } from "../profile/submit";
import { recommended } from "@/convex/jobDomain";
import { Ranking } from "./ranking";
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return <main><a href="/signin">Entre para consultar vagas</a></main>;
  const jobs = await fetchQuery(api.jobs.list, {}, { token });
  const all = (await searchParams).view === "all";
  const visible = all ? jobs : recommended(jobs);
  return <main className="page-stack">
    <h1>Vagas compatíveis</h1>
    <form action={collectJobs} className="panel"><label>Empresa para buscar<input name="board" defaultValue="canonical" list="greenhouse-companies" placeholder="Ex.: canonical" pattern="[a-zA-Z0-9_-]{1,80}" required /></label><datalist id="greenhouse-companies"><option value="canonical">Canonical</option></datalist><Submit>Buscar vagas</Submit><p>Sugestão: Canonical (canonical). Para outra empresa, informe o nome do board público Greenhouse. A busca consulta somente a API pública; não envia candidaturas.</p></form>
    <p>Recomendadas: vagas abertas com pelo menos 85 pontos de 100 possíveis. Ao abrir uma vaga, preparamos uma cópia do seu perfil aprovado e levamos você à revisão da candidatura.</p>
    <nav aria-label="Filtro de vagas"><Link className="button secondary" href="/jobs" aria-current={!all ? "page" : undefined}>Recomendadas (85+)</Link> <Link className="button secondary" href="/jobs?view=all" aria-current={all ? "page" : undefined}>Todas as coletadas</Link></nav>
    {!visible.length && <section className="empty-state"><h2>{all ? "Nenhuma vaga coletada" : "Nenhuma recomendação acima de 85"}</h2><p>{all ? "Busque vagas da Canonical ou informe outra empresa acima." : "Ainda não há evidências suficientes para atingir 85 pontos. Dados desconhecidos valem zero e não significam requisitos não atendidos. Revise o perfil ou veja todas as coletadas."}</p><Link href={all ? "/profile" : "/jobs?view=all"}>{all ? "Revisar perfil" : "Ver todas as coletadas"}</Link></section>}
    {visible.map(job => <article data-testid="job-card" data-job-id={job._id} className="panel" key={job._id}>
      <h2><Link href={`/jobs/${job._id}`}>{job.title}</Link></h2>
      <p>{job.company} · {job.location || "Local desconhecido"} · {job.status}</p>
      <Ranking match={job.match} />
      <p>Fonte: {job.source} · Coleta: {new Date(job.collectedAt).toISOString()}</p>
      <Link className="button primary" href={`/jobs/${job._id}`}>Abrir vaga e revisar candidatura</Link>
      <a className="button secondary" href={job.canonicalUrl} target="_blank" rel="noopener noreferrer">Ver fonte</a>
    </article>)}
    <Link href="/applications">Revisar candidaturas</Link>
  </main>;
}
