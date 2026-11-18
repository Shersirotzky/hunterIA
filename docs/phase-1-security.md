# Fase 1 — Segurança e acesso

## Regras obrigatórias

1. O deployment público não deve expor páginas autenticadas.
2. Apenas `OWNER_USER_ID` pode consultar ou alterar dados operacionais.
3. O valor padrão de `automationsPaused` é `true`.
4. O limite diário padrão é 10 candidaturas.
5. O score mínimo padrão é 85.
6. O fuso usado para limites e agendamentos é `America/Fortaleza`.
7. Nenhum segredo pode usar prefixo `NEXT_PUBLIC_`.
8. Nenhuma candidatura automática é habilitada sem allowlist de plataforma e evidência de autorização.

## Estado atual

O schema Convex já contém configurações do proprietário, pausa global, limite diário, matching, candidaturas e auditoria. A validação de identidade ainda depende da configuração de autenticação do deployment Convex.

O endpoint fornecido informa que as HTTP Actions ainda não estão habilitadas. Essa configuração precisa ser corrigida antes de ativar OAuth, webhooks ou integrações externas.
