import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import { Editor } from "./editor";
import { Submit } from "./submit";
import { approveProfile } from "./actions";
export default async function ProfilePage() {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return <main className="page-stack"><h1>Perfil profissional</h1><a href="/signin">Entre para editar seu perfil</a></main>;
  const profile = await fetchQuery(api.profile.get, {}, { token });
  return <main className="page-stack"><h1>Seu perfil profissional</h1><p>Estado do perfil: {profile?.sourceStatus === "approved" ? "Aprovado" : "Aguardando revisão"}</p><a className="button secondary" href="/api/auth/linkedin?mode=connect">Conectar LinkedIn</a><section className="panel"><Editor profile={profile} /></section>{profile && <form action={approveProfile}><Submit>Revisei e aprovo este perfil</Submit></form>}</main>;
}
