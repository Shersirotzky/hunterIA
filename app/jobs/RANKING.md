# Ranking determinístico v2

Perfil, vagas e candidaturas pertencem ao userId estável resolvido por `requireOwner`. Não se usa `identity.subject` como proprietário. O ranking não usa modelos, aparência, dados sensíveis ou qualificações inferidas.

## Pontuação e cobertura

Denominador fixo de **100 pontos**, com estes pesos:

| Critério | Peso | Comparação |
| --- | ---: | --- |
| Cargo | 35 | Cargo desejado contido no título |
| Habilidades | 25 | Proporção de habilidades distintas citadas no título/descrição |
| Local | 10 | Local desejado contido no local publicado |
| Senioridade | 10 | Nível explicitamente informado nos dois lados |
| Modalidade | 10 | Preferências explícitas e modalidade estruturada da vaga |
| Idiomas | 5 | Idiomas e, quando publicados, níveis exigidos |
| Experiência | 5 | Anos informados no perfil >= mínimo estruturado da vaga |

A soma é arredondada ao inteiro mais próximo. `knownWeight` é a soma dos pesos avaliáveis (cobertura/confiança na disponibilidade dos dados), separada do score. **Desconhecido vale zero pontos e mantém estado `unknown`; não vira requisito não atendido.** `not_matched` exige dados conhecidos dos dois lados e comparação sem correspondência. Exemplos: só cargo correspondente = 35 pontos/cobertura 35%; cargo, todas as habilidades e local correspondentes = 70 pontos/cobertura 70%, não 100.

Recomendadas mostra somente vagas abertas com score >= **85**. Metadata ausente pode limitar a cobertura a 70 e produzir um estado vazio. Todas as coletadas permanecem acessíveis na outra aba; não se inventam dados para preencher recomendações. Empates: fonte e sourceId, em ordem lexicográfica.

Comparações ignoram caixa e acentos. Aliases explícitos normalizam Júnior/Junior, Pleno/Mid, Sênior/Senior, Remoto/Remote, Híbrido/Hybrid, Presencial/Onsite e nomes conhecidos de idiomas. Níveis de idioma usam uma escala documentada no código (básico até nativo). Idioma exigido com nível desconhecido no perfil fica unknown; mínimo de anos ausente fica unknown. Habilidades sem descrição suficiente ficam unknown quando não é possível avaliar a lista. Salário e autorização de trabalho são exibidos como não avaliados e não têm peso. Não há inferência de anos a partir de períodos sobrepostos ou de senioridade a partir de texto livre.

## Fontes e formulários

Busca GET pública: `https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true`. Canonical (`canonical`) é a sugestão inicial, com board configurável. Dados estruturados adicionais são lidos apenas de metadata com chaves reconhecidas. Descrições têm tags removidas e limite de 30 mil caracteres; o usuário pode consultar o original.

Perguntas GET públicas: `https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true`. Cada pergunta guarda label, campos, opções e obrigatoriedade. Respostas sugeridas usam contato e currículo do perfil aprovado ou respostas frequentes com texto de pergunta idêntico. **Dados sensíveis, consentimentos e múltipla escolha não são inferidos.** Falha na leitura mantém perguntas unknown; não equivale a formulário sem obrigatórios. Anexo específico que o preparador não suporta permanece pendente e impede aprovação local.

Não existe POST para Greenhouse nem employer API key. Toda candidatura externa ocorre no site da empresa.

## Revisão e snapshots

Abrir a página GET não grava. Após hidratação, um POST autenticado prepara a candidatura de forma idempotente por proprietário/vaga e redireciona à revisão; o cliente protege a chamada com useRef e o backend usa consulta/inserção na mesma transação. Reabrir reutiliza a candidatura. O snapshot original guarda contato, experiência, formação, habilidades, respostas, currículo e perguntas; edições geram uma cópia revisada e não alteram o original.

Nome, e-mail válido, texto do currículo, rascunho e perguntas públicas obrigatórias são validados na revisão. Currículo pode vir da cópia do perfil, de texto personalizado ou do importador revisado PDF/DOCX/TXT; trocar texto existente exige confirmação. Referências ao documento original têm checagem de proprietário. O original é baixado pela rota autenticada privada do importador.

Respostas frequentes são editadas em linhas `Pergunta da empresa: resposta`. O parser divide no primeiro dois-pontos, recusa linhas incompletas e perguntas duplicadas e armazena pares question/answer. Dados estruturados existentes não alterados são preservados byte a byte. Respostas sensíveis continuam exigindo resposta explícita na candidatura.

“Continuar no site da empresa” registra `forwardedAt` por POST interno e então abre o destino externo. Estado persistido ready; rótulo derivado **Aguardando conclusão externa**. Somente confirmação explícita com evidência registra confirmed/submittedAt; evidência é autodeclarada. Repetir a mesma confirmação é idempotente.

## Verificação

`node --test tests/job-domain.test.mjs tests/profile-domain.test.mjs` testa pesos, cobertura, unknown, cutoff, perguntas, respostas e snapshots. O carregador transpila em ES2022 para preservar iteração de Set.

`tests/assisted.spec.ts` cobre formulário humano, snapshot, GET sem gravação, abrir com duplo clique/reabrir sem duplicar, obrigatórios e destino externo sem confirmação de envio. Antes de inserir fixture, exige CONVEX_DEPLOYMENT local e URL loopback e usa explicitamente `--deployment local`; recusa deploy key. E2E/build/codegen são executados pelo responsável pela integração, conforme coordenação do workspace.
