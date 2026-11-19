export function LinkedInLogin() {
  return <form action="/api/auth/linkedin/login" method="post">
    <button className="button secondary auth-main-button" type="submit">Continuar com LinkedIn</button>
    <p className="auth-footnote">No primeiro acesso, criaremos sua conta e importaremos os dados básicos autorizados.</p>
  </form>;
}
