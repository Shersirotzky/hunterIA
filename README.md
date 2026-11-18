# Hunter IA

Aplicação privada para descoberta, análise e acompanhamento de oportunidades profissionais.

## Estado atual

Fase 1 iniciada com Next.js, TypeScript e schema Convex. O deployment informado é:

- Cloud: `https://trustworthy-capybara-295.convex.cloud`
- HTTP Actions: `https://trustworthy-capybara-295.convex.site`

O endpoint HTTP atualmente responde que não há HTTP Actions habilitadas. A autenticação e as integrações externas permanecem bloqueadas até o deployment ser configurado.

## Validação da fundação

- TypeScript direto: aprovado.
- `next build --webpack`: aprovado.
- `npm audit --omit=dev`: 0 vulnerabilidades conhecidas.
- Build Turbopack: bloqueado pelo ambiente local ao tentar abrir uma porta durante o processamento de CSS; Webpack foi usado como validação equivalente.

## Segurança inicial

- O dashboard deve permanecer privado.
- `OWNER_USER_ID` será a única identidade autorizada.
- O limite padrão é de 10 candidaturas por dia.
- A compatibilidade mínima padrão é 85.
- O fuso padrão é `America/Fortaleza`.
- Automação começa pausada até uma plataforma ser explicitamente allowlisted.

## Verificação local

O ambiente original não possuía `npm`; foi usado um npm local temporário para instalar as dependências e validar a fundação. O diretório `.tools/` é ignorado pelo Git.
