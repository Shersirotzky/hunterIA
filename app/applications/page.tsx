import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { ApplicationReview } from "./review";
export default async function ApplicationsPage() {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return <main><a href="/signin">Entre para revisar candidaturas</a></main>;
  const rows = await fetchQuery(api.jobs.applications, {}, { token });
  return <main className="page-stack"><h1>Candidaturas assistidas</h1><p>Revise contato, experiência, respostas e currículo. Prossiga no site da empresa e confirme o envio com evidência. Nenhum formulário externo é enviado automaticamente.</p>{!rows.length && <a href="/jobs">Buscar vagas</a>}{rows.map(row => <ApplicationReview key={row._id} row={row} />)}</main>;
}
