import { AuthApi } from "../../support/api/auth.api";
import { SLA_MS } from "../../support/api/base";
import { EmployeesApi } from "../../support/api/employees.api";
import { decodeJwt, uniqueEmail } from "../../support/data";
import { provisionTenant, superAdminSession } from "../../support/tenant";
describe("Cadastro e consulta de funcionários (RN01, RN04, RN05, RN06, RN09, RN11, RN13)", () => {
  let data;
  let users;
  let countries;
  let admin;
  let brasil;
  let argentina;
  let colombia;
  const employee = (overrides = {}) => ({
    name: data.funcionario.name,
    email: uniqueEmail(data.funcionario.emailPrefix),
    role: "Atendente",
    ...overrides,
  });
  before(() => {
    cy.fixture("employees/funcionarios.json").then(
      (fixture) => (data = fixture),
    );
    cy.fixture("users/credenciais.json").then((fixture) => (users = fixture));
    cy.fixture("authorizeds/paises.json").then(
      (fixture) => (countries = fixture),
    );
    superAdminSession().then((session) => (admin = session));
    provisionTenant("brasil").then((tenant) => (brasil = tenant));
    provisionTenant("argentina").then((tenant) => (argentina = tenant));
    provisionTenant("colombia").then((tenant) => (colombia = tenant));
  });
  context("Criação pelo proprietário", () => {
    it("cria o funcionário na própria autorizada herdando país e idioma, dentro do SLA", () => {
      const payload = employee({ role: "Proprietário" });
      EmployeesApi.create(brasil.owner.token, payload).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.duration, "SLA de cadastro").to.be.lessThan(SLA_MS);
        expect(response.body).to.have.all.keys([
          "id",
          "name",
          "email",
          "role",
          "roleToLabel",
          "language",
          "country",
        ]);
        expect(response.body).to.deep.include({
          role: "Proprietário",
          country: "brasil",
          language: "pt",
          roleToLabel: "Proprietário",
        });
      });
    });
    it("exibe o cargo no idioma do usuário mantendo o valor em português (RN07, RN08)", () => {
      const expected = countries.find((item) => item.country === "argentina");
      EmployeesApi.create(
        argentina.owner.token,
        employee({ role: "Atendente" }),
      ).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.role).to.eq("Atendente");
        expect(response.body.roleToLabel).to.eq(expected.attendantRoleLabel);
        expect(response.body).to.deep.include({
          country: "argentina",
          language: "es",
        });
      });
    });
    it("permite que o novo funcionário entre com a senha padrão e receba as permissões do cargo", () => {
      const payload = employee();
      EmployeesApi.create(brasil.owner.token, payload).then(() => {
        AuthApi.login({
          email: String(payload.email),
          password: users.defaultPassword,
        }).then((login) => {
          expect(login.status).to.eq(200);
          const claims = decodeJwt(login.body.token);
          expect(claims.role).to.eq("Atendente");
          expect(claims.authorizedId).to.eq(brasil.authorizedId);
          expect(claims.permissions).to.deep.eq({
            contacts: "read",
            products: "read",
            employees: "read",
          });
        });
      });
    });
    it("normaliza o e-mail para minúsculas", () => {
      const email = uniqueEmail("Funcionario.Maiusculo");
      EmployeesApi.create(brasil.owner.token, employee({ email }))
        .its("body.email")
        .should("eq", email.toLowerCase());
    });
  });
  context("Validação de campos (RN09)", () => {
    it("rejeita dados incompletos ou fora do formato informando campo e motivo", () => {
      data.validacoes.forEach((invalid) => {
        EmployeesApi.create(
          brasil.owner.token,
          employee(invalid.override),
        ).then((response) => {
          expect(response.status, invalid.titulo).to.eq(400);
          expect(response.body.error).to.eq("VALIDATION");
          expect(response.body.fields[invalid.campo], invalid.titulo).to.eq(
            invalid.codigo,
          );
        });
      });
    });
  });
  context("Unicidade de e-mail (RN11)", () => {
    it("não permite e-mail repetido, nem em maiúsculas, em todo o sistema", () => {
      const payload = employee();
      EmployeesApi.create(brasil.owner.token, payload).then(() => {
        EmployeesApi.create(brasil.owner.token, {
          ...payload,
          email: String(payload.email).toUpperCase(),
        }).then((response) => {
          expect(response.status).to.eq(409);
          expect(response.body).to.deep.eq({
            error: "DUPLICATE_EMAIL",
            fields: { email: "DUPLICATE_EMAIL" },
          });
        });
      });
    });
    it("não permite usar em uma autorizada o e-mail de funcionário de outra autorizada", () => {
      const payload = employee();
      EmployeesApi.create(brasil.owner.token, payload).then(() => {
        EmployeesApi.create(argentina.owner.token, payload)
          .its("status")
          .should("eq", 409);
      });
    });
    it("não permite usar o e-mail do Super Admin", () => {
      EmployeesApi.create(
        brasil.owner.token,
        employee({ email: users.superAdmin.email }),
      )
        .its("status")
        .should("eq", 409);
    });
  });
  context("Consulta e isolamento (RN04)", () => {
    it("lista somente os funcionários da própria autorizada", () => {
      const payload = employee();
      EmployeesApi.create(argentina.owner.token, payload).then(() => {
        EmployeesApi.list(brasil.owner.token).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.all.keys(["items", "total"]);
          expect(response.body.total).to.eq(response.body.items.length);
          const emails = response.body.items.map((item) => item.email);
          expect(emails)
            .to.include(brasil.owner.email)
            .and.to.include(brasil.attendant.email);
          expect(emails)
            .not.to.include(payload.email)
            .and.not.to.include(argentina.owner.email);
        });
      });
    });
    it("filtra a listagem por cargo", () => {
      data.cargosAtribuiveis.forEach((role) => {
        EmployeesApi.list(brasil.owner.token, role).then((response) => {
          expect(response.status).to.eq(200);
          expect(
            response.body.items.length,
            `há funcionários com cargo ${role}`,
          ).to.be.greaterThan(0);
          response.body.items.forEach((item) => expect(item.role).to.eq(role));
        });
      });
    });
    it("rejeita filtro por cargo inexistente", () => {
      EmployeesApi.list(brasil.owner.token, "Gerente").then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.fields).to.deep.eq({ role: "INVALID_ROLE" });
      });
    });
  });
  context("Perfil somente leitura (RN01, RN06)", () => {
    it("permite ao atendente consultar os funcionários da sua autorizada", () => {
      EmployeesApi.list(brasil.attendant.token).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.items.map((item) => item.email)).to.include(
          brasil.owner.email,
        );
      });
    });
    it("[BUG-001] impede o atendente de cadastrar funcionários", () => {
      const payload = employee({ role: "Proprietário" });
      EmployeesApi.create(brasil.attendant.token, payload).then((response) => {
        expect(response.status, "atendente só tem leitura").to.eq(403);
        expect(response.body).to.deep.eq({ error: "FORBIDDEN" });
      });
    });
    it("[BUG-001] não grava o funcionário criado por um atendente", () => {
      const payload = employee();
      EmployeesApi.create(brasil.attendant.token, payload).then(() => {
        EmployeesApi.list(brasil.owner.token).then((response) => {
          const emails = response.body.items.map((item) => item.email);
          expect(emails).not.to.include(payload.email);
        });
      });
    });
  });
  context("Acesso por perfil e país (RN01, RN13)", () => {
    it("bloqueia o Super Admin, que não pertence a nenhuma autorizada", () => {
      EmployeesApi.list(admin.token).its("status").should("eq", 403);
      EmployeesApi.create(admin.token, employee())
        .its("status")
        .should("eq", 403);
    });
    it("não oferece o módulo de funcionários para a Colômbia: sem permissão no token e 403 na API", () => {
      const claims = decodeJwt(colombia.owner.token);
      expect(claims.permissions).to.deep.eq({
        contacts: "read/write",
        products: "read",
      });
      EmployeesApi.list(colombia.owner.token).its("status").should("eq", 403);
      EmployeesApi.create(colombia.owner.token, employee())
        .its("status")
        .should("eq", 403);
    });
    it("mantém o módulo disponível para os demais países", () => {
      ["brasil", "argentina"].forEach((country) => {
        const tenant = country === "brasil" ? brasil : argentina;
        EmployeesApi.list(tenant.owner.token).its("status").should("eq", 200);
      });
    });
    it("exige autenticação", () => {
      EmployeesApi.list(undefined).its("status").should("eq", 401);
      EmployeesApi.create(undefined, employee())
        .its("status")
        .should("eq", 401);
    });
  });
});
