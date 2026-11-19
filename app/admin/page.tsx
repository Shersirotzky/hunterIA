import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
export default async function SettingsPage() {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return <Link href="/signin">Entre para configurar sua conta</Link>;
  const account = await fetchQuery(api.identity.current, {}, { token });
  return <main className="page-stack"><h1>Configurações da conta</h1><section className="panel"><h2>LinkedIn</h2><p>{account.linkedinConnected ? "Identidade conectada à sua conta Hunter." : "Você pode usar e-mail e senha e conectar seu LinkedIn quando quiser."}</p><a className="button secondary" href="/api/auth/linkedin?mode=connect">{account.linkedinConnected ? "Reconectar LinkedIn" : "Conectar LinkedIn"}</a><p>Reconectar preserva currículo, preferências e histórico.</p></section><section className="panel"><h2>Candidatura assistida</h2><p>As candidaturas são preparadas para sua revisão. A conclusão em plataformas externas deve ser confirmada por você. Nenhum envio automático está habilitado.</p><Link href="/profile">Revisar meu perfil</Link></section></main>;
}
