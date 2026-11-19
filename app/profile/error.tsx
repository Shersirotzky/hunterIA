"use client";
export default function ProfileError({ reset }: { reset: () => void }) {
  return <main className="page-stack"><h1>Não foi possível carregar ou aprovar seu perfil</h1><p role="alert">Verifique sua sessão e tente novamente.</p><button className="button secondary" onClick={reset}>Recarregar perfil</button></main>;
}
