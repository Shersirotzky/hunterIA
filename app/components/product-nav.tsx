import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { isAuthenticatedNextjs } from "@/lib/convexAuth";

const links = [["Início", "/"], ["Vagas", "/jobs"], ["Candidaturas", "/applications"], ["Perfil", "/profile"]];

export async function ProductNav() {
  const authenticated = await isAuthenticatedNextjs();
  return <nav className="product-nav" aria-label="Navegação principal"><Link className="brand" href="/"><img src="/hunter-ia-logo.png" alt="" />Hunter IA</Link><div className="nav-links">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div><Link className="nav-settings" href="/admin">Configurações</Link>{authenticated ? <SignOutButton /> : <Link className="button secondary" href="/signin">Entrar</Link>}</nav>;
}
