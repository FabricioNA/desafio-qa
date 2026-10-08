# Registro de defeitos

Defeitos encontrados na execução da suíte automatizada. Cada defeito tem um teste marcado com `[BUG-xxx]` no título,
que **falha de propósito** enquanto o defeito existir e passa quando for corrigido (serve de teste de regressão).
Os screenshots das falhas ficam no relatório HTML (`reports/api/index.html` e `reports/e2e/index.html`).

Severidade: **Alta** (segurança ou violação de regra de acesso), **Média** (regra de negócio ou dado incorreto),
**Baixa** (apresentação ou usabilidade).

| ID | Resumo | Severidade | Regra | Camada |
|---|---|---|---|---|
| BUG-001 | Atendente consegue cadastrar funcionários | Alta | RN01, RN06 | API e UI |
| BUG-002 | Login aceita e envia a senha na URL (`GET /api/login`) | Alta | RN14 | API e UI |
| BUG-003 | Telefone da Argentina não é validado nem normalizado no backend | Média | RN09, RN10 | API |
| BUG-004 | Campo telefone da Argentina sem máscara, prefixo e validação no front | Média | RN10 | UI |
| BUG-005 | Formulário de Contatos da Argentina exibido em português | Média | RN07 | UI |
| BUG-006 | Coluna Categoria dos Produtos exibe o valor em português para usuários de outro idioma | Média | RN07, RN08 | UI |
| BUG-007 | Cadastro de funcionário sem cargo não informa o motivo | Baixa | RN09 | UI |
| BUG-008 | Falha na consulta de produtos não gera nenhum aviso ao usuário | Baixa | — | UI |
| BUG-009 | JSON malformado ou corpo acima de 100 kb resulta em `500` em vez de erro do cliente | Média | RN09 | API |

---

## BUG-001 — Atendente consegue cadastrar funcionários

- **Severidade:** Alta · **Regras:** RN01 (acesso por perfil), RN06 (consulta não altera dados)
- **Passos (API):** autenticar como Atendente e enviar `POST /api/employees` com `{ name, email, role: "Proprietário" }`.
- **Esperado:** `403 FORBIDDEN` (atendente só tem `employees: "read"`).
- **Obtido:** `201`, o funcionário é gravado. O atendente pode inclusive criar outro Proprietário.
- **Passos (UI):** entrar como Atendente e abrir `#/employees/create`. O formulário de cadastro é exibido.
- **Causa provável:** a rota exige permissão de leitura em vez de escrita
  ([employees.ts](../src/server/routes/employees.ts), `requirePermission('employees', 'read')`);
  a rota oculta do front força o formulário ([app.ts](../src/web/app.ts), `showForm: true`).
- **Testes:** `tests/api/permissions/matriz-permissoes.test.js` (célula Atendente × criar funcionário), `tests/api/employees/cadastro-funcionario.test.js` (2 testes) e `tests/desafio-qa/Employees` ("Attendant does not see the form when opening the create route by deep link").

## BUG-002 — Login aceita e envia a senha na URL

- **Severidade:** Alta · **Regra:** RN14 (sessão/autenticação)
- **Passos:** `GET /api/login?email=superadmin@example.com&password=Admin@123`; ou fazer login pela interface e observar a requisição.
- **Esperado:** credenciais só no corpo de um `POST`.
- **Obtido:** a rota GET autentica e o front a utiliza. A senha fica em histórico, logs de acesso (o servidor registra `originalUrl`) e cabeçalho `Referer`.
- **Causa provável:** [auth.ts](../src/server/routes/auth.ts) mantém `authRouter.get('/login')` e [api.ts](../src/web/api.ts) chama `request('/login?...')`.
- **Testes:** `tests/api/auth/autenticacao.test.js` e `tests/desafio-qa/Login`.

## BUG-003 — Telefone da Argentina não é validado nem normalizado no backend

- **Severidade:** Média · **Regras:** RN09, RN10
- **Passos:** como proprietário de uma autorizada da Argentina, `POST /api/contacts` com `phone: "12345"`, `"abcdefghij"` ou `"11234567890"`.
- **Esperado:** `400` com `fields.phone = INVALID_PHONE`; telefones válidos (10 dígitos) gravados como `+54<número>`.
- **Obtido:** `201` para qualquer texto, gravado como foi enviado (sem o prefixo `+54`).
- **Causa provável:** [validation.ts](../src/server/validation.ts) usa `country === 'argentina' ? phoneRaw : normalizePhone(...)`.
- **Testes:** `tests/api/contacts/cadastro-contato.test.js` (2 testes de Argentina).

## BUG-004 — Campo telefone da Argentina sem máscara, prefixo e validação no front

- **Severidade:** Média · **Regra:** RN10
- **Passos:** entrar como proprietário da Argentina, abrir Contatos e digitar `1123456789` no telefone.
- **Esperado (README):** prefixo `+54 ` automático, somente dígitos, limite de 10 e aviso de "telefone inválido" ao sair do campo incompleto.
- **Obtido:** o campo aceita qualquer texto, sem prefixo, limite nem aviso.
- **Causa provável:** [contacts.ts](../src/web/pages/contacts.ts) só chama `attachPhoneMask` quando `country !== 'argentina'`.
- **Testes:** `tests/desafio-qa/Contacts` (2 testes de Argentina).

## BUG-005 — Formulário de Contatos da Argentina exibido em português

- **Severidade:** Média · **Regra:** RN07 (idioma)
- **Passos:** entrar como proprietário da Argentina (idioma `es`) e abrir Contatos.
- **Esperado:** rótulos "Nombre", "Correo electrónico", "Teléfono".
- **Obtido:** "Nome", "E-mail", "Telefone" (a Colômbia, também `es`, aparece correta).
- **Causa provável:** [contacts.ts](../src/web/pages/contacts.ts) força `'pt'` na função `label` quando o país é Argentina.
- **Teste:** `tests/desafio-qa/Contacts`.

## BUG-006 — Categoria do produto exibida sem tradução

- **Severidade:** Média · **Regras:** RN07, RN08
- **Passos:** entrar como usuário da Argentina e abrir Produtos.
- **Esperado:** categoria pelo rótulo do usuário (`categoryToLabel`, por exemplo "Repuestos"), como já acontece com a situação.
- **Obtido:** a coluna mostra o valor em português ("Peças").
- **Causa provável:** [products.ts](../src/web/pages/products.ts) renderiza `item.category` em vez de `item.categoryToLabel`.
- **Teste:** `tests/desafio-qa/Products`.

## BUG-007 — Cadastro de funcionário sem cargo não informa o motivo

- **Severidade:** Baixa · **Regra:** RN09 ("informam o motivo ao usuário")
- **Passos:** preencher nome e e-mail válidos, deixar o cargo em "Selecione" e salvar.
- **Esperado:** mensagem de campo obrigatório para o cargo.
- **Obtido:** nada é gravado e nenhuma mensagem aparece (o erro `role` é ignorado e o formulário não tem área de erro para o cargo).
- **Causa provável:** [employees.ts](../src/web/pages/employees.ts) usa `showFieldErrors(..., { ignore: ['role'] })` e o select não tem `data-error-for`.
- **Teste:** `tests/desafio-qa/Employees`.

## BUG-008 — Falha na consulta de produtos não gera aviso

- **Severidade:** Baixa
- **Passos:** simular `500` em `GET /api/products` e abrir Produtos.
- **Esperado:** mensagem de erro ao usuário.
- **Obtido:** a área de resultados fica vazia e o erro vira exceção não tratada (`unhandledrejection`) no console.
- **Causa provável:** [products.ts](../src/web/pages/products.ts) não trata a rejeição de `api.get`. O mesmo vale para as listagens das demais telas.
- **Teste:** `tests/desafio-qa/Products`.

## BUG-009 — Requisição malformada ou grande demais resulta em erro 500

- **Severidade:** Média · **Regra:** RN09 (formulários rejeitam dados fora do formato e informam o motivo)
- **Passos:** `POST /api/contacts` (ou `/api/login`) com corpo `{"name": ` (JSON inválido) ou com um nome de 200 mil caracteres (corpo acima de 100 kb).
- **Esperado:** erro do cliente: `400` para JSON inválido e `413` (ou `400`) para corpo acima do limite.
- **Obtido:** `500 INTERNAL_ERROR`. O erro de leitura do corpo cai no tratador genérico de falhas do servidor, que o registra como erro interno.
- **Impacto:** entrada inválida é indistinguível de uma falha real do servidor; polui o monitoramento (alertas de 5xx) e facilita ruído em ataques.
- **Causa provável:** [app.ts](../src/server/app.ts) — o *error handler* final responde sempre `500`, sem tratar os erros de `express.json()` (`status` 400/413).
- **Testes:** `tests/api/robustness/robustez-entrada.test.js` (3 testes).

---

## Observações (sem teste automatizado)

- Os campos de texto não têm limite máximo: nome de 5.000 caracteres e e-mail com mais de 300 caracteres são aceitos
  (o README não define limite; vale alinhar com o produto, pois e-mail acima de 254 caracteres é inválido pela RFC).
- `page=1.5` devolve `page: 1.5` na paginação de produtos (o valor deveria ser inteiro).
- O filtro de cargo em Funcionários lista "Super Admin", que nunca existe dentro de uma autorizada (a lista `role` é a mesma do cadastro de usuários da plataforma).
- A listagem de contatos é limitada às 50 últimas linhas, sem paginação nem aviso ao usuário.
- Ao receber `401` o front limpa a sessão e recarrega a página, mas a chamada interrompida gera uma exceção não tratada
  (`UNAUTHORIZED`) no console; os testes de sessão a ignoram explicitamente.
- A senha padrão dos funcionários é igual para todos e não há troca obrigatória no primeiro acesso.

## Verificado e sem defeito

Cenários de segurança investigados que **se comportam corretamente** e por isso viraram testes de regressão:

- `authorizedId`, `country`, `language` e `id` enviados no corpo são ignorados (o servidor usa o token) — `tests/api/isolation`.
- Listagens e criações não expõem senha nem hash.
- Texto com HTML (`<img onerror=…>`) é exibido como texto e não é executado — `Contacts` e `Employees` (UI).
- Valores de tipo inesperado (número, lista, objeto) nos campos são rejeitados com `400`.
- `PUT`, `PATCH` e `DELETE` nas rotas de cadastro respondem `404` (não há alteração nem exclusão).
