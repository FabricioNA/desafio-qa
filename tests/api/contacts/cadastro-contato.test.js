import { SLA_MS } from "../../support/api/base";
import { ContactsApi } from "../../support/api/contacts.api";
import { uniqueEmail } from "../../support/data";
import { provisionTenant, superAdminSession } from "../../support/tenant";
describe("Cadastro de contatos (RN04, RN05, RN06, RN09, RN10, RN11)", () => {
  let data;
  const tenants = {};
  let other;
  let admin;
  const contact = (overrides = {}) => ({
    name: data.contato.name,
    email: uniqueEmail(data.contato.emailPrefix),
    phone: data.telefones.brasil.validos[0].entrada,
    ...overrides,
  });
  before(() => {
    cy.fixture("contacts/contatos.json").then((fixture) => (data = fixture));
    superAdminSession().then((session) => (admin = session));
    ["brasil", "argentina", "colombia"].forEach((country) => {
      provisionTenant(country).then((tenant) => (tenants[country] = tenant));
    });
    provisionTenant("brasil").then((tenant) => (other = tenant));
  });
  context("Criação", () => {
    it("grava o contato na autorizada do proprietário e devolve o contrato esperado", () => {
      const payload = contact();
      ContactsApi.create(tenants.brasil.owner.token, payload).then(
        (response) => {
          expect(response.status).to.eq(201);
          expect(response.duration, "SLA de cadastro").to.be.lessThan(SLA_MS);
          expect(response.body).to.have.all.keys([
            "id",
            "name",
            "email",
            "phone",
            "createdAt",
          ]);
          expect(response.body).to.deep.include({
            name: payload.name,
            email: payload.email,
          });
        },
      );
    });
    it("persiste o contato e o exibe primeiro na listagem (mais recentes primeiro)", () => {
      const payload = contact();
      ContactsApi.create(tenants.brasil.owner.token, payload).then(
        (created) => {
          ContactsApi.list(tenants.brasil.owner.token).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body).to.have.all.keys(["items", "total"]);
            expect(response.body.items[0].id).to.eq(created.body.id);
          });
        },
      );
    });
    it("normaliza o e-mail para minúsculas e remove espaços do nome", () => {
      const email = uniqueEmail("Contato.Misto");
      ContactsApi.create(
        tenants.brasil.owner.token,
        contact({ email, name: "  Nome Com Espaços  " }),
      ).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.email).to.eq(email.toLowerCase());
        expect(response.body.name).to.eq("Nome Com Espaços");
      });
    });
  });
  context("Validação de campos (RN09)", () => {
    it("rejeita dados incompletos ou fora do formato informando campo e motivo", () => {
      data.validacoes.forEach((invalid) => {
        ContactsApi.create(
          tenants.brasil.owner.token,
          contact(invalid.override),
        ).then((response) => {
          expect(response.status, invalid.titulo).to.eq(400);
          expect(response.body.error).to.eq("VALIDATION");
          expect(response.body.fields[invalid.campo], invalid.titulo).to.eq(
            invalid.codigo,
          );
        });
      });
    });
    it("não grava contato quando a validação falha", () => {
      ContactsApi.list(tenants.brasil.owner.token).then((before) => {
        ContactsApi.create(
          tenants.brasil.owner.token,
          contact({ email: "invalido" }),
        )
          .its("status")
          .should("eq", 400);
        ContactsApi.list(tenants.brasil.owner.token)
          .its("body.total")
          .should("eq", before.body.total);
      });
    });
  });
  context("Telefone por país (RN10)", () => {
    ["brasil", "argentina", "colombia"].forEach((country) => {
      // Argentina: o backend não valida nem normaliza o telefone.
      const bug = country === "argentina" ? "[BUG-003] " : "";
      it(`${bug}[${country}] normaliza telefones válidos para +<código><número>`, () => {
        data.telefones[country].validos.forEach((phone) => {
          ContactsApi.create(
            tenants[country].owner.token,
            contact({ phone: phone.entrada }),
          ).then((response) => {
            expect(response.status, phone.titulo).to.eq(201);
            expect(response.body.phone, phone.titulo).to.eq(phone.esperado);
          });
        });
      });
      it(`${bug}[${country}] rejeita telefones fora do formato do país`, () => {
        data.telefones[country].invalidos.forEach((phone) => {
          ContactsApi.create(
            tenants[country].owner.token,
            contact({ phone: phone.entrada }),
          ).then((response) => {
            expect(response.status, `${country}: ${phone.titulo}`).to.eq(400);
            expect(response.body.fields.phone, phone.titulo).to.eq(
              "INVALID_PHONE",
            );
          });
        });
      });
    });
    it("usa o formato do país do usuário, não o de outro país", () => {
      // Celular brasileiro (11 dígitos) é inválido para a Colômbia (10 dígitos).
      ContactsApi.create(
        tenants.colombia.owner.token,
        contact({ phone: "11987654321" }),
      )
        .its("status")
        .should("eq", 400);
    });
  });
  context("Unicidade de e-mail (RN11)", () => {
    it("não permite o mesmo e-mail duas vezes na mesma autorizada (sem diferenciar maiúsculas)", () => {
      const payload = contact();
      ContactsApi.create(tenants.brasil.owner.token, payload).then(() => {
        ContactsApi.create(tenants.brasil.owner.token, {
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
    it("permite o mesmo e-mail de contato em autorizadas diferentes", () => {
      const payload = contact();
      ContactsApi.create(tenants.brasil.owner.token, payload)
        .its("status")
        .should("eq", 201);
      ContactsApi.create(other.owner.token, payload)
        .its("status")
        .should("eq", 201);
    });
  });
  context("Isolamento entre autorizadas (RN04)", () => {
    it("não exibe a outra autorizada os contatos criados por uma autorizada", () => {
      const payload = contact();
      ContactsApi.create(tenants.brasil.owner.token, payload).then(() => {
        ContactsApi.list(other.owner.token).then((response) => {
          const emails = response.body.items.map((item) => item.email);
          expect(emails).not.to.include(payload.email);
        });
      });
    });
  });
  context("Acesso por perfil (RN01, RN06)", () => {
    it("permite ao atendente consultar os contatos da sua autorizada", () => {
      const payload = contact();
      ContactsApi.create(tenants.brasil.owner.token, payload).then(() => {
        ContactsApi.list(tenants.brasil.attendant.token).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.items.map((item) => item.email)).to.include(
            payload.email,
          );
        });
      });
    });
    it("impede o atendente de criar contatos", () => {
      ContactsApi.create(tenants.brasil.attendant.token, contact()).then(
        (response) => {
          expect(response.status).to.eq(403);
          expect(response.body).to.deep.eq({ error: "FORBIDDEN" });
        },
      );
    });
    it("bloqueia o Super Admin, que não pertence a nenhuma autorizada", () => {
      ContactsApi.list(admin.token).its("status").should("eq", 403);
      ContactsApi.create(admin.token, contact())
        .its("status")
        .should("eq", 403);
    });
    it("exige autenticação", () => {
      ContactsApi.list(undefined).its("status").should("eq", 401);
      ContactsApi.create(undefined, contact()).its("status").should("eq", 401);
    });
  });
});
