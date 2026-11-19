# Hunter IA

Assistente de carreira multiusuário em Next.js, React, TypeScript e Convex.

## Desenvolvimento

1. `npm ci`
2. Configure as variáveis de `.env.example` em `.env.local` sem versionar segredos.
3. `npx convex dev` — configure um deployment **local** para testes simulados.
4. `npm run dev`

Produção usa `https://compassionate-swan-798.convex.cloud`. A URL antiga `trustworthy-capybara-295` não é o destino de produção usado pelo frontend atual.

## Fluxos

- E-mail/senha continua disponível; LinkedIn usa a mesma sessão Convex, com identidade estável por candidato.
- Perfil importado exige revisão. Campos desconhecidos são completados pelo candidato, sem inventar fatos.
- Vagas consultadas por APIs públicas permitidas. Greenhouse suporta leitura; envio integrado requer credencial da empresa e não é habilitado sem ela.
- Rascunhos guardam os dados usados. Abrir ou preparar não comprova envio. Encaminhamento externo e confirmação do candidato são identificados separadamente.
- Perfil, consultas, mutations e arquivos validam o proprietário autenticado. A apresentação e login podem ser públicos; dados profissionais permanecem privados.
- Arquivos pessoais em `private/` e `.env.*.local` são excluídos do Git e do deploy.

## Verificação

- `npm run typecheck`
- `npm test`
- `npm run test:e2e` (deployment local; nunca usa empresas reais para inscrições)
- `npm run test:auth-backend` (backend local ativo)
- `npm run build`

Veja [autenticação LinkedIn](docs/linkedin-auth.md) e [ranking e fontes](app/jobs/RANKING.md). Importações de currículo preservam o original privado e apresentam o texto para conferência. OCR e enriquecimento completo de histórico via LinkedIn não são presumidos.

A busca automática agendada e o envio automático continuam desativados. O endpoint de cron protegido informa esse estado; este fluxo entrega busca e candidatura assistidas, com consentimento explícito do candidato.
