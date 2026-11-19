import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { AutoPrepare } from "../auto-prepare";
import { Ranking } from "../ranking";
import styles from "../../profile/forms.module.css";
export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return <main><a href="/signin">Entre para consultar esta vaga</a></main>;
  const { id } = await params;
  const detail = await fetchQuery(api.jobs.detail, { jobId: id as Id<"jobs"> }, { token });
  if (!detail) notFound();
  const { job } = detail;
  return <main className="page-stack">
    <Link href="/jobs">Voltar às vagas</Link><h1>{job.title}</h1><p>{job.company} · {job.location || "Local desconhecido"} · {job.status}</p>
    <section className="panel"><Ranking match={detail.match} /><p>Fonte: {job.source} · Coleta: {new Date(job.collectedAt).toISOString()}</p><a href={job.canonicalUrl} target="_blank" rel="noopener noreferrer">Ver publicação original</a></section>
    <section className={`panel ${styles.form}`}><h2>Descrição publicada</h2><pre>{job.description || "Descrição não fornecida pela fonte. Confira a publicação original."}</pre></section>
    {detail.applicationId ? <AutoPrepare jobId={job._id} existingId={detail.applicationId} /> : !detail.profileApproved ? <Link className="button primary" href="/profile">Complete e aprove seu perfil para preparar a candidatura</Link> : job.status !== "open" ? <p>Esta vaga não está aberta para preparação.</p> : <AutoPrepare jobId={job._id} />}

  </main>;
}
