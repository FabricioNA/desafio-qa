import { AuthApi } from "../../support/api/auth.api";
import { SLA_MS } from "../../support/api/base";
import { ContactsApi } from "../../support/api/contacts.api";
import { ProductsApi } from "../../support/api/products.api";
import { decodeJwt } from "../../support/data";
import { provisionTenant } from "../../support/tenant";
describe("Autenticação e sessão (RN14)", () => {
  let users;
  let tenant;
  before(() => {
    cy.fixture("users/credenciais.json").then((data) => (users = data));
    provisionTenant("brasil", false).then((created) => (tenant = created));
  });
  context("Login", () => {
    it("autentica o Super Admin e devolve token com perfil e permissões do administrador da plataforma", () => {
      AuthApi.login(users.superAdmin).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.all.keys(["token"]);
        expect(response.duration, "SLA de login").to.be.lessThan(SLA_MS);
        const claims = decodeJwt(response.body.token);
        expect(claims).to.include.keys([
          "sub",
          "email",
          "name",
          "role",
          "roleToLabel",
          "language",
          "country",
          "authorizedId",
          "authorizedName",
          "permissions",
          "iat",
          "exp",
        ]);
        expect(claims.role).to.eq("Super Admin");
        expect(
          claims.authorizedId,
          "Super Admin não pertence a nenhuma autorizada",
        ).to.be.null;
        expect(claims.permissions).to.deep.eq({
          authorizeds: "read/write",
          products: "read",
        });
      });
    });
    it("autentica o proprietário com os dados da sua autorizada no token", () => {
      AuthApi.login(tenant.owner).then((response) => {
        expect(response.status).to.eq(200);
        const claims = decodeJwt(response.body.token);
        expect(claims.role).to.eq("Proprietário");
        expect(claims.authorizedId).to.eq(tenant.authorizedId);
        expect(claims.authorizedName).to.eq(tenant.authorizedName);
        expect(claims.country).to.eq("brasil");
        expect(claims.language).to.eq("pt");
        expect(claims.permissions).to.deep.eq({
          contacts: "read/write",
          products: "read",
          employees: "read/write",
        });
      });
    });
    it("define um prazo de validade para a sessão", () => {
      AuthApi.login(users.superAdmin).then((response) => {
        const { iat, exp } = decodeJwt(response.body.token);
        expect(exp, "token precisa expirar").to.be.greaterThan(iat);
      });
    });
    it("aceita o e-mail sem diferenciar maiúsculas de minúsculas", () => {
      AuthApi.login({
        email: users.superAdmin.email.toUpperCase(),
        password: users.superAdmin.password,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
    it("rejeita senha incorreta sem revelar se o e-mail existe", () => {
      AuthApi.login({
        email: users.superAdmin.email,
        password: "senha-errada",
      }).then((wrongPassword) => {
        AuthApi.login({
          email: "nao.existe@example.com",
          password: users.superAdmin.password,
        }).then((unknownEmail) => {
          expect(wrongPassword.status).to.eq(401);
          expect(unknownEmail.status).to.eq(401);
          expect(wrongPassword.body).to.deep.eq({
            error: "INVALID_CREDENTIALS",
          });
          expect(unknownEmail.body).to.deep.eq(wrongPassword.body);
        });
      });
    });
    it("informa os campos obrigatórios ausentes", () => {
      AuthApi.login({}).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body).to.deep.eq({
          error: "VALIDATION",
          fields: { email: "REQUIRED", password: "REQUIRED" },
        });
      });
    });
    it("[BUG-002] não aceita credenciais enviadas na URL (querystring)", () => {
      // Senha na URL vaza em logs de acesso, histórico do navegador e cabeçalho Referer.
      AuthApi.loginByQuery(users.superAdmin).then((response) => {
        expect(
          response.status,
          "GET /api/login não deveria autenticar",
        ).to.be.oneOf([404, 405]);
      });
    });
  });
  context("Validação do token em toda requisição", () => {
    const protectedRoutes = [
      ["produtos", (token) => ProductsApi.list(token)],
      ["contatos", (token) => ContactsApi.list(token)],
    ];
    protectedRoutes.forEach(([name, request]) => {
      it(`bloqueia o acesso a ${name} sem token`, () => {
        request(undefined).its("status").should("eq", 401);
      });
      it(`bloqueia o acesso a ${name} com token malformado`, () => {
        request("token.invalido.qualquer").then((response) => {
          expect(response.status).to.eq(401);
          expect(response.body).to.deep.eq({ error: "UNAUTHORIZED" });
        });
      });
    });
    it("bloqueia token assinado com outra chave, mesmo com permissões elevadas", () => {
      cy.task("signToken", {
        claims: {
          ...decodeJwt(tenant.owner.token),
          permissions: {
            employees: "read/write",
            contacts: "read/write",
            authorizeds: "read/write",
          },
        },
        secret: "chave-forjada",
        expiresIn: "1h",
      }).then((forged) => {
        ContactsApi.list(forged).its("status").should("eq", 401);
      });
    });
    it("aceita o token enquanto válido e o recusa depois que o prazo vence", () => {
      cy.task("signToken", {
        claims: decodeJwt(tenant.owner.token),
        expiresIn: 2,
      }).then((shortLived) => {
        ContactsApi.list(shortLived).its("status").should("eq", 200);

        // Passagem de tempo real: o token de 2 s precisa vencer no relógio do servidor
        cy.wait(3100);

        ContactsApi.list(shortLived).then((response) => {
          expect(response.status).to.eq(401);
          expect(response.body).to.deep.eq({ error: "UNAUTHORIZED" });
        });
      });
    });

    it("bloqueia token expirado", () => {
      cy.task("signToken", {
        claims: decodeJwt(tenant.owner.token),
        expiresIn: -60,
      }).then((expired) => {
        ContactsApi.list(expired).then((response) => {
          expect(response.status).to.eq(401);
          expect(response.body).to.deep.eq({ error: "UNAUTHORIZED" });
        });
      });
    });
    it("rejeita esquema de autorização diferente de Bearer", () => {
      cy.request({
        url: "/api/contacts",
        headers: { Authorization: `Basic ${tenant.owner.token}` },
        failOnStatusCode: false,
      })
        .its("status")
        .should("eq", 401);
    });
  });
  context("Disponibilidade", () => {
    it("responde ao health check sem autenticação dentro do SLA", () => {
      AuthApi.health().then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.deep.eq({ status: "ok" });
        expect(response.duration).to.be.lessThan(SLA_MS);
      });
    });
    it("responde 404 padronizado para rotas inexistentes", () => {
      cy.request({
        url: "/api/rota-inexistente",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
        expect(response.body).to.deep.eq({ error: "NOT_FOUND" });
      });
    });
  });
});
