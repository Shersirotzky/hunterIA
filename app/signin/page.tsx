import Link from "next/link";

import { LinkedInLogin } from "../components/linkedin-login";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ linkedin?: string }> }) {
  const { linkedin } = await searchParams;
  const error = linkedin === "cancelled" ? "Você cancelou o acesso pelo LinkedIn."
    : linkedin === "configuration" ? "O login pelo LinkedIn aguarda a configuração das credenciais. Você pode entrar com e-mail."
    : linkedin ? "O LinkedIn não confirmou o acesso. Tente novamente ou entre com e-mail." : null;
  return (
    <main className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src="/hunter-ia-logo.png" alt="Hunter IA" />
        <span className="eyebrow">HUNTER IA</span>
        <h1>Entre no seu espaço</h1>
        <p className="muted">Acesse sua conta com o e-mail usado no cadastro.</p>
        {error && <p role="alert">{error}</p>}
        <LinkedInLogin />
        <Link className="button primary auth-main-button" href="/signup">Criar conta</Link>
        <Link className="button secondary auth-main-button" href="/signup?mode=login">Entrar com e-mail</Link>

      </div>
    </main>
  );
}
