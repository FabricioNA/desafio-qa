import { PicklistsApi } from "../../support/api/products.api";
import { provisionTenant, superAdminSession } from "../../support/tenant";
describe("Listas de valores — picklists (RN07, RN08)", () => {
  let lists;
  let admin;
  let brasil;
  let argentina;
  before(() => {
    cy.fixture("picklists/listas.json").then((fixture) => (lists = fixture));
    superAdminSession().then((session) => (admin = session));
    provisionTenant("brasil").then((tenant) => (brasil = tenant));
    provisionTenant("argentina").then((tenant) => (argentina = tenant));
  });
  it("devolve as listas em português para o Brasil", () => {
    PicklistsApi.list(brasil.owner.token).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.all.keys([
        "category",
        "status",
        "role",
        "assignableRole",
        "country",
      ]);
      expect(response.body).to.deep.eq(lists.pt);
    });
  });
  it("devolve as listas em espanhol para a Argentina, mantendo os valores em português", () => {
    PicklistsApi.list(argentina.owner.token).then((response) => {
      expect(response.body).to.deep.eq(lists.es);
    });
  });
  it("mantém os mesmos valores (value) em qualquer idioma", () => {
    PicklistsApi.list(brasil.owner.token).then((pt) => {
      PicklistsApi.list(argentina.owner.token).then((es) => {
        Object.keys(pt.body).forEach((name) => {
          expect(es.body[name].map((o) => o.value)).to.deep.eq(
            pt.body[name].map((o) => o.value),
          );
        });
      });
    });
  });
  it("não oferece Super Admin entre os cargos atribuíveis no cadastro de funcionário", () => {
    PicklistsApi.list(brasil.owner.token).then((response) => {
      const assignable = response.body.assignableRole.map((o) => o.value);
      expect(assignable).to.deep.eq(["Proprietário", "Atendente"]);
    });
  });
  it("está disponível para qualquer usuário autenticado", () => {
    [admin, brasil.owner, brasil.attendant].forEach((session) => {
      PicklistsApi.list(session.token).its("status").should("eq", 200);
    });
  });
  it("exige autenticação", () => {
    PicklistsApi.list(undefined).its("status").should("eq", 401);
  });
});
