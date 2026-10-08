# Documentação dos testes

Este documento descreve **cada teste automatizado** da suíte: em que ele consiste, o que valida, como é executado e o
que se espera dele. Para as justificativas de arquitetura veja [decisoes.md](decisoes.md); para os defeitos encontrados,
[defeitos.md](defeitos.md).

- [Como ler](#como-ler)
- [Mecanismos comuns](#mecanismos-comuns)
- [Testes de API](#testes-de-api) — `tests/api/`
- [Testes de interface (UI)](#testes-de-interface-ui) — `tests/desafio-qa/`
- [Como executar](#como-executar)

## Como ler

Cada tabela traz as colunas:

| Coluna | Significado |
|---|---|
| **Teste** | O comportamento verificado (título resumido do `it`) |
| **O que valida** | A regra ou o contrato que está sendo conferido |
| **Como é testado** | A técnica: chamadas, dados e asserções usadas |
| **Esperado** | O resultado que faz o teste passar |

Marcações usadas:

- **`[BUG-xxx]`** — o teste descreve o comportamento correto, mas o sistema hoje **não o cumpre**; ele **falha de
  propósito** até o defeito ser corrigido (ver [defeitos.md](defeitos.md)). Nas tabelas, o campo *Esperado* traz o
  comportamento correto e a nota "falha hoje" indica o que o sistema faz.
- **RNxx** — regra de negócio do [README](../README.md) coberta pelo teste.
- **SLA** — asserção de tempo de resposta (`duration < 2000 ms`) nos fluxos críticos.

## Mecanismos comuns

| Mecanismo | Onde | Função |
|---|---|---|
| `provisionTenant(país)` | `support/tenant.js` | Cria **via API** uma autorizada nova com proprietário (e atendente, exceto Colômbia, onde o módulo de funcionários não existe) e devolve as sessões já autenticadas. Cada spec trabalha na sua própria autorizada, sem depender de outros specs |
| `superAdminSession()` | `support/tenant.js` | Autentica o Super Admin da massa inicial |
| `uniqueEmail` / `uniqueName` | `support/data.js` | Gera e-mails e nomes únicos por execução; a suíte pode ser repetida sem recriar o banco |
| Fixtures | `tests/fixtures/` | Fonte de verdade dos dados: usuários, países, telefones válidos/inválidos, casos de validação, catálogo de produtos, textos da interface e listas de valores |
| Clientes de API | `support/api/*.js` | Uma função por endpoint (`call` não falha por status; quem decide é a asserção) |
| Page Objects | `support/pages/*.js` | Toda interação com a tela; seletores apenas por `data-testid` |
| `cy.task("signToken")` | `cypress.config.js` | Gera tokens com expiração ou assinatura controladas (cenários de sessão) |
| Deep link com token | `BasePage.open` | A UI nunca faz login nem navega por cliques: o token vem da API, é injetado no `localStorage` e a tela é aberta pelo hash (`#/rota`) |
| `cy.intercept` | specs de UI | Simula erros 4xx/5xx, listas vazias e imagens indisponíveis, sem depender do backend |

---

# Testes de API

Executados com `cy.request` contra a aplicação real. Em todos, o token é obtido por `POST /api/login` e enviado em
`Authorization: Bearer …`. Os testes verificam **status HTTP**, **contrato do corpo** (chaves esperadas) e **efeito
persistido** (consulta posterior).

## API · Autenticação e sessão — `tests/api/auth/autenticacao.test.js` (RN14)

**Consiste em:** validar o login, o conteúdo e a validade do token e a proteção das rotas.

### Login

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Autentica o Super Admin | Contrato do login e permissões do administrador | `POST /api/login` com o Super Admin; decodifica o JWT | `200`, corpo só com `token`, SLA ok; claims com `role = Super Admin`, `authorizedId = null`, permissões `authorizeds: read/write` e `products: read` |
| Autentica o proprietário | Dados da autorizada dentro do token | Login de um proprietário recém-criado (Brasil) | Claims com `role = Proprietário`, `authorizedId` e `authorizedName` corretos, `country = brasil`, `language = pt`, permissões `contacts` e `employees: read/write`, `products: read` |
| Prazo de validade | Sessão expira | Compara `exp` e `iat` do token | `exp > iat` |
| E-mail sem diferenciar caixa | Normalização do e-mail | Login com o e-mail em maiúsculas | `200` |
| Senha incorreta não revela o e-mail | Mensagem única para credenciais inválidas | Login com senha errada e com e-mail inexistente | Ambos `401` com o mesmo corpo `{ error: "INVALID_CREDENTIALS" }` |
| Campos obrigatórios | Validação do login | `POST /api/login` com corpo vazio | `400`, `VALIDATION`, `fields: { email: REQUIRED, password: REQUIRED }` |
| **[BUG-002]** Credenciais na URL | Senha não pode trafegar na querystring | `GET /api/login?email=…&password=…` | `404` ou `405`. *Falha hoje:* responde `200` e autentica |

### Validação do token em toda requisição

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Sem token (produtos e contatos) | Rotas exigem autenticação | `GET` sem cabeçalho | `401` |
| Token malformado (produtos e contatos) | Token inválido é recusado | `Authorization: Bearer token.invalido.qualquer` | `401` com `{ error: "UNAUTHORIZED" }` |
| Token assinado com outra chave | O backend valida a assinatura, mesmo com permissões elevadas | Gera token forjado (`cy.task`) com `employees/contacts/authorizeds: read/write` e chave diferente | `401` |
| Token expirado | O backend valida a expiração | Gera token com `expiresIn` negativo | `401`, `UNAUTHORIZED` |
| Esquema diferente de Bearer | Só `Bearer` é aceito | Envia `Authorization: Basic <token>` | `401` |

### Disponibilidade

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Health check | Saúde pública e SLA | `GET /api/health` sem token | `200`, `{ status: "ok" }`, resposta em menos de 2 s |
| Rota inexistente | Erro padronizado | `GET /api/rota-inexistente` | `404`, `{ error: "NOT_FOUND" }` |

## API · Cadastro de autorizada — `tests/api/authorizeds/cadastro-autorizada.test.js` (RN01, RN03, RN09, RN11)

**Consiste em:** o Super Admin cria uma autorizada junto com o seu proprietário; validar criação, listagem, validações,
unicidade de e-mail e permissão.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Cria a autorizada por país (brasil, argentina, colombia) | Criação, idioma pelo país e login do proprietário | `POST /api/authorizeds` com cada país; depois login do proprietário com a senha padrão | `201`, SLA ok, corpo com `id, name, country, countryToLabel, language, owner, employeesCount`; `language` = `pt`/`es`/`es`; `employeesCount = 1`; login `200` com `role`, `country`, `language`, `authorizedId` e rótulo do cargo corretos |
| Lista a autorizada criada | Listagem com proprietário e contagem | Cria e consulta `GET /api/authorizeds` | `200`, chaves `items` e `total`; o item traz nome, país, rótulo do país e `employeesCount = 1` |
| E-mail do proprietário em minúsculas | Normalização | Cria com e-mail misto | `201` e e-mail devolvido em minúsculas |
| Rejeita dados inválidos (9 casos da fixture) | RN09: campo obrigatório, tamanho mínimo, e-mail inválido, país inválido | Um `POST` por caso: nome vazio/curto, proprietário vazio/curto, e-mail vazio/sem `@`/sem domínio, país vazio/`chile` | `400`, `VALIDATION`, e o código do campo esperado (`REQUIRED`, `MIN_LENGTH`, `INVALID_EMAIL`, `INVALID_COUNTRY`) |
| Corpo vazio informa tudo de uma vez | Todos os erros no mesmo retorno | `POST` com `{}` | `400` com os quatro campos `REQUIRED` |
| E-mail duplicado não grava a autorizada | RN11 e atomicidade | Cria; tenta de novo com o e-mail em maiúsculas; compara o `total` antes e depois | `409`, `DUPLICATE_EMAIL` em `ownerEmail`; `total` inalterado |
| Não reutiliza o e-mail do Super Admin | Unicidade global | `POST` com o e-mail do Super Admin | `409` |
| Não reutiliza o e-mail de funcionário de outra autorizada | Unicidade global | `POST` com o e-mail do atendente de outra autorizada | `409` |
| Proprietário e atendente não acessam | RN01 | `POST` e `GET` com os tokens desses perfis | `403`, `{ error: "FORBIDDEN" }` |
| Exige autenticação | RN14 | `POST` e `GET` sem token | `401` |
| Proprietário novo cadastra funcionário | Fluxo de ponta a ponta | Login do proprietário recém-criado e `POST /api/employees` | `201` |

## API · Cadastro de contatos — `tests/api/contacts/cadastro-contato.test.js` (RN01, RN04, RN06, RN09, RN10, RN11)

**Consiste em:** o proprietário cadastra contatos da sua autorizada; validar contrato, validações, telefone por país,
unicidade, isolamento e perfis.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Grava o contato e devolve o contrato | Criação | `POST /api/contacts` válido | `201`, SLA ok, chaves `id, name, email, phone, createdAt` |
| Persiste e lista primeiro | Persistência e ordenação | Cria e consulta `GET /api/contacts` | `200`, chaves `items`/`total`; o contato criado é o primeiro da lista |
| Normaliza e-mail e nome | Tratamento de dados | Envia e-mail misto e nome com espaços nas pontas | `201`, e-mail em minúsculas, nome sem espaços nas pontas |
| Rejeita dados inválidos (6 casos) | RN09 | Nome vazio/curto, e-mail vazio/sem `@`/sem domínio, telefone vazio | `400`, `VALIDATION`, código do campo (`REQUIRED`, `MIN_LENGTH`, `INVALID_EMAIL`) |
| Não grava com validação falha | Atomicidade | Compara o `total` antes e depois de um `POST` inválido | `400` e `total` inalterado |
| Brasil: telefones válidos | RN10 | Celular/fixo com máscara, com código do país e só dígitos | `201` e `phone` normalizado (`+5511987654321`, `+551134567890`) |
| Brasil: telefones inválidos | RN10 | 9 dígitos, 12 dígitos sem código do país, só letras | `400`, `fields.phone = INVALID_PHONE` |
| **[BUG-003]** Argentina: telefones válidos | RN10 | 10 dígitos, com e sem `+54` | `201` e `+541123456789`. *Falha hoje:* grava o texto como veio |
| **[BUG-003]** Argentina: telefones inválidos | RN10 | 5 dígitos, 11 dígitos, só letras | `400` `INVALID_PHONE`. *Falha hoje:* `201` |
| Colômbia: telefones válidos / inválidos | RN10 | 10 dígitos (com máscara e com `+57`); 8 e 11 dígitos | `201` `+573001234567`; `400` `INVALID_PHONE` |
| Usa o formato do país do usuário | RN10 | Celular brasileiro (11 dígitos) enviado por usuário da Colômbia | `400` |
| E-mail repetido na mesma autorizada | RN11 | Cria e repete em maiúsculas | `409`, `DUPLICATE_EMAIL` em `email` |
| Mesmo e-mail em autorizadas diferentes | RN11 (escopo por autorizada) | Mesmo contato criado em duas autorizadas | Ambos `201` |
| Isolamento entre autorizadas | RN04 | Contato criado em A; lista de B | O e-mail não aparece na lista de B |
| Atendente consulta | RN06 | `GET /api/contacts` com o atendente | `200` e o contato do proprietário está na lista |
| Atendente não cria | RN01/RN06 | `POST` com o atendente | `403`, `FORBIDDEN` |
| Super Admin bloqueado | RN01 | `GET` e `POST` com o Super Admin | `403` (não pertence a uma autorizada) |
| Exige autenticação | RN14 | Sem token | `401` |

## API · Cadastro e consulta de funcionários — `tests/api/employees/cadastro-funcionario.test.js` (RN01, RN04, RN05, RN06, RN07, RN08, RN09, RN11, RN13)

**Consiste em:** o proprietário cadastra funcionários da própria autorizada, que herdam país e idioma; validar criação,
validações, unicidade, listagem com filtro, perfis e a restrição da Colômbia.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Cria na própria autorizada herdando país e idioma | RN05, SLA | `POST /api/employees` como proprietário (Brasil) | `201`, SLA ok, chaves `id, name, email, role, roleToLabel, language, country`; `country = brasil`, `language = pt` |
| Cargo no idioma do usuário | RN07/RN08 | Proprietário da Argentina cadastra `Atendente` | `role = Atendente` (português) e `roleToLabel = Asistente`; `country = argentina`, `language = es` |
| Novo funcionário entra com a senha padrão | Senha inicial e permissões | Login do funcionário criado | `200`; claims com cargo `Atendente`, mesma `authorizedId` e permissões de leitura (`contacts`, `products`, `employees`: `read`) |
| E-mail em minúsculas | Normalização | E-mail misto | `201` com e-mail em minúsculas |
| Rejeita dados inválidos (8 casos) | RN09 | Nome vazio/curto, e-mail vazio/inválido, cargo vazio, `Super Admin`, `Gerente` e `Asistente` (valor em espanhol) | `400`, `VALIDATION`, código do campo (`REQUIRED`, `MIN_LENGTH`, `INVALID_EMAIL`, `INVALID_ROLE`) |
| E-mail repetido, mesmo em maiúsculas | RN11 | Cria e repete | `409`, `DUPLICATE_EMAIL` |
| E-mail de outra autorizada / do Super Admin | RN11 (global) | Usa o e-mail de um funcionário de outra autorizada; e o do Super Admin | `409` |
| Lista só os da própria autorizada | RN04 | Cria na Argentina; lista no Brasil | A lista do Brasil traz o proprietário e o atendente dela e **não** traz os da Argentina |
| Filtra por cargo | Filtro `role` | `GET /api/employees?role=Atendente` e `?role=Proprietário` | `200`, itens só do cargo pedido, com pelo menos um item |
| Rejeita cargo inexistente no filtro | Validação do filtro | `?role=Gerente` | `400`, `fields: { role: INVALID_ROLE }` |
| Atendente consulta | RN06 | `GET` com o atendente | `200` e o proprietário aparece |
| **[BUG-001]** Atendente não cadastra | RN01/RN06 | `POST` com o atendente | `403`, `FORBIDDEN`. *Falha hoje:* `201` |
| **[BUG-001]** Atendente não grava funcionário | RN06 | `POST` com o atendente e consulta posterior pelo proprietário | O e-mail **não** aparece na lista. *Falha hoje:* é gravado |
| Super Admin bloqueado | RN01 | `GET` e `POST` com o Super Admin | `403` |
| Colômbia sem o módulo | RN13 | Decodifica o token do proprietário da Colômbia; `GET` e `POST` | Permissões só com `contacts: read/write` e `products: read`; `403` nas duas chamadas |
| Demais países com o módulo | RN13 | `GET` com Brasil e Argentina | `200` |
| Exige autenticação | RN14 | Sem token | `401` |

## API · Listas de valores — `tests/api/picklists/listas-de-valores.test.js` (RN07, RN08)

**Consiste em:** `GET /api/picklists` devolve as opções (`value` em português + `toLabel` no idioma do usuário).

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Português para o Brasil | RN07 | Compara o corpo com `picklists/listas.json` (`pt`) | Chaves `category, status, role, assignableRole, country` e conteúdo idêntico à fixture |
| Espanhol para a Argentina | RN07/RN08 | Compara com a fixture `es` | Rótulos em espanhol; `value` continua em português |
| Mesmos valores em qualquer idioma | RN08 | Compara os `value` de Brasil e Argentina lista a lista | Idênticos |
| Sem Super Admin entre atribuíveis | Regra de cadastro | Lê `assignableRole` | Exatamente `Proprietário` e `Atendente` |
| Disponível a todo usuário autenticado | RN01 | `GET` com Super Admin, proprietário e atendente | `200` |
| Exige autenticação | RN14 | Sem token | `401` |

## API · Consulta de produtos — `tests/api/products/consulta-produtos.test.js` (RN01, RN07, RN08, RN12)

**Consiste em:** consulta paginada e filtrável do catálogo; os resultados esperados são **calculados a partir da
fixture** `products/catalogo.json` (24 itens), sem números fixos no teste.

### Contrato e paginação

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Primeira página e contrato | Paginação padrão e schema | `GET /api/products` | `200`, SLA ok, chaves `items, total, page, pageSize`; `page = 1`, `pageSize = 10`, 10 itens, `total` = tamanho do catálogo; cada item com `id, code, name, model, category, categoryToLabel, status, statusToLabel, price, imageUrl` e `imageUrl = /api/products/<id>/image` |
| Percorre todo o catálogo | Sem repetição nem perda entre páginas | Pede todas as páginas em sequência | Os códigos coletados são iguais, na ordem, ao catálogo; a última página tem o resto |
| Tamanho de página | `pageSize` e limite | `pageSize=5` e `pageSize=500` | 5 itens; com 500, `pageSize = 50` |
| Página além do fim | Página vazia | `page=999` | `200`, `items = []`, `total` mantido |
| Página inválida | Robustez | `page=-3` | `page = 1` |

### Filtros

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Nome ou código sem diferenciar caixa | Filtro `name` | Termos `qz7k`, `QZ7K`, `k5172`, `refrigerador`, `R7305`, `etiqueta ence` | `total` e códigos iguais aos calculados na fixture |
| Caracteres especiais | Termo tratado como texto | `.`, `(`, `*`, `[`, `\` | `200` e `total` igual ao calculado (sem coringa de regex) |
| Cada categoria / cada situação | Filtros `category` e `status` | Uma chamada por valor existente | `total` esperado e todos os itens do valor filtrado |
| Combina os três filtros | Filtros em conjunto | `name=qz7k` + categoria SKU + `Inativo` | Códigos iguais aos calculados (massa com pelo menos 1 item) |
| Nada corresponde | Resultado vazio | Termo inexistente | `200`, `total = 0`, `items = []` |
| Paginação sobre o filtrado | Paginação + filtro | `name=etiqueta`, `pageSize=3`, `page=2` | Itens 4 a 6 do resultado filtrado |
| Valores fora das listas | Validação | `category=Casa`, `status=Pendente` | `400`, `fields: { category: INVALID, status: INVALID }` |
| Valores em outro idioma | Valores trafegam em português | `category=Repuestos`, `status=Activo` | `400` |

### Idioma e dados

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Rótulos em português (Brasil) | RN07/RN08 | Lista com 50 itens | `categoryToLabel = category` e `statusToLabel = status` |
| Rótulos em espanhol (Argentina) | RN07/RN08 | Idem, com mapa de tradução | `Peças → Repuestos`, etc.; `Ativo → Activo`, `Inativo → Inactivo`; valores em português |
| Dados sem alteração | Integridade | Compara `code, name, category, model, status, price` com a fixture | Iguais ao catálogo |

### Imagem e acesso

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Imagem PNG válida | RN12 | `GET /api/products/:id/image` para cada produto da página | `200`, `content-type: image/png`, corpo começa com a assinatura PNG |
| Produto inexistente | Erro | `id-inexistente` | `404` |
| Imagem exige autenticação | RN14 | Sem token | `401` |
| Todos os perfis consultam | RN01 | Super Admin, proprietário e atendente | `200` |
| Exige autenticação | RN14 | Sem token | `401` |

---

# Testes de interface (UI)

Executados no navegador pelo Cypress, **sempre abrindo a tela por deep link com o token injetado** (exceto o login
real da pasta `Login`). Os dados de apoio são criados por API; a UI valida **o que o usuário vê** (textos, estados,
máscaras, mensagens). Cada pasta tem `<Contexto>.test.js` (cenários) e `commands.js` (comandos de negócio).

## UI · Login — `tests/desafio-qa/Login/` (RN14)

**Consiste em:** a tela de login e o encerramento da sessão.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Login do Super Admin abre a primeira tela permitida | Login pela interface | Preenche e envia o formulário | Hash `#/authorizeds`, título "Autorizadas", nome e cargo do usuário no cabeçalho, sem nome de autorizada, token salvo no `localStorage` |
| Sair volta ao login | Logout | Loga, aguarda a lista e clica em "Sair" | Hash `#/login`, formulário visível, token removido |
| Campos do login e senha mascarada | Apresentação | Abre a página de login | Título "Entrar", e-mail e senha visíveis, `type="password"`, botão habilitado |
| Senha errada | Erro de credenciais | Login com senha incorreta | Mensagem "E-mail ou senha inválidos.", permanece em `#/login`, sem token |
| Campos vazios | Validação obrigatória | Envia sem preencher | Erros "Este campo é obrigatório." em e-mail e senha |
| Falha do servidor (mock 500) | Erro de integração | `cy.intercept("/api/login*")` responde `500` | Mensagem genérica "Não foi possível concluir a operação.", permanece em `#/login` |
| **[BUG-002]** Senha fora da URL | Segurança | Intercepta a requisição de login | Método `POST` e senha ausente da URL. *Falha hoje:* usa `GET` com a senha na querystring |

## UI · Menu e acesso por perfil — `tests/desafio-qa/MenuAndAccess/` (RN01, RN02, RN13)

**Consiste em:** o menu exibe só o que o perfil pode acessar e o acesso direto a telas sem permissão é redirecionado.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Super Admin no menu | RN02 | Abre Produtos com o token do Super Admin | Exatamente "Autorizadas" e "Produtos" |
| Proprietário no menu | RN02 | Idem, proprietário | "Contatos", "Produtos" e "Funcionários" |
| Atendente no menu | RN02 | Idem, atendente | "Contatos", "Produtos" e "Funcionários" |
| **[RN13]** Colômbia sem Funcionários | RN13 | Proprietário da Colômbia | Menu em espanhol só com Contactos e Productos; sem o item de funcionários |
| Cabeçalho do usuário | Identificação | Abre Contatos como proprietário | Nome, cargo e nome da autorizada corretos |
| Botão de sair no idioma do usuário | RN07 | Proprietário da Colômbia | Texto "Salir" |
| Proprietário em Autorizadas | RN01 | Deep link `#/authorizeds` | Redireciona para `#/contacts`; formulário de autorizada ausente |
| Super Admin em Contatos | RN01 | Deep link `#/contacts` | Redireciona para `#/authorizeds` |
| **[RN13]** Colômbia em Funcionários | RN13 | Deep link `#/employees` | Redireciona para `#/contacts`; título de funcionários ausente |
| Visitante sem sessão | RN14 | Abre `#/contacts` sem token | Vai para `#/login` |
| Navegação pelo menu | Navegação | Clica em Produtos e Funcionários | Hash e títulos corretos |

## UI · Sessão expirada ou inválida — `tests/desafio-qa/ExpiredSession/` (RN14)

**Consiste em:** a interface reage a tokens que o backend recusa. A rejeição `UNAUTHORIZED` não tratada pelo front é
ignorada de propósito (`cy.ignoreUnauthorizedRejection`), pois o objetivo é verificar o redirecionamento.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Token expirado | Prazo da sessão | Abre Contatos com token expirado (`cy.task`) | Vai para `#/login`, formulário visível, token removido |
| Assinatura inválida | Integridade do token | Token assinado com outra chave | Mesmo resultado |
| Servidor recusa durante o uso (mock 401) | Sessão invalidada com a tela aberta | `cy.intercept` responde `401` em `/api/contacts` | Mesmo resultado |
| Sessão válida após recarregar | Persistência | Abre Contatos, `cy.reload()` | Continua em `#/contacts` com o título visível |

## UI · Cadastro de autorizada — `tests/desafio-qa/RegisterAuthorized/` (RN03, RN08, RN09, RN11)

**Consiste em:** a tela "Autorizadas" do Super Admin.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Formulário com países no idioma do usuário | RN08 | Lê as opções do select | Opções iguais às da fixture + a opção vazia |
| Cadastra e lista o novo registro | Fluxo feliz | Preenche e salva | Mensagem "Autorizada e proprietário cadastrados com sucesso."; linha com nome, país "Brasil" (`data-country="brasil"`) e 1 funcionário |
| Limpa o formulário | Usabilidade | Salva e confere os campos | Nome e e-mail do proprietário vazios |
| País pelo rótulo em português | RN08 | Cadastra com `colombia` | Linha mostra "Colômbia" |
| Campos obrigatórios | RN09 | Salva vazio | "Este campo é obrigatório." nos 4 campos; sem mensagem de sucesso |
| Nome curto e e-mail inválido | RN09 | Nome "A" e e-mail sem `@` | "E-mail inválido." e "Informe ao menos 2 caracteres." |
| E-mail já cadastrado | RN11 | Cria por API e tenta pela tela | "Este e-mail já está cadastrado." no e-mail do proprietário |
| Falha do servidor (mock 500) | Erro de integração | `POST /api/authorizeds` responde `500` | Mensagem genérica no formulário |
| Listagem do servidor (mock) | Renderização | Mock de lista com 1 item (7 funcionários) | 1 linha com a contagem 7 |

## UI · Contatos — `tests/desafio-qa/Contacts/` (RN04, RN06, RN07, RN09, RN10, RN11)

**Consiste em:** cadastro, máscara do telefone por país e exibição por perfil.

### Cadastro

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Cadastra e lista | Fluxo feliz | Preenche e salva (Brasil) | Mensagem de sucesso, formulário limpo, linha com o telefone normalizado `+5511987654321` |
| Campos obrigatórios | RN09 | Salva vazio | "Este campo é obrigatório." em nome, e-mail e telefone |
| Nome curto e e-mail inválido | RN09 | "J" e `sem-arroba` | "Informe ao menos 2 caracteres." e "E-mail inválido." |
| E-mail duplicado na autorizada | RN11 | Cria por API e repete na tela | "Este e-mail já está cadastrado." |
| Telefone incompleto | RN10 | Telefone com 4 dígitos | "Telefone inválido para o país."; sem sucesso |
| Falha do servidor (mock 500) | Erro de integração | `POST /api/contacts` responde `500` | Mensagem genérica |
| Sem permissão (mock 403) | Erro de integração | `POST` responde `403` | "Você não tem permissão para esta ação." |

### Campo telefone: máscara e validação (RN10) — repetido para Brasil, Argentina e Colômbia

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Prefixo e máscara ao digitar | Máscara por país | Digita os casos da fixture (celular, fixo, letras/símbolos, excesso de dígitos) | Brasil `+55 (11) 98765-4321` / `+55 (11) 3456-7890`; letras e símbolos bloqueados; excedente descartado; Colômbia `+57 300 123 4567`; Argentina `+54 1123456789` |
| Colar com ou sem código do país | Colagem | Simula `input` com `+5511987654321` (Brasil) e `573001234567` (Colômbia) | Número formatado como na digitação (Argentina não tem massa e é ignorado) |
| Aviso ao sair do campo incompleto | Validação ao `blur` | Digita número curto e sai do campo; digita mais um dígito | "Telefone inválido para o país." aparece e some ao voltar a digitar |
| Sem aviso com o campo vazio | Não gera ruído | Foca e sai | Sem mensagem |

> **[BUG-004]** Na Argentina, os testes "prefixo e máscara" e "aviso ao sair do campo" falham hoje: o front não aplica a
> máscara à Argentina.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Colômbia: cadastra e exibe normalizado | RN10 | Digita `3001234567` e salva | Mensagem em espanhol "Contacto guardado con éxito." e linha com `+573001234567` |

### Exibição por perfil e país (RN06, RN07)

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Estado vazio | Autorizada sem contatos | Tenant novo | "Nenhum contato cadastrado." |
| Lista com telefone normalizado | Listagem | Cria por API e abre a tela | Linha com nome e telefone normalizado |
| Rótulos em português (Brasil) | RN07 | Lê os rótulos do formulário | "Nome", "E-mail", "Telefone" |
| Placeholder por país | RN10 | Lê o `placeholder` (Brasil, Argentina, Colômbia) | `+55 (__) _____-____`, `+54 __________`, `+57 ___ ___ ____` |
| **[BUG-005]** Rótulos em espanhol (Argentina) | RN07 | Proprietário da Argentina | "Nombre", "Correo electrónico", "Teléfono". *Falha hoje:* aparecem em português |
| Rótulos em espanhol (Colômbia) | RN07 | Proprietário da Colômbia | "Nombre" e "Teléfono" |
| **[RN06]** Atendente só consulta | RN06 | Atendente abre Contatos | Vê o contato do proprietário e **não** vê o formulário |

## UI · Funcionários — `tests/desafio-qa/Employees/` (RN01, RN04, RN05, RN06, RN07, RN09, RN11, RN13)

**Consiste em:** cadastro e listagem de funcionários.

### Cadastro

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Cadastra e lista com o cargo | Fluxo feliz | Cadastra um Proprietário | "Funcionário cadastrado com sucesso.", linha com nome e cargo, formulário limpo |
| Argentina mostra o cargo em espanhol | RN07 | Cadastra um Atendente | "Empleado registrado con éxito." e cargo "Asistente" |
| Campos obrigatórios | RN09 | Salva vazio | "Este campo é obrigatório." em nome e e-mail |
| **[BUG-007]** Cargo obrigatório | RN09 | Nome e e-mail válidos, sem cargo | Mensagem de campo obrigatório. *Falha hoje:* nenhuma mensagem aparece |
| Nome curto e e-mail inválido | RN09 | "F" e `sem-arroba` | Erros de tamanho e de e-mail |
| E-mail de outra autorizada | RN11 | Cria por API na Argentina e repete no Brasil | "Este e-mail já está cadastrado." |
| Falha do servidor (mock 500) | Erro de integração | `POST /api/employees` responde `500` | Mensagem genérica |
| Sem permissão (mock 403) | Erro de integração | `POST` responde `403` | Mensagem de permissão |

### Exibição por perfil e país

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Formulário só com cargos atribuíveis | Regra de cadastro | Lê as opções do select | "Selecione", Proprietário e Atendente; **sem** Super Admin |
| Lista proprietário e atendente | Listagem | Abre a tela | Ao menos 2 linhas; cargos corretos com `data-role` |
| Espanhol na Argentina, valor em português | RN07/RN08 | Proprietário da Argentina | Título "Empleados", cargo "Asistente" com `data-role="Atendente"` |
| **[RN04]** Isolamento | RN04 | Procura e-mails de outras autorizadas | Não aparecem |
| Filtra por cargo | Filtro | Seleciona Atendente e depois Proprietário (aguarda a requisição) | Só linhas do cargo escolhido |
| Limpar o filtro | Filtro | Filtra e volta a "Todos" | Todos os funcionários voltam |
| **[RN06]** Atendente só consulta | RN06 | Atendente abre a tela | Vê a lista; sem formulário |
| **[BUG-001]** Atendente na rota de criação | RN01/RN06 | Atendente abre `#/employees/create` | Sem formulário. *Falha hoje:* o formulário aparece |
| **[RN13]** Colômbia | RN13 | Abre `#/employees/create` com a Colômbia | Redireciona para `#/contacts`; sem formulário nem item de menu |

## UI · Produtos — `tests/desafio-qa/Products/` (RN07, RN08, RN12)

**Consiste em:** a tela de produtos com filtros, paginação, imagens e idioma. Os esperados vêm da fixture do catálogo.

### Listagem e paginação

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Primeira página | RN12 | Abre Produtos | 10 linhas; código, nome, modelo e situação do catálogo; selo `inactive`/`active` conforme a situação |
| Imagens carregadas | RN12 | Confere `naturalWidth` de cada imagem | 10 imagens com largura maior que zero |
| Página atual e total | Rodapé de paginação | Compara com o texto esperado | "Página 1 de 3 — 24 itens" |
| Navegação entre páginas | Paginação | Clica em "Próxima" até a última e volta uma | Texto e primeiro código corretos em cada página; última página com o resto; botões desabilitados nos extremos |
| Filtro volta à página 1 | Paginação | Vai à página 2 e filtra | "Página 1 de …" |

### Filtros

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Nome ou código sem diferenciar caixa | Filtro | `qz7k` e `K5172` | Códigos exibidos iguais aos calculados na fixture |
| Categoria / Situação | Filtros | `Peças`; `Inativo` | Só linhas do valor filtrado, na quantidade esperada |
| Combinação dos três | Filtros em conjunto | `qz7k` + SKU + `Inativo` | Códigos iguais aos calculados |
| Estado vazio | Sem resultado | Termo inexistente | "Nenhum produto encontrado." e nenhuma linha |
| Remover filtros | Recuperação | Limpa o nome e busca | 10 linhas |
| Opções de filtro | Listas | Conta as opções | 4 de categoria e 3 de situação (com "Todos") |

### Idioma (RN07, RN08)

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Espanhol na Argentina | RN07 | Usuário da Argentina | Título "Productos", rodapé em espanhol, situações "Activo"/"Inactivo" |
| **[BUG-006]** Categoria no idioma do usuário | RN07/RN08 | Compara cada célula com `categoryToLabel` da API | Rótulo em espanhol ("Repuestos"). *Falha hoje:* mostra o valor em português ("Peças") |
| Filtrar com a interface em espanhol | RN08 | Opção "Repuestos" e filtro `Peças` | A opção existe e o filtro devolve as linhas esperadas |

### Estados de integração (mock)

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Renderiza a resposta do servidor | Contrato → tela | Mock com fixture `resposta-mock.json` | 2 linhas, selos ativo/inativo, preço `1.234,50`, rodapé coerente |
| Lista vazia | Estado vazio | Mock com `items = []` | "Nenhum produto encontrado." |
| Imagem indisponível (mock 404) | Resiliência | Mock da lista + `404` nas imagens | Linhas exibidas e `<img>` sem `src` |
| **[BUG-008]** Falha na consulta (mock 500) | Feedback de erro | `500` em `/api/products` | Alerta visível ao usuário. *Falha hoje:* nenhum aviso (exceção não tratada) |

## UI · Regressão — `tests/desafio-qa/Regression.test.js`

**Consiste em:** um único teste que encadeia os fluxos críticos de ponta a ponta, reutilizando as funções `run<Contexto>`
de cada pasta.

| Teste | O que valida | Como é testado | Esperado |
|---|---|---|---|
| Run critical flows end to end | Caminho principal do negócio | Em sequência: login e logout (`runLogin`); cadastro de autorizada pelo Super Admin (`runRegisterAuthorized`); menu do proprietário (`runMenuAndAccess`); cadastro de contato (`runContacts`); cadastro de funcionário (`runEmployees`); filtro de produtos (`runProducts`); token expirado (`runExpiredSession`) | Todos os passos concluem sem erro |

---

# Como executar

| Comando | O que roda | Relatório |
|---|---|---|
| `npm run test:api` | `tests/api/**/*.test.js` | `reports/api/index.html` |
| `npm run test:e2e` | `tests/desafio-qa/**/*.test.js` | `reports/e2e/index.html` (screenshots das falhas embutidos) |
| `npm run cy:open` | Cypress interativo | — |
| `npx cypress run --spec "tests/desafio-qa/Contacts/Contacts.test.js"` | Um spec isolado | — |

Pré-requisito: aplicação no ar em `http://localhost:3000` (`npm start`) com o banco semeado (`npm run seed`).
**Resultado esperado hoje:** os testes sem marcação `[BUG-xxx]` passam; os marcados falham até o respectivo defeito ser corrigido.
