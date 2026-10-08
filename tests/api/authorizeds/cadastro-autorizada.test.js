import { SLA_MS } from "../../support/api/base";
import { AuthApi } from "../../support/api/auth.api";
import { AuthorizedsApi } from "../../support/api/authorizeds.api";
import { EmployeesApi } from "../../support/api/employees.api";
import { decodeJwt, uniqueEmail, uniqueName } from "../../support/data";
import { provisionTenant, superAdminSession } from "../../support/tenant";
describe("Cadastro de autorizada e proprietário (RN03)", () => {
  let admin;
  let users;
  let countries;
  let validPayload;
  let invalidCases;
  const newPayload = (overrides = {}) => ({
    ...validPayload,
    authorizedName: uniqueName("Autorizada QA"),
    ownerEmail: uniqueEmail("proprietario"),
    ...overrides,
  });
  before(() => {
    superAdminSession().then((session) => (admin = session));
    cy.fixture("users/credenciais.json").then((data) => (users = data));
    cy.fixture("authorizeds/paises.json").then((data) => (countries = data));
    cy.fixture("authorizeds/cadastro.json").then((data) => {
      validPayload = data.valido;
      invalidCases = data.invalidos;
    });
  });
  context("Criação", () => {
    ["brasil", "argentina", "colombia"].forEach((country) => {
      it(`cria a autorizada do país ${country} com o idioma correspondente e permite o login do proprietário`, () => {
        const payload = newPayload({ country });
        const expected = () =>
          countries.find((item) => item.country === country);
        AuthorizedsApi.create(admin.token, payload).then((response) => {
          expect(response.status).to.eq(201);
          expect(response.duration, "SLA de cadastro").to.be.lessThan(SLA_MS);
          expect(response.body).to.have.all.keys([
            "id",
            "name",
            "country",
            "countryToLabel",
            "language",
            "owner",
            "employeesCount",
          ]);
          expect(response.body.owner).to.deep.eq({
            name: payload.ownerName,
            email: payload.ownerEmail,
          });
          expect(response.body.country).to.eq(country);
          expect(response.body.language).to.eq(expected().language);
          expect(response.body.employeesCount, "apenas o proprietário").to.eq(
            1,
          );
          AuthApi.login({
            email: String(payload.ownerEmail),
            password: users.defaultPassword,
          }).then((login) => {
            expect(login.status, "proprietário usa a senha padrão").to.eq(200);
            const claims = decodeJwt(login.body.token);
            expect(claims.role).to.eq("Proprietário");
            expect(claims.country).to.eq(country);
            expect(claims.language).to.eq(expected().language);
            expect(claims.authorizedId).to.eq(response.body.id);
            expect(claims.roleToLabel).to.eq(expected().ownerRoleLabel);
          });
        });
      });
    });
    it("lista a autorizada criada com proprietário e quantidade de funcionários", () => {
      const payload = newPayload({ country: "argentina" });
      AuthorizedsApi.create(admin.token, payload).then((created) => {
        AuthorizedsApi.list(admin.token).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.all.keys(["items", "total"]);
          expect(response.body.total).to.eq(response.body.items.length);
          const item = response.body.items.find(
            (entry) => entry.id === created.body.id,
          );
          expect(item, "autorizada listada").to.deep.include({
            name: payload.authorizedName,
            country: "argentina",
            countryToLabel: "Argentina",
            employeesCount: 1,
          });
        });
      });
    });
    it("normaliza o e-mail do proprietário para minúsculas", () => {
      const email = uniqueEmail("Proprietario.Maiusculo");
      AuthorizedsApi.create(
        admin.token,
        newPayload({ ownerEmail: email, country: "brasil" }),
      ).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.owner.email).to.eq(email.toLowerCase());
      });
    });
  });
  context("Validações do formulário (RN09)", () => {
    it("rejeita dados incompletos ou fora do formato informando o campo e o motivo", () => {
      invalidCases.forEach((invalid) => {
        AuthorizedsApi.create(admin.token, newPayload(invalid.override)).then(
          (response) => {
            expect(response.status, invalid.titulo).to.eq(400);
            expect(response.body.error).to.eq("VALIDATION");
            expect(response.body.fields[invalid.campo], invalid.titulo).to.eq(
              invalid.codigo,
            );
          },
        );
      });
    });
    it("informa todos os campos inválidos de uma vez quando o corpo está vazio", () => {
      AuthorizedsApi.create(admin.token, {}).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.fields).to.deep.eq({
          authorizedName: "REQUIRED",
          ownerName: "REQUIRED",
          ownerEmail: "REQUIRED",
          country: "REQUIRED",
        });
      });
    });
  });
  context("Unicidade de e-mail (RN11)", () => {
    it("não permite dois proprietários com o mesmo e-mail e não grava a autorizada duplicada", () => {
      const payload = newPayload({ country: "brasil" });
      AuthorizedsApi.create(admin.token, payload).then(() => {
        AuthorizedsApi.list(admin.token).then((before) => {
          AuthorizedsApi.create(
            admin.token,
            newPayload({
              ownerEmail: String(payload.ownerEmail).toUpperCase(),
            }),
          ).then((response) => {
            expect(response.status).to.eq(409);
            expect(response.body).to.deep.eq({
              error: "DUPLICATE_EMAIL",
              fields: { ownerEmail: "DUPLICATE_EMAIL" },
            });
            AuthorizedsApi.list(admin.token)
              .its("body.total")
              .should("eq", before.body.total);
          });
        });
      });
    });
    it("não permite reutilizar o e-mail do Super Admin", () => {
      AuthorizedsApi.create(
        admin.token,
        newPayload({ ownerEmail: users.superAdmin.email }),
      )
        .its("status")
        .should("eq", 409);
    });
    it("não permite reutilizar o e-mail de um funcionário de outra autorizada", () => {
      provisionTenant("brasil").then((tenant) => {
        AuthorizedsApi.create(
          admin.token,
          newPayload({ ownerEmail: tenant.attendant.email }),
        )
          .its("status")
          .should("eq", 409);
      });
    });
  });
  context("Acesso por perfil (RN01)", () => {
    let tenant;
    before(() => {
      provisionTenant("brasil").then((created) => (tenant = created));
    });
    it("bloqueia o proprietário na criação e na listagem de autorizadas", () => {
      AuthorizedsApi.create(tenant.owner.token, newPayload())
        .its("status")
        .should("eq", 403);
      AuthorizedsApi.list(tenant.owner.token).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body).to.deep.eq({ error: "FORBIDDEN" });
      });
    });
    it("bloqueia o atendente na criação e na listagem de autorizadas", () => {
      AuthorizedsApi.create(tenant.attendant.token, newPayload())
        .its("status")
        .should("eq", 403);
      AuthorizedsApi.list(tenant.attendant.token)
        .its("status")
        .should("eq", 403);
    });
    it("exige autenticação", () => {
      AuthorizedsApi.create(undefined, newPayload())
        .its("status")
        .should("eq", 401);
      AuthorizedsApi.list(undefined).its("status").should("eq", 401);
    });
    it("o proprietário recém-criado pode cadastrar funcionários da própria autorizada", () => {
      EmployeesApi.create(tenant.owner.token, {
        name: "Novo Atendente",
        email: uniqueEmail("novo"),
        role: "Atendente",
      })
        .its("status")
        .should("eq", 201);
    });
  });
});
