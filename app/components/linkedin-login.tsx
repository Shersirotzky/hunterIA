"use client";

import { useEffect, useRef, useState } from "react";

export function LinkedInLogin() {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    function reset() {
      submitting.current = false;
      setPending(false);
    }
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return <form action="/api/auth/linkedin/login" method="post" onSubmit={(event) => {
    if (submitting.current) {
      event.preventDefault();
      return;
    }
    submitting.current = true;
    setPending(true);
  }}>
    <button className="button secondary auth-main-button" type="submit" disabled={pending}>
      {pending ? "Abrindo LinkedIn…" : "Continuar com LinkedIn"}
    </button>
    <p className="auth-footnote">No primeiro acesso, criaremos sua conta e importaremos os dados básicos autorizados.</p>
  </form>;
}
