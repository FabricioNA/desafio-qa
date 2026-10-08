import { ContactsApi } from "../../support/api/contacts.api";
import { EmployeesApi } from "../../support/api/employees.api";
import { AuthorizedsApi } from "../../support/api/authorizeds.api";
import { uniqueEmail } from "../../support/data";
import { provisionTenant, superAdminSession } from "../../support/tenant";

const emails = (response) => response.body.items.map((item) => item.email);

describe("Isolamento entre autorizadas e proteção de dados (RN04, RN05)", () => {
  let a;
  let b;
  let admin;

  before(() => {
    provisionTenant("brasil").then((tenant) => (a = tenant));
    provisionTenant("argentina").then((tenant) => (b = tenant));
    superAdminSession().then((session) => (admin = session));
  });

  context("O cliente não escolhe a autorizada", () => {
    it("ignora o authorizedId enviado no corpo do contato e grava na autorizada do token", () => {
      const email = uniqueEmail("mass.contato");
      ContactsApi.create(a.owner.token, {
        name: "Contato Injetado",
        email,
        phone: "11987654321",
        authorizedId: b.authorizedId,
      }).then((created) => {
        expect(created.status).to.eq(201);
        ContactsApi.list(a.owner.token).then((own) => {
          expect(emails(own)).to.include(email);
        });
        ContactsApi.list(b.owner.token).then((other) => {
          expect(emails(other)).not.to.include(email);
        });
      });
    });

    it("ignora id, país, idioma e autorizada enviados no corpo do funcionário", () => {
      const email = uniqueEmail("mass.funcionario");
      EmployeesApi.create(a.owner.token, {
        name: "Funcionário Injetado",
        email,
        role: "Atendente",
        authorizedId: b.authorizedId,
        country: "argentina",
        language: "es",
        id: "id-forcado",
      }).then((created) => {
        expect(created.status).to.eq(201);
        expect(created.body).to.deep.include({
          country: "brasil",
          language: "pt",
        });
        expect(created.body.id).not.to.eq("id-forcado");
        EmployeesApi.list(b.owner.token).then((other) => {
          expect(emails(other)).not.to.include(email);
        });
      });
    });

    it("ignora o authorizedId passado na consulta de funcionários", () => {
      EmployeesApi.list(a.owner.token).then((own) => {
        cy.request({
          url: "/api/employees",
          qs: { authorizedId: b.authorizedId },
          headers: { Authorization: `Bearer ${a.owner.token}` },
        }).then((response) => {
          expect(emails(response)).to.have.members(emails(own));
          expect(emails(response)).not.to.include(b.owner.email);
        });
      });
    });

    it("ignora o authorizedId passado na consulta de contatos", () => {
      const email = uniqueEmail("contato.b");
      ContactsApi.create(b.owner.token, {
        name: "Contato de B",
        email,
        phone: "1123456789",
      });
      cy.request({
        url: "/api/contacts",
        qs: { authorizedId: b.authorizedId },
        headers: { Authorization: `Bearer ${a.owner.token}` },
      }).then((response) => {
        expect(emails(response)).not.to.include(email);
      });
    });
  });

  context("Dados sensíveis", () => {
    const hasSecret = (value) =>
      /passwordHash|password/i.test(JSON.stringify(value));

    it("a listagem de funcionários não expõe senha nem hash", () => {
      EmployeesApi.list(a.owner.token).then((response) => {
        expect(hasSecret(response.body)).to.eq(false);
      });
    });

    it("a listagem de autorizadas não expõe senha nem hash", () => {
      AuthorizedsApi.list(admin.token).then((response) => {
        expect(hasSecret(response.body)).to.eq(false);
      });
    });

    it("a criação de funcionário não devolve senha nem hash", () => {
      EmployeesApi.create(a.owner.token, {
        name: "Sem Segredo",
        email: uniqueEmail("sem.segredo"),
        role: "Atendente",
      }).then((response) => {
        expect(hasSecret(response.body)).to.eq(false);
      });
    });
  });

  context("Operações não oferecidas", () => {
    ["PUT", "PATCH", "DELETE"].forEach((method) => {
      ["/api/contacts", "/api/employees", "/api/authorizeds"].forEach((url) => {
        it(`${method} ${url} não existe`, () => {
          cy.request({
            method,
            url,
            headers: { Authorization: `Bearer ${a.owner.token}` },
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.eq(404);
            expect(response.body).to.deep.eq({ error: "NOT_FOUND" });
          });
        });
      });
    });
  });
});
