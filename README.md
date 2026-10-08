# Desafio QA — Mini Portal

Sistema fictício (Node + Express + TypeScript, MongoDB, JWT) criado para ser **testado**, e a suíte de testes
automatizados que o valida: **Cypress com Page Object Model**, camadas de **API** e **UI**, relatório HTML,
quality gate e pipeline no GitHub Actions.

| | |
|---|---|
| **Sistema-alvo** | Portal com 4 telas (Autorizadas, Contatos, Produtos, Funcionários), 3 perfis e 3 países (Brasil, Argentina, Colômbia) |
| **Suíte** | 271 testes automatizados (171 de API e 100 de UI) cobrindo as regras de negócio RN01 a RN14 |
| **Resultado atual** | 253 passam; 17 falham e evidenciam **9 defeitos** do sistema; 1 ignorado. Nenhuma regressão |
| **Pipeline** | Pull request, push na `main`, agendado (dias úteis) e manual; relatório publicado como artefato |

---

## Resumo executivo

### O que foi entregue

- **Testes de API** (`tests/api/`, 9 specs): contratos, **matriz de permissões perfil × endpoint**, tentativas de burlar o
  isolamento entre autorizadas, validações, valores limite, entradas malformadas, telefone por país, filtros e
  paginação, idioma e listas de valores, token e expiração da sessão, SLA de 2 s.
- **Testes de UI** (`tests/desafio-qa/`, 7 contextos + regressão): login, menu e acesso por perfil, sessão expirada,
  cadastro de autorizada, contatos (máscara de telefone por país), funcionários e produtos. Telas abertas por deep link
  com token vindo da API, erros simulados com `cy.intercept`, renderização segura de texto (XSS).
- **Relatórios**: HTML por suíte com gráficos e screenshots das falhas embutidos (`reports/api/index.html`,
  `reports/e2e/index.html`).
- **Quality gate** (`scripts/quality-gate.js`): separa **regressão** (falha sem marcação) de **defeito conhecido**
  (`[BUG-xxx]`), para que defeitos abertos não escondam uma quebra nova.
- **Pipeline** (`.github/workflows/ci.yml`): sobe MongoDB e a aplicação, roda as duas suítes, aplica o gate e publica o artefato
  `relatorios-testes`.
- **Documentação** (`docs/`): [testes.md](docs/testes.md), [decisoes.md](docs/decisoes.md) e [defeitos.md](docs/defeitos.md).

### Principais decisões

- **Pirâmide de testes:** regra de negócio e segurança na API (rápida e determinística); a UI valida só o que o usuário vê.
- **Esconder na tela não é segurança:** autorização é provada no backend, na matriz de permissões e nos testes de isolamento.
- **Priorização por risco:** P0 (acesso, isolamento, consulta, unicidade, país, sessão), P1 (cadastros, validações,
  telefone, produtos) e P2 (menu, idioma, listas).
- **Testes independentes:** cada spec cria a própria autorizada pela API, com dados únicos. Sem ordem entre specs, sem
  limpeza e sem `retries` (uma falha é determinística, repetir só esconderia instabilidade).
- **Testes descrevem o esperado pelas regras:** quando o sistema diverge, o teste falha com `[BUG-xxx]`. Nada foi
  ignorado nem teve a asserção invertida para "ficar verde".
- **Page Object + comandos por contexto:** `data-testid` como único seletor, massa de dados em fixtures.

Detalhes e justificativas em [docs/decisoes.md](docs/decisoes.md).

### Defeitos encontrados

| ID | Defeito | Severidade | Regra |
|---|---|---|---|
| BUG-001 | Atendente consegue cadastrar funcionários (API `201`; formulário aparece em `#/employees/create`) | Alta | RN01, RN06 |
| BUG-002 | Login aceita `GET /api/login` e o front envia a senha na URL | Alta | RN14 |
| BUG-003 | Backend não valida nem normaliza o telefone da Argentina | Média | RN09, RN10 |
| BUG-004 | Campo de telefone da Argentina sem máscara, prefixo `+54` e validação | Média | RN10 |
| BUG-005 | Formulário de Contatos da Argentina aparece em português | Média | RN07 |
| BUG-006 | Coluna Categoria dos Produtos mostra o valor em português, sem tradução | Média | RN07, RN08 |
| BUG-007 | Cadastro de funcionário sem cargo não informa o motivo | Baixa | RN09 |
| BUG-008 | Falha na consulta de produtos não avisa o usuário | Baixa | — |
| BUG-009 | JSON malformado ou corpo acima de 100 kb resulta em `500` em vez de `400`/`413` | Média | RN09 |

Passos, esperado, obtido e causa provável de cada um em [docs/defeitos.md](docs/defeitos.md).

### Resultado da última execução

| Suíte | Specs | Testes | Passaram | Falharam | Ignorados |
|---|---:|---:|---:|---:|---:|
| API | 9 | 171 | 162 | 9 | 0 |
| UI | 8 | 100 | 91 | 8 | 1 |
| **Total** | **17** | **271** | **253** | **17** | **1** |

As 17 falhas são todas de testes marcados `[BUG-xxx]`. O quality gate (modo padrão) fica **aprovado**; uma falha sem
marcação o **reprova**. O teste ignorado é a colagem de telefone da Argentina, que não tem massa de dados.

---

## Como rodar

**Requisitos:** Node 20 ou superior e MongoDB (`mongodb://localhost:27017`, ou outro endereço em `MONGO_URI`).

```bash
npm install
npm start          # gera o front, conecta no Mongo, cria os dados iniciais (se vazio) e sobe em http://localhost:3000
```

Em outro terminal, com a aplicação no ar:

```bash
npm run seed       # (opcional) volta ao estado inicial antes de testar
npm run test:api   # reports/api/index.html
npm run test:e2e   # reports/e2e/index.html
npm run quality-gate
```

| Comando | O que faz |
|---|---|
| `npm start` / `npm run dev` | Sobe a aplicação (o `dev` reinicia a cada alteração) |
| `npm run seed` | Apaga e recria os dados (1 Super Admin e 24 produtos; remove autorizadas, funcionários e contatos criados) |
| `npm run typecheck` | Checagem de tipos da aplicação |
| `npm run test:api` | Testes de API (Cypress) |
| `npm run test:e2e` | Testes de interface (Cypress) |
| `npm run quality-gate` | Separa regressão de defeito conhecido; `quality-gate:strict` reprova também os defeitos abertos |
| `npm run cy:open` | Cypress no modo interativo |

Use `BASE_URL` para testar outro endereço e um banco próprio com `MONGO_DB`. As variáveis (porta, Mongo, segredo do token
e credenciais iniciais, todas fictícias) ficam no `.env`.

**Acesso inicial:** `superadmin@example.com` / `Admin@123`. Proprietários e funcionários criados pelas telas recebem a
senha `Senha@123`.

---

## Pipeline (GitHub Actions)

Workflow em [.github/workflows/ci.yml](.github/workflows/ci.yml).

| Gatilho | Motivo |
|---|---|
| `pull_request` | feedback antes do merge |
| `push` na `main` | garante a branch principal |
| agendado (dias úteis, 03:00 BRT) | detecta regressões sem mudança de código; reprova também por defeito aberto |
| manual (`workflow_dispatch`) | reexecução sob demanda, com a opção `strict` |

Etapas: `npm ci` → typecheck → build do front → seed → subir a aplicação e aguardar `/api/health` → instalar o Cypress
(com cache) → `test:api` → `test:e2e` → **quality gate** → publicar o artefato **relatorios-testes** (HTML, JSON e
screenshots das falhas) → reprovar o job se o gate reprovou. O resumo do gate aparece na página da execução.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/testes.md](docs/testes.md) | Cada teste de API e UI: o que consiste, o que valida, como é testado e o que se espera |
| [docs/decisoes.md](docs/decisoes.md) | Estratégia, priorização por risco, organização, quality gate, pipeline e próximos passos |
| [docs/defeitos.md](docs/defeitos.md) | Os 9 defeitos com passos de reprodução, observações e o que foi verificado sem defeito |

---

## O sistema-alvo em resumo

### Regras de negócio

| Regra | Resumo |
|---|---|
| **RN01** Acesso por perfil | Cada usuário só acessa telas e ações do seu perfil, na interface e na API |
| **RN02** Menu | Mostra só as telas permitidas |
| **RN03** Autorizadas | Empresa parceira criada pelo administrador junto com o proprietário; o país é definido aqui |
| **RN04** Isolamento | Dados de uma autorizada não são visíveis nem alteráveis por outra |
| **RN05** Funcionários | Cadastrados por quem tem escrita; pertencem a uma autorizada e herdam país e idioma |
| **RN06** Consulta | Perfis de consulta visualizam, mas não criam nem alteram |
| **RN07** Idioma | Interface no idioma do país da autorizada |
| **RN08** Listas de valores | Mesmo valor em todo o sistema, exibido no idioma do usuário |
| **RN09** Campos e formatos | Formulários rejeitam dados incompletos ou fora do formato e informam o motivo |
| **RN10** Telefone | Segue o formato do país do usuário |
| **RN11** Unicidade | Sem e-mail duplicado dentro do escopo em que deve ser único |
| **RN12** Produtos | Consulta filtrada e paginada, com imagem |
| **RN13** Restrição por país | Alguns módulos não existem para certos países |
| **RN14** Sessão | Exige autenticação; a sessão expira |

### Perfis e telas

| Cargo | Autorizadas | Contatos | Produtos | Funcionários |
|---|---|---|---|---|
| Super Admin | ler e criar | — | ler | — |
| Proprietário | — | ler e criar | ler | ler e criar |
| Atendente | — | só ler | ler | só ler |

- O Super Admin não pertence a nenhuma autorizada; cria a autorizada e o proprietário, que cadastra funcionários e contatos.
- O módulo de **Funcionários não existe para a Colômbia**: a permissão não vem no token, o item some do menu e a API responde `403`.
- E-mail de funcionário é único em todo o sistema; e-mail de contato é único dentro da autorizada.
- Idioma: Brasil `pt`; Argentina e Colômbia `es`. Os valores de listas trafegam sempre em português e o backend devolve o
  texto no idioma do usuário em `<campo>ToLabel`.
- As permissões vão no JWT e o backend valida assinatura e expiração em toda requisição.

### Telefone por país

| País | Código | Dígitos | Máscara no front |
|---|---|---|---|
| Brasil | 55 | 10 ou 11 | `(00) 0000-0000` ou `(00) 00000-0000` |
| Argentina | 54 | 10 | só dígitos |
| Colômbia | 57 | 10 | `000 000 0000` |

Guardado normalizado como `+<código><número>`; o backend valida de novo com as mesmas regras.

### API

Swagger com a aplicação no ar: [http://localhost:3000/api-docs.html](http://localhost:3000/api-docs.html)
(especificação em `/openapi.json`). Rotas protegidas exigem `Authorization: Bearer <token>`.

| Rota | Permissão |
|---|---|
| `GET /api/health`, `POST /api/login` | pública |
| `GET /api/picklists` | qualquer usuário logado |
| `GET`, `POST /api/authorizeds` | authorizeds |
| `GET`, `POST /api/contacts` | contacts |
| `GET /api/products`, `GET /api/products/:id/image` | products |
| `GET`, `POST /api/employees` | employees |

Erros: `{ "error": "CODIGO", "fields": { "campo": "CODIGO" } }` com `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`,
`INVALID_CREDENTIALS`, `DUPLICATE_EMAIL` e `NOT_FOUND`.

---

## Estrutura do repositório

```
src/server/                Sistema-alvo: API, auth, permissões, validação, seed
src/web/                   Sistema-alvo: front (páginas, i18n pt/es/en)
public/                    index.html e CSS (o app.js é gerado no build)
tests/
  api/<domínio>/           Testes de API (*.test.js)
  desafio-qa/<Contexto>/   Testes de UI: <Contexto>.test.js + commands.js; Regression.test.js
  fixtures/                Massa de dados
  support/                 Page Objects, clientes de API, tenant, matriz de permissões
scripts/quality-gate.js    Classifica falhas: regressão x defeito conhecido
docs/                      testes.md, decisoes.md, defeitos.md
reports/                   Relatórios gerados (não versionados)
cypress.config.js          Configuração, reporter e tarefas do Cypress
.github/workflows/ci.yml   Pipeline
```

---

*Anonimização: nenhum dado, nome, endereço ou termo de empresa real foi usado. E-mails em `example.com`, produtos e
códigos inventados, imagens geradas por código e segredo de JWT apenas de exemplo.*
