"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSignInWithUsernamePassword, useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { api } from "@/convex/_generated/api";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMode, setLoginMode] = useState(searchParams.get("mode") === "login");
  const linkedinConnected = searchParams.get("linkedin") === "connected";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const signIn = useSignInWithUsernamePassword(api.auth);
  const signUp = useSignUpWithUsernamePassword(api.auth);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = loginMode ? await signIn.signIn({ username, password }) : await signUp.signUp({ username, password });
      if (result.status !== "complete") {
        setError("A autenticação precisa de uma etapa adicional. Siga a instrução exibida pelo provedor.");
        return;
      }
      router.push(loginMode ? "/" : "/profile?onboarding=1");
      router.refresh();
    } catch {
      setError(loginMode ? "Não foi possível entrar. Confira o e-mail e a senha." : "Não foi possível criar a conta. Use um e-mail válido e uma senha com pelo menos 8 caracteres.");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src="/hunter-ia-logo.png" alt="Hunter IA" />
        <span className="eyebrow">ETAPA 1 DE 2</span>
        <h1>{loginMode ? "Entre no seu espaço" : "Crie sua conta"}</h1>
        <p className="muted">{loginMode ? "Use seu e-mail e senha para continuar." : "Use seu Gmail ou qualquer outro e-mail. Depois você confirma seu perfil profissional."}</p>
        {linkedinConnected && <p className="notice">LinkedIn conectado. Crie ou acesse sua conta Hunter IA para vincular essa identidade ao seu perfil profissional.</p>}
        <form onSubmit={submit} className="auth-form">
          <label>E-mail<input type="email" autoComplete="email" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Senha<input type="password" autoComplete={loginMode ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="button primary" type="submit" disabled={signIn.pending || signUp.pending}>{loginMode ? "Entrar" : "Criar conta"}</button>
        </form>
        <div className="auth-divider"><span>ou</span></div>
        <a className="button secondary auth-main-button" href="/api/auth/linkedin">Continuar com LinkedIn</a>
        <p className="auth-footnote">O LinkedIn complementa o perfil com os dados básicos autorizados. O histórico profissional completo precisa ser conferido no currículo.</p>
        <button className="text-button" type="button" onClick={() => { setLoginMode(!loginMode); setError(null); }}>{loginMode ? "Ainda não tenho conta" : "Já tenho uma conta"}</button>
        <Link className="auth-back" href="/">Voltar ao início</Link>
      </div>
    </main>
  );
}
