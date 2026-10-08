# Relatório de segurança: `.env` versionado e segredos padrão

Achado de higiene de segredos, registrado à parte de [defeitos.md](defeitos.md) porque não é um defeito funcional do
sistema-alvo e não tem teste automatizado que falhe de propósito.

| Campo | Valor |
|---|---|
| ID | SEC-001 |
| Severidade | **Baixa / informativa** (média ou alta se o código for publicado com esses valores) |
| Classificação | CWE-540 (segredo em arquivo versionado), CWE-798 (credencial embutida no código) |
| Status | Parcialmente mitigado (ver [Pendências](#pendências)) |

## Descrição

O repositório versionava dois arquivos de ambiente:

- `.env`, com a configuração efetiva da aplicação;
- `.env.example`, com os mesmos valores.

O `.gitignore` não ignorava `.env`. Os arquivos continham:

| Variável | Valor | Observação |
|---|---|---|
| `JWT_SECRET` | `dev-only-secret-change-me` | segredo conhecido de assinatura do token |
| `SUPERADMIN_PASSWORD` | `Admin@123` | senha do Super Admin inicial |
| `DEFAULT_EMPLOYEE_PASSWORD` | `Senha@123` | senha dos usuários criados pelas telas |
| `MONGO_URI` | `mongodb://127.0.0.1:27017` | banco local, sem credenciais |

O mesmo segredo de assinatura também aparece como valor padrão em `src/server/config.ts` e em `cypress.config.js`
(a suíte assina tokens próprios com ele).

## Impacto

- Quem conhece o `JWT_SECRET` consegue forjar um token de qualquer perfil, inclusive Super Admin, se a aplicação for
  executada com o valor padrão em um ambiente acessível por terceiros.
- A senha do Super Admin é previsível, o que permite acesso total em um ambiente publicado sem troca.
- Mesmo removidos do repositório, os arquivos **continuam no histórico do Git**.

## Fatores atenuantes

- O projeto é um desafio de QA executado em `localhost`; o README e o `.env.example` já declaravam os valores como
  fictícios.
- Não há credencial real exposta (chave de nuvem, senha de produção ou conexão com banco remoto).

## O que foi feito

| # | Ação | Onde |
|---|---|---|
| 1 | `.env` e `.env.example` removidos do repositório (`git rm`) | raiz |
| 2 | `.env` adicionado ao `.gitignore`, para que um arquivo local não seja versionado de novo | [.gitignore](../.gitignore) |
| 3 | A aplicação passou a subir **sem `.env`**: `SUPERADMIN_PASSWORD` ganhou valor padrão fictício (`Admin@123`) e o padrão de `MONGO_URI` passou a `127.0.0.1`, o mesmo valor do `.env` antigo | [src/server/config.ts](../src/server/config.ts) |
| 4 | `dotenv` mantido: um `.env` local, quando existir, continua sendo lido e as variáveis de ambiente continuam tendo prioridade sobre os padrões | [src/server/config.ts](../src/server/config.ts) |
| 5 | README atualizado: a configuração deixa de apontar para o `.env` versionado | [README.md](../README.md) |
| 6 | CI inalterada: já definia `SUPERADMIN_PASSWORD` e as demais variáveis no workflow | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |

### Verificação

- `npm run typecheck` sem erros.
- `npm start` sem `.env` presente: o servidor sobe e `http://localhost:3000` responde `200`.

### Ressalva sobre a solução adotada

Antes, `SUPERADMIN_PASSWORD` era obrigatória e o servidor falhava sem ela, o que era o comportamento mais seguro.
Para manter tudo executando sem `.env` (requisito desta mudança), a variável passou a ter padrão. Isso remove o
arquivo versionado, mas **mantém credenciais fictícias embutidas no código**. É aceitável para um desafio local; não é
para um ambiente real.

## Pendências

Recomendações ainda **não implementadas**:

1. Exigir `JWT_SECRET` e `SUPERADMIN_PASSWORD` quando `NODE_ENV=production` (falhar na inicialização), mantendo os
   padrões só em desenvolvimento e teste.
2. Rotacionar qualquer segredo que tenha sido usado fora de um ambiente local.
3. Se o histórico precisar ser limpo, reescrevê-lo com `git filter-repo` ou BFG e avisar quem clonou o repositório.
4. Centralizar o segredo usado pelo Cypress, evitando duplicar o valor padrão em `cypress.config.js`.
