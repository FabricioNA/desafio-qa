# Decisões de teste

## O que foi automatizado e em qual camada

A suíte segue a pirâmide de testes: a regra de negócio é validada na **API** (rápida e estável) e a interface só
valida o que o usuário vê e o comportamento dos componentes.

| Camada | Pasta | Técnica | O que valida |
|---|---|---|---|
| API | `tests/api/<domínio>/*.test.js` | `cy.request` | Contratos (schema), **matriz de permissões perfil × endpoint**, isolamento entre autorizadas e injeção de `authorizedId`, validações, valores limite, entradas malformadas, unicidade de e-mail, telefone por país, filtros e paginação, idioma/picklists, token e sessão (inclusive expiração no tempo), exposição de dados sensíveis, SLA de 2 s |
| UI | `tests/desafio-qa/<Contexto>/<Contexto>.test.js` | Cypress + `cy.intercept` | Menu por perfil, formulários (mensagens de erro, sucesso, máscara de telefone), listagens, paginação e filtros, idioma exibido, estados de erro (mock 4xx/5xx), sessão expirada, renderização segura de texto (HTML não é executado) |

## Priorização por risco

As regras foram agrupadas por impacto e as camadas escolhidas conforme o risco. Segurança e isolamento de dados
pesam mais que apresentação, e por isso concentram a maior parte dos testes de API.

| Prioridade | Regras | Por quê | Onde se concentra |
|---|---|---|---|
| **P0 — crítico** | RN01 acesso por perfil, RN04 isolamento, RN06 consulta, RN11 unicidade, RN13 restrição por país, RN14 sessão | Falha permite acesso indevido, alteração não autorizada ou vazamento entre empresas | `permissions/`, `isolation/`, `auth/` (API) + redirecionamentos e sessão (UI) |
| **P1 — alto** | RN03 autorizadas, RN05 funcionários, RN09 validações, RN10 telefone, RN12 produtos | Integridade dos cadastros e dos fluxos principais | `authorizeds/`, `employees/`, `contacts/`, `products/`, `robustness/` (API) + formulários (UI) |
| **P2 — funcional** | RN02 menu, RN07 idioma, RN08 listas de valores | Consistência da experiência | `picklists/` (API) + `MenuAndAccess`, rótulos e idioma (UI) |

## API × UI: esconder na tela não é segurança

Ocultar um botão ou item de menu não impede a chamada direta ao backend. Por isso as regras de autorização são provadas
**na API** e a UI só confirma a experiência:

- a **matriz de permissões** (`tests/api/permissions/`) testa 8 endpoints × 5 perfis (Super Admin, Proprietário,
  Atendente, Proprietário da Colômbia e sem login), com o status esperado em cada célula. É assim que o `BUG-001`
  aparece por três caminhos diferentes (matriz, spec de funcionários e tela);
- o **isolamento** (`tests/api/isolation/`) tenta o ataque, não só o uso normal: envia `authorizedId`, `country` e `id`
  no corpo e `authorizedId` na consulta e confirma que o servidor usa o que vem do **token**;
- a UI mantém só o que o usuário percebe: o item some do menu, o deep link redireciona, o formulário não aparece.

Isso evita duplicar toda a cobertura da API na interface (menos tempo de execução e de manutenção).

Cobertura por regra de negócio:

| Regra | API | UI |
|---|---|---|
| RN01 Acesso por perfil | **matriz perfil × endpoint**, autenticação, autorizadas, contatos, funcionários, produtos | redirecionamento por deep link |
| RN02 Menu | — | menu de cada perfil |
| RN03 Autorizadas | criação, país/idioma, login do proprietário | formulário e listagem |
| RN04 Isolamento | **ataques por `authorizedId`**, contatos e funcionários entre autorizadas | lista de funcionários |
| RN05 Funcionários | criação, herança de país e idioma | formulário e listagem |
| RN06 Consulta | atendente lê e não escreve | ausência do formulário |
| RN07 / RN08 Idioma e listas | picklists, `*ToLabel`, produtos e funcionários | rótulos de telas, cargos, categorias |
| RN09 Validações | campos obrigatórios, tamanho, e-mail, cargo, país, **tipos inesperados e JSON malformado** | mensagens exibidas |
| RN10 Telefone | formatos por país, normalização e **limites (mínimo, máximo, ±1 dígito)** | máscara, colagem, aviso ao sair do campo |
| RN11 Unicidade | e-mail de funcionário (global) e de contato (por autorizada) | mensagem de duplicidade |
| RN12 Produtos | filtros, paginação, imagem PNG | tabela, pager, filtros, imagem carregada |
| RN13 Restrição por país | Colômbia sem funcionários (token e 403) | menu e deep link |
| RN14 Sessão | token ausente, inválido, forjado, expirado e **expiração no tempo** | volta ao login |

## Por que Cypress

- Framework que possuo domínio para demonstrar meu conhecimento, organização e tecnicidade aliado a IA para confecção das suítes de teste.
- Um único framework cobre API (`cy.request`) e UI, com o mesmo relatório e a mesma massa de dados.
- `cy.intercept` permite simular erros 4xx/5xx e respostas vazias sem depender do backend.
- Espera automática com repetição de asserções reduz instabilidade
- Screenshots das falhas saem sem configuração.

## Organização e padrões

```
tests/
  api/<domínio>/*.test.js            cenários de API (semântica de negócio nos títulos)
  desafio-qa/<Contexto>/             cenários de UI, uma pasta por contexto testado
    <Contexto>.test.js                describe("<Contexto> - ...") com it("<ação>") curtos, em inglês
    commands.js                      comandos customizados do contexto (cy.accessXPage, cy.fillXFormAndSave...) e run<Contexto>
  desafio-qa/Regression.test.js      regressão única que encadeia os fluxos críticos (runLogin, runRegisterAuthorized, runMenuAndAccess, runContacts, runEmployees, runProducts, runExpiredSession)
  fixtures/                          massa de dados (usuários, países, telefones, catálogo, textos, picklists)
  support/
    commands.js, e2e.js              comandos gerais (cy.getByTestId...) e configuração global
    api/                             clientes HTTP por controller (sem lógica de teste)
    pages/                           Page Objects (POM) e componente do menu (AppShell)
    tenant.js                        cria autorizada + proprietário (+ atendente) via API
    data.js                          e-mails e nomes únicos, decodificação de JWT
```

| Pasta | Contexto testado |
|---|---|
| Login | Login e logout |
| MenuAndAccess | Menu e acesso por perfil/país |
| ExpiredSession | Sessão expirada ou inválida |
| RegisterAuthorized | Cadastro de autorizada |
| Contacts | Cadastro e listagem de contatos (telefone por país) |
| Employees | Cadastro e listagem de funcionários |
| Products | Consulta de produtos |

- **Page Object Model + comandos:** toda interação com a tela fica em `support/pages`; o `commands.js` de cada contexto
  compõe os Page Objects em ações de negócio e o `.test.js` só descreve o comportamento. Cada `commands.js` exporta
  `run<Contexto>`, usado pelo `Regression`. Os seletores são exclusivamente `data-testid` (o app já os possui).
  A única exceção são os rótulos dos campos (`label[for=…]`), que não têm `data-testid` e são o objeto da verificação de idioma.
- **Deep link com autenticação por API:** a UI nunca faz login nem navega por cliques para chegar à tela.
  O token é obtido por `POST /api/login` e injetado no `localStorage` antes de abrir `#/rota` (a URL leva uma query única
  para forçar o recarregamento, já que uma URL que difere só no hash não recarrega a página). O login pela interface
  é exercitado só na pasta `Login`.
- **Isolamento e independência:** cada spec cria a sua própria autorizada pela API com e-mails únicos
  (`provisionTenant`). Não há ordem entre specs nem limpeza obrigatória, e a suíte pode ser repetida sem `npm run seed`.
  Não existe rota de exclusão, por isso o isolamento é por dados novos, não por teardown.
- **Sem `.env` versionado:** o arquivo foi removido do repositório e ignorado no `.gitignore`. A aplicação usa valores
  padrão fictícios e aceita sobrescrita por variáveis de ambiente. Detalhes, riscos e pendências em
  [seguranca-env.md](seguranca-env.md).
- **Massa de dados em fixtures**, sem depender de `.env`. Os valores esperados dos produtos vêm de `catalogo.json`
  (derivado do catálogo do sistema) e os filtros esperados são calculados a partir dele, sem números fixos nos testes.
- **Títulos por comportamento**, não por protocolo (por exemplo, "não permite dois proprietários com o mesmo e-mail").
- **Mocks só na UI** (`cy.intercept`), para erros 4xx/5xx, lista vazia, imagem indisponível e sessão recusada.
  Os fluxos felizes usam o backend real.
- **Sincronização sem `cy.wait(ms)`:** onde a tela recarrega a lista, o page object aguarda a requisição (`cy.intercept` + `cy.wait('@alias')`) e as asserções sobre listas usam `should(callback)`, que repete até estabilizar.

## Como os defeitos aparecem

Os testes descrevem o comportamento **esperado** pelo README. Quando o sistema não cumpre uma regra, o teste falha e leva
o prefixo `[BUG-xxx]` no título, ligado ao [registro de defeitos](defeitos.md). Não usei `skip` nem inverti asserções:
o teste continua valendo como regressão e passa sozinho quando o defeito for corrigido.
Uma suíte toda verde não é o objetivo quando o sistema diverge das regras: as falhas conhecidas ficam visíveis no relatório.

### Quality gate: regressão × defeito conhecido

Se todo defeito aberto deixasse o pipeline vermelho, uma **regressão nova** passaria despercebida no meio das falhas
esperadas. Por isso `scripts/quality-gate.js` lê o JSON dos relatórios e classifica cada falha:

| Situação | Classificação | Efeito no gate |
|---|---|---|
| Falha em teste **sem** `[BUG-xxx]` | **Regressão** | Reprova |
| Falha em teste `[BUG-xxx]` | Defeito conhecido em aberto | Aviso (reprova só no modo `--strict`) |
| Teste `[BUG-xxx]` que **passou** | Defeito aparentemente corrigido | Aviso: remover a marcação e fechar o defeito |
| Relatório ausente (suíte não rodou) | Falha de execução | Reprova |

O resumo (tabela por suíte e contagem por defeito) vai para a página da execução e cada falha vira uma anotação
(`::error` para regressão, `::warning` para defeito conhecido). O modo estrito (`npm run quality-gate:strict`) é usado
no agendamento e no disparo manual com a opção **strict**, para que os defeitos abertos continuem aparecendo como vermelho
periodicamente.

## Relatório

`cypress-mochawesome-reporter` gera um HTML único por suíte, com gráficos, tempo por teste e os screenshots das falhas embutidos:

- API: `reports/api/index.html`
- UI: `reports/e2e/index.html` (screenshots também em `reports/e2e/screenshots`)

## Pipeline (GitHub Actions)

Gatilhos escolhidos em `.github/workflows/ci.yml`:

| Gatilho | Motivo |
|---|---|
| `pull_request` | feedback antes do merge, quando o custo de corrigir é menor |
| `push` na `main` | garante que a branch principal continua verde |
| `schedule` (dias úteis, 03:00 BRT) | detecta regressões e dependências quebradas sem mudança de código |
| `workflow_dispatch` | reexecução manual |

Fluxo: `npm ci`, typecheck, build do front, seed, subir a aplicação e aguardar o health check, instalar o
binário do Cypress (com cache), `npm run test:api`, `npm run test:e2e`, **quality gate**, publicação do artefato
**relatorios-testes** (HTML, JSON e screenshots das falhas) e, por fim, falha do job se o gate reprovou.
Os dois conjuntos usam `continue-on-error` para que ambos rodem e o relatório seja sempre publicado; quem decide o
resultado do job é o quality gate. O `concurrency` cancela execuções antigas da mesma branch.

## Estabilidade: retries desligados de propósito

Não configurei `retries` no Cypress. Cada spec cria os próprios dados e não depende de outros, então uma falha é
determinística: repetir só esconderia um teste instável (e dobraria o tempo dos testes de defeito, que sempre falham).
Se surgir instabilidade real, a correção é no teste (espera por requisição, dado único), não uma nova tentativa.
A única passagem de tempo real da suíte é intencional: o teste de expiração de sessão espera o token de 2 s vencer.

## Próximos passos

- Teste de contrato com o `openapi.json` da aplicação.
- Execução em mais de um navegador e teste de acessibilidade das telas.
- Cenários de alteração e exclusão, quando o sistema passar a oferecê-los.
- Execução em paralelo (`cypress run --parallel`) se a suíte crescer.
- Exigir `JWT_SECRET` e `SUPERADMIN_PASSWORD` em produção e limpar o histórico do Git (pendências do SEC-001 em
  [seguranca-env.md](seguranca-env.md)).