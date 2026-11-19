"use client";

import { useEffect, useState } from "react";

const endpoint = "/api/auth/linkedin";
const messages = new Map([
  ["session", "Sua sessão do Hunter IA expirou. Entre novamente para conectar o LinkedIn."],
  ["configuration", "A integração precisa de configuração. Confira o produto Sign In with LinkedIn using OpenID Connect, o escopo openid, as credenciais e o endereço de retorno."],
  ["cancelled", "Você cancelou a autorização do LinkedIn. Pode tentar de novo quando quiser."],
  ["invalid_state", "A tentativa de conexão é inválida ou expirou. Inicie outra pelo botão."],
  ["expired", "A autorização do LinkedIn expirou ou foi revogada. Inicie uma nova conexão."],
  ["provider", "O LinkedIn não confirmou a autorização. Tente novamente."],
  ["backend", "O Hunter IA não conseguiu consultar o Convex. Tente novamente."],
]);

export function LinkedInConnection({ outcome }: { outcome?: string }) {
  const [expiresAt, setExpiresAt] = useState<number | null>();
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState<"connect" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(messages.get(outcome ?? "") ?? null);
  const [statusError, setStatusError] = useState(false);
  const [statusAttempt, setStatusAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(messages.get(data.error) ?? messages.get("backend"));
      if (data.expiresAt !== null && typeof data.expiresAt !== "number") throw new Error(messages.get("backend"));
      setExpiresAt(data.expiresAt);
      setStatusError(false);
      setNow(Date.now());
      if (outcome === "connected" && data.expiresAt > Date.now()) setMessage("Conexão com o LinkedIn confirmada.");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setStatusError(true);
        setMessage(error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError)
          ? error.message : messages.get("backend")!);
      }
    });
    return () => controller.abort();
  }, [outcome, statusAttempt]);

  useEffect(() => {
    if (expiresAt == null || now === null || expiresAt <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(expiresAt - now, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [expiresAt, now]);

  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setPending(null);
      setStatusAttempt((value) => value + 1);
    }
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function update(operation: "connect" | "disconnect") {
    setPending(operation);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation }),
      });
      if (response.redirected) throw new Error(messages.get("session"));
      const data = await response.json();
      if (!response.ok) throw new Error(messages.get(data.error) ?? "Não foi possível atualizar a conexão.");
      if (operation === "connect") {
        window.location.assign(data.url);
        return;
      }
      setExpiresAt(null);
      setMessage("LinkedIn desconectado do Hunter IA.");
    } catch (error) {
      setMessage(error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError)
        ? error.message : messages.get("backend")!);
    }
    setPending(null);
  }

  const connected = expiresAt != null && now !== null && expiresAt > now;
  return (
    <article className="panel" aria-busy={pending !== null || (expiresAt === undefined && !statusError)}>
      <h2>LinkedIn</h2>
      <p>Vincule a identidade da sua conta do LinkedIn ao seu perfil do Hunter IA.</p>
      {expiresAt === undefined ? (
        statusError
          ? <button type="button" className="button secondary" onClick={() => {
            setStatusError(false);
            setMessage(null);
            setStatusAttempt((value) => value + 1);
          }}>Tentar novamente</button>
          : <p>Consultando conexão…</p>
      ) : (
        <div className="action-row">
          {connected ? <strong>LinkedIn conectado</strong> : (
            <button type="button" className="button primary" disabled={pending !== null} onClick={() => void update("connect")}>
              {pending === "connect" ? "Conectando…" : expiresAt === null ? "Conectar LinkedIn" : "Reconectar LinkedIn"}
            </button>
          )}
          {expiresAt !== null && (
            <button type="button" className="button secondary" disabled={pending !== null} onClick={() => void update("disconnect")}>
              {pending === "disconnect" ? "Desconectando…" : "Desconectar LinkedIn"}
            </button>
          )}
        </div>
      )}
      <p role="status" aria-live="polite">{message}</p>
    </article>
  );
}
