"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareOnOpen } from "./actions";
export function AutoPrepare({ jobId, existingId }: { jobId: string; existingId?: string }) {
  const started = useRef(false);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (existingId) { router.replace(`/applications#${existingId}`); return; }
    void prepareOnOpen(jobId).then(id => router.replace(`/applications#${id}`)).catch(cause => {
      started.current = false;
      setError(cause instanceof Error ? cause.message : "Não foi possível preparar o rascunho.");
    });
  }, [attempt, jobId, existingId, router]);
  return <section className="panel" aria-label="Preparação da candidatura">{error ? <><p role="alert">{error}</p><button type="button" className="button primary" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Tentar preparar novamente</button></> : <p role="status">Preparando sua candidatura para revisão… Nenhum envio externo será realizado.</p>}</section>;
}
