# Desafio QA — Mini Portal (sistema-alvo)

Sistema fictício, Ele existe para ser **testado**: não há testes automatizados no repositório, eles são o desafio.

- **Backend:** Node + Express + TypeScript, MongoDB, autenticação por JWT (permissões dentro do token).
- **Front:** HTML + TypeScript (sem framework), gerado com esbuild e servido pelo próprio backend.
- **Roda igual** na máquina local e no GitHub Actions (`npm start` sobe tudo em `http://localhost:3000`).

## Requisitos

- Node 20 ou superior
- MongoDB rodando (local em `mongodb://localhost:27017` ou outro endereço via `MONGO_URI`)

## Como rodar

```bash
npm install
npm start          # gera o front, conecta no Mongo, cria os dados iniciais (se vazio) e sobe a API + front
```

Abra `http://localhost:3000`.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run seed` | Apaga e recria os dados iniciais (1 Super Admin e 24 produtos; remove autorizadas, funcionários e contatos criados) |
| `npm run dev` | Igual ao `start`, reiniciando o servidor a cada alteração |
| `npm run typecheck` | Checagem de tipos |
| `npm run test:api` | Testes de API (Cypress) — relatório em `reports/api/index.html` |
| `npm run test:e2e` | Testes de interface (Cypress) — relatório em `reports/e2e/index.html` |
| `npm run cy:open` | Abre o Cypress no modo interativo |

Os testes exigem a aplicação no ar em `http://localhost:3000` (`npm start`); use `BASE_URL` para outro endereço.
Documentação de cada teste em [docs/testes.md](docs/testes.md), decisões em [docs/decisoes.md](docs/decisoes.md) e defeitos encontrados em [docs/defeitos.md](docs/defeitos.md).

Configuração: as variáveis (porta, Mongo, segredo do token e credenciais iniciais) ficam no arquivo `.env`, na raiz do projeto (todos os valores são fictícios).

## Regras de negócio

Regras gerais do sistema, descritas de forma resumida. Elas valem como referência do comportamento esperado.

- **RN01 — Acesso por perfil.** Cada usuário só acessa as telas e executa as ações permitidas ao seu perfil, tanto pela interface quanto pela API.
- **RN02 — Menu.** O menu exibe apenas as telas que o usuário pode acessar.
- **RN03 — Autorizadas.** Uma autorizada é uma empresa parceira, criada por um administrador da plataforma junto com o seu proprietário. O país é definido nesse cadastro.
- **RN04 — Isolamento.** Os dados de uma autorizada não são visíveis nem alteráveis por usuários de outra autorizada.
- **RN05 — Funcionários.** Os funcionários de uma autorizada são cadastrados pelos perfis com permissão de escrita. Cada funcionário pertence a uma única autorizada e herda o país e o idioma dela.
- **RN06 — Consulta.** Perfis de consulta visualizam as informações da sua autorizada, mas não criam nem alteram dados.
- **RN07 — Idioma.** Os textos da interface são exibidos no idioma do usuário, definido pelo país da autorizada.
- **RN08 — Listas de valores.** Os valores de listas (cargo, categoria, situação, país) são identificados da mesma forma em todo o sistema e exibidos ao usuário no idioma dele.
- **RN09 — Campos obrigatórios e formatos.** Os formulários rejeitam dados incompletos ou fora do formato esperado e informam o motivo ao usuário.
- **RN10 — Telefone.** O telefone segue o formato do país do usuário.
- **RN11 — Unicidade.** Não pode haver dois cadastros com o mesmo e-mail dentro do escopo em que ele deve ser único.
- **RN12 — Produtos.** A consulta de produtos pode ser filtrada e é paginada; cada produto exibe a sua imagem.
- **RN13 — Restrições por país.** Algumas funcionalidades podem não estar disponíveis para determinados países.
- **RN14 — Sessão.** O acesso exige autenticação e a sessão tem prazo de validade.

## Como o sistema funciona

O modelo segue a lógica : cada **autorizada** (empresa parceira) enxerga apenas os próprios dados.

1. Existe **1 Super Admin** já cadastrado (administrador da plataforma). Ele **não** pertence a nenhuma autorizada.
2. O Super Admin cria uma **autorizada** e o seu **proprietário**, definindo o **país** (tela "Autorizadas", visível só para ele).
3. O **proprietário** entra, cadastra os funcionários **da própria autorizada** (Atendente ou Proprietário) e opera os contatos dela.
4. O **atendente** só visualiza.

O **idioma da interface** vem do token e é definido pelo país da autorizada (Brasil: `pt`; Argentina e Colômbia: `es`).
Funcionários novos herdam país e idioma da autorizada.

### Acesso inicial

| Campo | Valor |
|---|---|
| E-mail do Super Admin | `superadmin@example.com` |
| Senha | `Admin@123` |

Todo proprietário e funcionário criado pelas telas recebe a senha padrão `Senha@123` (`DEFAULT_EMPLOYEE_PASSWORD`).

Para ver o sistema em espanhol: entre como Super Admin, crie uma autorizada com país Argentina (ou Colômbia) e um
e-mail de proprietário, saia e entre com esse e-mail e a senha padrão.

## Telas

O menu superior mostra apenas as telas que o token do usuário permite acessar.

| Tela | Quem vê | Conteúdo |
|---|---|---|
| **Autorizadas** | só o Super Admin | Formulário (nome da autorizada, nome e e-mail do proprietário, país) e listagem de autorizadas |
| **Contatos** | proprietário e atendente | Formulário de 3 campos (nome, e-mail, telefone) e listagem dos contatos da autorizada. O formato de telefone e o placeholder mudam conforme o país |
| **Produtos** | todos | 3 filtros (nome ou código, categoria, situação) e tabela paginada (10 por página) com imagem, código, nome, categoria, modelo, situação e preço, vinda do backend; as imagens ficam no MongoDB |
| **Funcionários** | proprietário e atendente | Formulário de 3 campos (nome, e-mail, cargo) e listagem, com filtro por cargo, dos funcionários **da própria autorizada** |

## Perfis e permissões

O backend define as permissões no login e as devolve no JWT, por exemplo:

```json
{
  "role": "Proprietário",
  "roleToLabel": "Propietario",
  "language": "es",
  "country": "argentina",
  "authorizedId": "…",
  "authorizedName": "Autorizada Exemplo",
  "permissions": { "contacts": "read/write", "products": "read", "employees": "read/write" }
}
```

| Cargo | Autorizadas | Contatos | Produtos | Funcionários |
|---|---|---|---|---|
| Super Admin | ler e criar | — | ler | — |
| Proprietário | — | ler e criar | ler | ler e criar |
| Atendente | — | só ler | ler | só ler |

Regras adicionais:

- Contatos e funcionários são **isolados por autorizada**: um usuário nunca vê nem cria dados de outra autorizada.
- O cadastro de funcionário só oferece Atendente e Proprietário (o Super Admin só existe no seed).
- O módulo de **Funcionários não existe para usuários do país `colombia`**: a permissão não vem no token,
  o item some do menu e a API responde 403.
- O e-mail de um funcionário é único em todo o sistema; o e-mail de um contato é único dentro da autorizada.
- O backend valida assinatura e expiração do token em toda requisição e confia nas permissões do próprio token.

## API

Documentação interativa (Swagger) com a aplicação no ar: [http://localhost:3000/api-docs.html](http://localhost:3000/api-docs.html) (especificação em `/openapi.json`).

Todas as rotas, exceto `login` e `health`, exigem `Authorization: Bearer <token>`.

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /api/health` | — | Verificação de saúde |
| `POST /api/login` | — | `{ email, password }` → `{ token }` |
| `GET /api/picklists` | qualquer usuário logado | Opções dos picklists (`category`, `status`, `role`, `assignableRole`, `country`) no idioma do usuário |
| `GET /api/authorizeds` | authorizeds (leitura) | Autorizadas com proprietário e quantidade de funcionários |
| `POST /api/authorizeds` | authorizeds (escrita) | `{ authorizedName, ownerName, ownerEmail, country }` cria a autorizada e o proprietário |
| `GET /api/contacts` | contacts (leitura) | Últimos contatos da autorizada |
| `POST /api/contacts` | contacts (escrita) | `{ name, email, phone }` |
| `GET /api/products` | products (leitura) | Query: `name` (busca no nome ou no código), `category` (`Peças`, `SKU (White Goods Mercado Nacional)`, `Modelo Usual (White Goods Mercado Nacional)`), `status` (`Ativo`, `Inativo`), `page`, `pageSize` |
| `GET /api/products/:id/image` | products (leitura) | Imagem PNG do produto |
| `GET /api/employees` | employees (leitura) | Funcionários da autorizada. Query opcional: `role` |
| `POST /api/employees` | employees (escrita) | `{ name, email, role }` na autorizada do usuário |

### Valores e rótulos (picklists)

Os valores de picklist **trafegam sempre em português** (por exemplo `category: "Casa"`, `status: "Ativo"`,
`role: "Atendente"`), com o mesmo nome de parâmetro nas requisições e nas respostas. Para exibição, o backend devolve,
ao lado de cada campo, o texto no idioma do usuário (vindo do token) em `<campo>ToLabel`
(por exemplo `category` e `categoryToLabel`). As listas de opções devolvem pares `{ value, toLabel }`:
o front envia o `value` e exibe o `toLabel`.

Erros seguem o padrão `{ "error": "CODIGO", "fields": { "campo": "CODIGO" } }`. Códigos usados:
`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `INVALID_CREDENTIALS`, `DUPLICATE_EMAIL`, `NOT_FOUND`.
Os códigos de campo (`REQUIRED`, `MIN_LENGTH`, `INVALID_EMAIL`, `INVALID_PHONE`, `INVALID_ROLE`, `INVALID_COUNTRY`)
são traduzidos pelo front.

### Telefone por país

| País | Código | Dígitos do número nacional |
|---|---|---|
| `brasil` | 55 | 10 ou 11 |
| `argentina` | 54 | 10 |
| `colombia` | 57 | 10 |

O telefone é guardado normalizado (`+<código><número>`).

No front, o campo **Telefone** aplica:

- bloqueio de letras e símbolos, e limite de dígitos do país;
- prefixo automático (`+55 `, `+54 ` ou `+57 `) e máscara: Brasil `(00) 0000-0000` (fixo) ou `(00) 00000-0000` (celular),
  Colômbia `000 000 0000`, Argentina só dígitos;
- aceita colar o número com ou sem o código do país;
- mensagem "telefone inválido" ao sair do campo com quantidade de dígitos insuficiente (ela some ao voltar a digitar).

O backend valida de novo, com as mesmas regras.

## Estrutura

```
src/server/   API (rotas, auth, permissões, validação, seed, conexão com o Mongo)
src/web/      Front (páginas, i18n em pt/es/en, cliente da API)
tests/        Suíte Cypress (API e UI com Page Objects, fixtures e suporte)
docs/         Decisões de teste e registro de defeitos
public/       index.html e CSS (o app.js é gerado no build)
.github/workflows/ci.yml   Instala, checa tipos, gera o front e confere o health check
```

## Dicas para quem for testar


- Para começar sempre do mesmo estado, rode `npm run seed` antes dos testes (use um banco próprio com `MONGO_DB`).

## GitHub Actions

O workflow sobe um MongoDB como serviço, instala as dependências (`npm ci`), checa tipos, gera o front, recria os dados,
inicia a aplicação, roda `test:api` e `test:e2e` e publica o artefato **relatorios-testes** (HTML e screenshots das falhas).
Gatilhos: pull request, push na `main`, agendado (dias úteis) e manual. Detalhes em [docs/decisoes.md](docs/decisoes.md).

## Anonimização

Nenhum dado, nome, endereço ou termo de empresa real foi usado: e-mails em `example.com`, produtos e códigos inventados
("K51720601", modelos "QZ7K", "LV2P"…), imagens geradas por código, segredo de JWT apenas de exemplo.
