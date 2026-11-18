import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src="/hunter-ia-logo.png" alt="Hunter IA" />
        <span className="eyebrow">HUNTER IA</span>
        <h1>Entre no seu espaço</h1>
        <p className="muted">Acesse sua conta com o e-mail usado no cadastro.</p>
        <Link className="button primary auth-main-button" href="/signup">Criar conta</Link>
        <Link className="button secondary auth-main-button" href="/signup?mode=login">Entrar com e-mail</Link>
        <p className="auth-footnote">Ainda não possui uma conta? Use o primeiro botão para começar.</p>
      </div>
    </main>
  );
}
