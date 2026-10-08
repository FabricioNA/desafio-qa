import { call } from "../../support/api/base";
import { ContactsApi } from "../../support/api/contacts.api";
import { ProductsApi } from "../../support/api/products.api";
import { uniqueEmail } from "../../support/data";
import { provisionTenant } from "../../support/tenant";

// Número com a quantidade exata de dígitos, começando pelo prefixo informado
const digits = (start, length) => start.padEnd(length, "9");

describe("Robustez de entrada e valores limite (RN09, RN10, RN12)", () => {
  const tenants = {};

  before(() => {
    ["brasil", "colombia"].forEach((country) => {
      provisionTenant(country, false).then(
        (tenant) => (tenants[country] = tenant),
      );
    });
  });

  const contact = (overrides = {}) => ({
    name: "Contato Limite",
    email: uniqueEmail("limite"),
    phone: "11987654321",
    ...overrides,
  });

  context("Requisições malformadas devem ser erro do cliente (4xx)", () => {
    it("[BUG-009] rejeita JSON malformado com 400 em vez de 500", () => {
      cy.request({
        method: "POST",
        url: "/api/contacts",
        headers: {
          Authorization: `Bearer ${tenants.brasil.owner.token}`,
          "Content-Type": "application/json",
        },
        body: '{"name": ',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, "JSON inválido é erro do cliente").to.eq(400);
      });
    });

    it("[BUG-009] rejeita JSON malformado no login com 400 em vez de 500", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
        failOnStatusCode: false,
      })
        .its("status")
        .should("eq", 400);
    });

    it("[BUG-009] rejeita corpo acima do limite (100 kb) com 4xx em vez de 500", () => {
      ContactsApi.create(
        tenants.brasil.owner.token,
        contact({ name: "x".repeat(200000) }),
      ).then((response) => {
        expect(response.status).to.be.oneOf([400, 413]);
      });
    });

    it("rejeita tipos inesperados nos campos (número, lista, objeto) com 400", () => {
      ContactsApi.create(tenants.brasil.owner.token, {
        name: 123,
        email: ["a@b.com"],
        phone: {},
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.fields).to.deep.eq({
          name: "REQUIRED",
          email: "REQUIRED",
          phone: "REQUIRED",
        });
      });
    });

    it("rejeita e-mail com espaço no meio", () => {
      ContactsApi.create(
        tenants.brasil.owner.token,
        contact({ email: "a b@example.com" }),
      ).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.fields.email).to.eq("INVALID_EMAIL");
      });
    });
  });

  context("Nome: limite mínimo", () => {
    it("aceita o nome com exatamente 2 caracteres", () => {
      ContactsApi.create(tenants.brasil.owner.token, contact({ name: "Jo" }))
        .its("status")
        .should("eq", 201);
    });

    it("rejeita o nome com 1 caractere e o nome só com espaços", () => {
      ContactsApi.create(
        tenants.brasil.owner.token,
        contact({ name: "J" }),
      ).then((response) =>
        expect(response.body.fields.name).to.eq("MIN_LENGTH"),
      );
      ContactsApi.create(
        tenants.brasil.owner.token,
        contact({ name: "   " }),
      ).then((response) => expect(response.body.fields.name).to.eq("REQUIRED"));
    });
  });

  context("Telefone: quantidade de dígitos no limite (RN10)", () => {
    ["brasil", "colombia"].forEach((country) => {
      it(`[${country}] aceita o mínimo e o máximo e rejeita um dígito a menos e um a mais`, () => {
        cy.fixture("contacts/contatos.json").then(({ limites }) => {
          const { min, max, inicio } = limites[country];
          const token = tenants[country].owner.token;

          [min, max].forEach((length) => {
            ContactsApi.create(
              token,
              contact({ phone: digits(inicio, length) }),
            ).then((response) => {
              expect(response.status, `${length} dígitos`).to.eq(201);
            });
          });

          [min - 1, max + 1].forEach((length) => {
            ContactsApi.create(
              token,
              contact({ phone: digits(inicio, length) }),
            ).then((response) => {
              expect(response.status, `${length} dígitos`).to.eq(400);
              expect(response.body.fields.phone).to.eq("INVALID_PHONE");
            });
          });
        });
      });
    });
  });

  context("Produtos: paginação nos limites (RN12)", () => {
    const list = (query) => ProductsApi.list(tenants.brasil.owner.token, query);

    it("aceita pageSize 1 e 50 e limita 51 a 50", () => {
      list({ pageSize: 1 }).its("body.items").should("have.length", 1);
      list({ pageSize: 50 }).its("body.pageSize").should("eq", 50);
      list({ pageSize: 51 }).its("body.pageSize").should("eq", 50);
    });

    it("usa o tamanho padrão (10) quando o pageSize é zero ou não numérico", () => {
      cy.request({
        url: "/api/products",
        qs: { pageSize: "abc" },
        headers: { Authorization: `Bearer ${tenants.brasil.owner.token}` },
      })
        .its("body.pageSize")
        .should("eq", 10);
      list({ pageSize: 0 }).its("body.pageSize").should("eq", 10);
    });

    it("usa a primeira página quando a página é zero ou não numérica", () => {
      list({ page: 0 }).its("body.page").should("eq", 1);
      cy.request({
        url: "/api/products",
        qs: { page: "abc" },
        headers: { Authorization: `Bearer ${tenants.brasil.owner.token}` },
      })
        .its("body.page")
        .should("eq", 1);
    });
  });

  context("Armazenamento de texto", () => {
    it("guarda e devolve um nome com HTML sem alterar (o escape é responsabilidade da tela)", () => {
      const name = '<img src=x onerror="window.__xss=true">';
      ContactsApi.create(tenants.brasil.owner.token, contact({ name })).then(
        (response) => {
          expect(response.status).to.eq(201);
          expect(response.body.name).to.eq(name);
        },
      );
    });

    it("aceita acentos e emojis no nome", () => {
      const name = "José Ação 😀";
      ContactsApi.create(tenants.brasil.owner.token, contact({ name })).then(
        (response) => {
          expect(response.status).to.eq(201);
          expect(response.body.name).to.eq(name);
        },
      );
    });
  });
});
