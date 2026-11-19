# Integração LinkedIn no Hunter IA

## Diagnóstico

A revisão partiu do commit [8c6afd2](https://github.com/Shersirotzky/hunterIA/commit/8c6afd2c1f3499c1d1310166de19075c2de02402), associado ao deployment de produção da Vercel consultado na auditoria.

| Evidência na revisão original | Efeito |
| --- | --- |
| [`app/admin/page.tsx:4–12`](https://github.com/Shersirotzky/hunterIA/blob/8c6afd2/app/admin/page.tsx#L4-L12) | O painel só lia a identidade de um cookie. Faltavam controle de conexão, handler e estado de carregamento. |
| [`app/signup/page.tsx:43–51`](https://github.com/Shersirotzky/hunterIA/blob/8c6afd2/app/signup/page.tsx#L43-L51) e [`proxy.ts:5–6`](https://github.com/Shersirotzky/hunterIA/blob/8c6afd2/proxy.ts#L5-L6) | O único link iniciava OAuth via GET, mas o proxy mandava visitantes sem sessão para `/signin` antes de executar a rota. O cadastro também aceitava `?linkedin=connected` como indicação de sucesso. |
| [`app/api/auth/linkedin/route.ts:8–13`](https://github.com/Shersirotzky/hunterIA/blob/8c6afd2/app/api/auth/linkedin/route.ts#L8-L13) | Configuração ausente produzia JSON fora do painel, sem mensagem na interface. |
| [`app/api/auth/linkedin/callback/route.ts:18–23`](https://github.com/Shersirotzky/hunterIA/blob/8c6afd2/app/api/auth/linkedin/callback/route.ts#L18-L23) e [linhas 64–76](https://github.com/Shersirotzky/hunterIA/blob/8c6afd2/app/api/auth/linkedin/callback/route.ts#L64-L76) | O cancelamento retornava antes de validar `state`. O sucesso gravava a identidade em um cookie e voltava ao cadastro. Faltava vincular a conta ao usuário autenticado no Convex. |

A ausência de um controle no código do painel explica por que a revisão auditada não tinha um clique a rastrear ali. A implementação do cadastro era um link comum, sem promise de interface, loading ou bloqueio identificado por overlay. A auditoria não reproduziu a sessão privada em produção. A consulta de logs da Vercel pelo termo `linkedin` não retornou registros no intervalo consultado. A Vercel negou acesso às variáveis do projeto e os logs do deployment Convex não estavam disponíveis nesta sessão.

## Alterações

| Arquivos | Alteração |
| --- | --- |
| `app/admin/page.tsx`, `app/components/linkedin-connection.tsx` | Ação explícita no painel autenticado, estados de espera, conexão, expiração, desconexão, erro e nova tentativa. |
| `app/signup/page.tsx`, `app/profile/page.tsx`, `lib/session.ts` | Cadastro continua usando a conta Hunter IA. O perfil aponta para o painel. A indicação baseada no cookie legado e no parâmetro de sucesso do cadastro foi removida. |
| `app/api/auth/linkedin/`, `lib/linkedinRequest.ts`, `proxy.ts` | Rotas Next autenticadas com o token de sessão do Convex Auth, validação da origem do POST e cookie `HttpOnly` temporário. O callback volta ao painel com um resultado fixo, sem repassar o código OAuth. |
| `convex/linkedin.ts`, `convex/linkedinOAuth.ts`, `convex/schema.ts`, `convex/_generated/api.d.ts` | OAuth Authorization Code com OpenID Connect, `state` de uso único vinculado ao usuário, troca de código no backend, validação da assinatura e das claims do ID token com as chaves públicas do LinkedIn. O vínculo usa `externalConnections`. Uma tabela auxiliar registra a tentativa, com hash e validade de dez minutos. |
| `.env.example`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `tests/` | Configuração local, lint compatível com Next 16 e suites automatizadas com mocks. |

O Convex persiste ID interno, identificador do LinkedIn, data de verificação, escopo concedido e expiração da autorização. O painel consulta somente a expiração da própria conexão e calcula seu estado a partir dela. O fluxo descarta tokens após a verificação e nunca solicita senha do LinkedIn. A desconexão remove o vínculo local e invalida tentativas pendentes. Para revogar o consentimento no provedor, remova o Hunter IA nas configurações do LinkedIn. Uma revogação externa após a conexão não é detectada em tempo real porque o Hunter IA não conserva tokens nem faz sincronizações periódicas.

## LinkedIn Developer Portal

1. Em **My Apps → Products**, habilite **Sign In with LinkedIn using OpenID Connect** para o aplicativo Hunter IA.
2. Em **Auth**, confirme que o escopo `openid` está concedido. A integração usa somente esse escopo.
3. Em **Authorized redirect URLs**, cadastre a URL exata do ambiente, incluindo esquema, domínio, porta quando aplicável e caminho.
   - Produção, domínio identificado na Vercel — `https://hunter-ia-two.vercel.app/api/auth/linkedin/callback`.
   - Homologação — `https://<dominio-fixo-de-homologacao>/api/auth/linkedin/callback`.
   - Desenvolvimento local — `http://localhost:3000/api/auth/linkedin/callback`, se o portal aceitar esse endereço para o aplicativo. Caso contrário, use um domínio HTTPS de homologação.
4. Copie o Client ID e registre o Client Secret diretamente nas variáveis privadas do deployment Convex correspondente.

A autenticação permite vincular a conta. Busca de vagas, candidaturas, históricos profissionais e permissões de recrutamento dependem de produtos e permissões específicos do LinkedIn. Consulte o [guia OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) e o [fluxo Authorization Code](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

## Variáveis e ambientes

| Local | Variáveis |
| --- | --- |
| Convex de desenvolvimento, homologação e produção | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` e `LINKEDIN_REDIRECT_URI`. A URI deve apontar para o Next.js daquele ambiente e ser idêntica à registrada no portal. Use [variáveis do deployment Convex](https://docs.convex.dev/production/environment-variables). |
| Next.js local, Vercel Preview e Vercel Production | `NEXT_PUBLIC_CONVEX_URL` aponta para o deployment Convex correspondente. Mantenha `NEXT_PUBLIC_CONVEX_SITE_URL` se for usado por outra configuração. O Next.js não precisa das credenciais do LinkedIn. |

O antigo `APP_SESSION_SECRET` deixou de ser usado por essa integração. Os vínculos que existiam apenas no cookie antigo exigem nova autorização.

## Homologação

1. Use domínio fixo e Convex isolado para homologação. Publique primeiro o schema e as funções Convex desse ambiente, depois o frontend apontando para ele.
2. Faça o fluxo real com duas contas de teste do Hunter IA. Confirme retorno ao painel, persistência após recarregar, cancelamento, desconexão e isolamento entre contas.
3. Verifique a presença das variáveis por nome e a Redirect URI nos ambientes reais. Confira os logs de callback na Vercel e do OAuth no Convex em caso de falha. A disponibilidade do produto, as permissões e as credenciais do LinkedIn ainda precisam de verificação no portal.
4. Libere produção somente após homologação e autorização explícita.

## Repetir as verificações

```bash
npm ci
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 npm run build
PLAYWRIGHT_PRODUCTION=1 npm run test:e2e
```

Vitest usa o schema Convex real no emulador de testes e um provedor simulado com JWT assinado. O Playwright inicia o frontend e um servidor Convex simulado, intercepta a navegação para o LinkedIn e exercita as rotas Next. Nenhuma dessas suítes precisa de credenciais reais. O endereço local usado no build serve apenas à validação.

## Resultado das verificações

| Verificação | Resultado |
| --- | --- |
| ESLint | Concluído sem erros. Três avisos de imagens `<img>` já presentes na interface. |
| TypeScript | Concluído sem erros. |
| Vitest | 13 testes aprovados em duas suítes. |
| Playwright | Cinco testes aprovados em desenvolvimento e os mesmos cinco aprovados no build de produção local, usando Chromium headless. |
| Build Next.js | Concluído com o endereço do Convex simulado. |
| Ambiente real | Domínio de produção e commit ativo conferidos na Vercel. Homologação com consentimento real e inspeção dos logs do Convex seguem pendentes. |
