/**
 * Matriz de permissões: perfil x endpoint -> status HTTP esperado (RN01, RN06, RN13, RN14).
 * Esconder uma opção na tela não protege nada: o backend precisa recusar a chamada direta.
 *
 * `bug` marca a célula cujo comportamento real diverge do esperado (ver docs/defeitos.md).
 */
import { uniqueEmail, uniqueName } from "./data";

export const PROFILES = [
  "superAdmin",
  "owner",
  "attendant",
  "ownerColombia",
  "anonymous",
];

export const PROFILE_LABELS = {
  superAdmin: "Super Admin",
  owner: "Proprietário",
  attendant: "Atendente",
  ownerColombia: "Proprietário da Colômbia",
  anonymous: "Sem login",
};

export const ENDPOINTS = [
  {
    name: "listar autorizadas",
    method: "GET",
    url: "/api/authorizeds",
    expected: {
      superAdmin: 200,
      owner: 403,
      attendant: 403,
      ownerColombia: 403,
      anonymous: 401,
    },
  },
  {
    name: "criar autorizada",
    method: "POST",
    url: "/api/authorizeds",
    body: () => ({
      authorizedName: uniqueName("Autorizada Matriz"),
      ownerName: "Proprietário Matriz",
      ownerEmail: uniqueEmail("matriz"),
      country: "brasil",
    }),
    expected: {
      superAdmin: 201,
      owner: 403,
      attendant: 403,
      ownerColombia: 403,
      anonymous: 401,
    },
  },
  {
    name: "listar contatos",
    method: "GET",
    url: "/api/contacts",
    expected: {
      superAdmin: 403,
      owner: 200,
      attendant: 200,
      ownerColombia: 200,
      anonymous: 401,
    },
  },
  {
    name: "criar contato",
    method: "POST",
    url: "/api/contacts",
    // 10 dígitos: válido tanto para o Brasil quanto para a Colômbia
    body: () => ({
      name: "Contato Matriz",
      email: uniqueEmail("contato.matriz"),
      phone: "1198765432",
    }),
    expected: {
      superAdmin: 403,
      owner: 201,
      attendant: 403,
      ownerColombia: 201,
      anonymous: 401,
    },
  },
  {
    name: "listar funcionários",
    method: "GET",
    url: "/api/employees",
    expected: {
      superAdmin: 403,
      owner: 200,
      attendant: 200,
      ownerColombia: 403,
      anonymous: 401,
    },
  },
  {
    name: "criar funcionário",
    method: "POST",
    url: "/api/employees",
    body: () => ({
      name: "Funcionário Matriz",
      email: uniqueEmail("funcionario.matriz"),
      role: "Atendente",
    }),
    expected: {
      superAdmin: 403,
      owner: 201,
      attendant: 403,
      ownerColombia: 403,
      anonymous: 401,
    },
    bug: { attendant: "BUG-001" },
  },
  {
    name: "listar produtos",
    method: "GET",
    url: "/api/products",
    expected: {
      superAdmin: 200,
      owner: 200,
      attendant: 200,
      ownerColombia: 200,
      anonymous: 401,
    },
  },
  {
    name: "consultar listas de valores",
    method: "GET",
    url: "/api/picklists",
    expected: {
      superAdmin: 200,
      owner: 200,
      attendant: 200,
      ownerColombia: 200,
      anonymous: 401,
    },
  },
];
