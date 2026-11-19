"use client";
export default function JobsError({ reset }: { reset: () => void }) {
  return <main className="page-stack"><h1>Não foi possível carregar ou atualizar as vagas</h1><p role="alert">Verifique sua sessão, o identificador do board e a disponibilidade do Greenhouse. A operação pode já ter sido concluída; recarregue antes de tentar novamente.</p><button className="button secondary" onClick={reset}>Tentar novamente</button></main>;
}
