import { LinkedInConnection } from "../components/linkedin-connection";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ linkedin?: string | string[] }> }) {
  const { linkedin } = await searchParams;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px" }}>
      <p style={{ color: "#a1a1aa", margin: 0 }}>ÁREA ADMINISTRATIVA PRIVADA</p>
      <h1 style={{ fontSize: 40, margin: "8px 0 12px" }}>Configurar Hunter IA</h1>
      <LinkedInConnection outcome={typeof linkedin === "string" ? linkedin : undefined} />

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 32 }}>
        <article style={{ border: "1px solid #27272a", borderRadius: 16, padding: 20, background: "#18181b" }}>
          <h2 style={{ marginTop: 0 }}>Perfil profissional</h2>
          <p style={{ color: "#a1a1aa", lineHeight: 1.5 }}>Currículo, histórico, competências, idiomas e preferências de vaga.</p>
          <strong>Importação pendente</strong>
        </article>
        <article style={{ border: "1px solid #27272a", borderRadius: 16, padding: 20, background: "#18181b" }}>
          <h2 style={{ marginTop: 0 }}>Busca programada</h2>
          <p style={{ color: "#a1a1aa", lineHeight: 1.5 }}>Horários padrão: 09:00 e 17:00, America/Fortaleza.</p>
          <strong>Desativada até configurar fontes</strong>
        </article>
        <article style={{ border: "1px solid #27272a", borderRadius: 16, padding: 20, background: "#18181b" }}>
          <h2 style={{ marginTop: 0 }}>Candidaturas</h2>
          <p style={{ color: "#a1a1aa", lineHeight: 1.5 }}>Limite compartilhado inicial: 10 por dia. Envio automático permanece pausado.</p>
          <strong>Revisão necessária</strong>
        </article>
      </section>

      <section style={{ marginTop: 32, border: "1px solid #7f1d1d", borderRadius: 16, padding: 20, background: "#1c1111" }}>
        <h2 style={{ marginTop: 0 }}>Próximo passo</h2>
        <p style={{ color: "#fecaca", lineHeight: 1.6 }}>
          Envie seu currículo e confira os dados profissionais antes de ativar qualquer candidatura. O sistema não inventará informações nem enviará inscrições enquanto o perfil não estiver aprovado.
        </p>
      </section>
    </main>
  );
}
