"use client";
export default function ApplicationsError({ reset }: { reset: () => void }) {
  return <main className="page-stack"><h1>Não foi possível atualizar a candidatura</h1><p role="alert">Verifique sua sessão e revise o rascunho antes de confirmar o envio. Recarregue para conferir o estado atual.</p><button className="button secondary" onClick={reset}>Recarregar candidaturas</button></main>;
}
