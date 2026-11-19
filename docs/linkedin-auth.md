# LinkedIn, contas e validação

A aplicação mantém os componentes Convex Auth 2.0.0 de senha e username. IDs e senhas existentes não são recriados. O método LinkedIn usa o núcleo da mesma biblioteca para emitir as sessões, incluindo renovação e logout. A API interna `bindMethod` foi isolada em `convex/auth.ts`, com versão fixada e condição de tipos `convex-auth-internal-types`; alterações da biblioteca exigem repetir a suíte de autenticação.

## Fluxo

1. Login e cadastro iniciam em `/api/auth/linkedin`, público. O modo `?mode=connect` exige uma conta Hunter autenticada. Estado, nonce, data e identidade de vínculo ficam em cookie criptografado, HttpOnly, SameSite Lax, por dez minutos.
2. Callback público `/api/auth/linkedin/callback` verifica estado, validade e nonce; troca o código exclusivamente no servidor. Valida a assinatura RS256 do ID token com JWKS oficial, issuer, audience, expiração e o mesmo subject no userinfo.
3. Next.js assina uma assertion HS256 destinada exclusivamente ao backend, válida por sessenta segundos. A assertion e os tokens externos não vão ao navegador. O Convex valida assinatura, issuer, audience e expiração e consome atomicamente o identificador único para impedir replay.
4. A identidade LinkedIn é associada ao ID estável do usuário. Contas são reconhecidas pelo subject do provedor; nunca pelo nome. Colisão com e-mail de conta por senha exige autenticar primeiro nessa conta e conectar. Vínculo a identidade já pertencente a outra conta é recusado. Não há mesclagem automática.
5. Convex Auth emite a sessão normal. O callback usa o escritor de cookies da biblioteca. Conta pendente abre `/profile?onboarding=1`; perfil aprovado abre `/`. Todos os dados usam `getAuthUserId`, que resolve a sessão na biblioteca, em vez de usar `identity.subject` (ID da sessão).
6. Reimportação preenche apenas nome e e-mail ausentes; preserva campos e aprovação do perfil já revisado. Dados profissionais completos são editados/importados, não prometidos pelo OAuth.

## Configuração

Vercel: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `APP_SESSION_SECRET`, `LINKEDIN_BRIDGE_SECRET`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`.
Convex: mesmo `LINKEDIN_BRIDGE_SECRET`. Nunca usar o segredo de teste em produção.
Callback publicado: `https://hunter-ia-two.vercel.app/api/auth/linkedin/callback`. Deve constar exatamente em Authorized redirect URLs, aba Auth do aplicativo LinkedIn. Produto exigido: Sign In with LinkedIn using OpenID Connect. Scopes: `openid profile email`.

O código importa subject, nome e e-mail autorizado. Email pode faltar; não é inferido. Não solicita experiências ou acesso a busca de vagas. O aplicativo de desenvolvedor é configurado pela operação, não pelo candidato.

## Migração

`migration:migrateSessionOwners` é uma mutation interna operacional. Resolve somente vínculos atestados pelo componente original de sessões; mantém linhas sem sessão recuperável intactas para análise, sem transferir dados a novos cadastros. Não apaga dados nem contas. Contadores retornam migrações e registros pendentes. Execute antes de promover o frontend quando houver dados legados.

## Testes locais e produção

`npx convex dev` mantém o deployment local ativo. No macOS, se o ambiente usar um TMPDIR muito longo, use `mkdir -p /tmp/hunter-convex` e `TMPDIR=/tmp/hunter-convex npx convex dev` para respeitar o limite do caminho de sockets. A configuração Playwright aplica esse diretório ao iniciar seu backend local. `npm run test:e2e` usa somente esse backend, um provedor OAuth RS256 simulado em loopback e um servidor Next.js de desenvolvimento. A configuração se recusa a executar fixtures se a seleção não for local. O provedor simulado é desabilitado em builds de produção e não existe rota de bypass no aplicativo.

Os testes simulados não equivalem a consentimento real no LinkedIn. A verificação real exige que o titular autorize na janela do provedor. Após autorizar pela primeira vez, deve ver nome/e-mail autorizados em Revisar meu perfil; após aprovação e novo login, deve manter a mesma conta e histórico.

Fontes oficiais: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2 e https://docs.convex.dev/auth/convex-auth.

## Limites das plataformas

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html): leitura pública de vagas/perguntas. O POST de candidatura exige chave do Job Board da empresa. Sem essa credencial, Hunter prepara a candidatura e encaminha ao site original; não anuncia envio integrado disponível.
- [Gupy: autenticação](https://developers.gupy.io/v2.0/docs/autentica%C3%A7%C3%A3o-recrutamento-sele%C3%A7%C3%A3o) e [captação externa](https://developers.gupy.io/docs/fluxo-de-capta%C3%A7%C3%A3o-de-pessoas-candidatas-em-plataformas-externas): o fluxo oficial usa token da organização, gerenciado por administrador com permissão. Login pessoal LinkedIn não concede essa credencial. Nenhum adaptador Gupy foi habilitado neste projeto.
- LinkedIn OIDC autentica e fornece dados básicos; não concede busca de vagas nem envio de candidaturas. Tokens externos são descartados após a autenticação validada, pois nenhuma função implementada precisa conservá-los.
