import { SLA_MS } from "../../support/api/base";
import { ProductsApi } from "../../support/api/products.api";
import { provisionTenant, superAdminSession } from "../../support/tenant";
const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";
describe("Consulta de produtos (RN12)", () => {
  let catalog;
  let admin;
  let brasil;
  let argentina;
  const matches = (item, term) =>
    item.name.toLowerCase().includes(term.toLowerCase()) ||
    item.code.toLowerCase().includes(term.toLowerCase());
  const codes = (items) => items.map((item) => item.code);
  before(() => {
    cy.fixture("products/catalogo.json").then((fixture) => (catalog = fixture));
    superAdminSession().then((session) => (admin = session));
    provisionTenant("brasil").then((tenant) => (brasil = tenant));
    provisionTenant("argentina").then((tenant) => (argentina = tenant));
  });
  context("Contrato e paginação", () => {
    it("devolve a primeira página com 10 itens e o contrato completo, dentro do SLA", () => {
      ProductsApi.list(brasil.owner.token).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.duration, "SLA de consulta").to.be.lessThan(SLA_MS);
        expect(response.body).to.have.all.keys([
          "items",
          "total",
          "page",
          "pageSize",
        ]);
        expect(response.body).to.deep.include({
          total: catalog.length,
          page: 1,
          pageSize: 10,
        });
        expect(response.body.items).to.have.length(10);
        response.body.items.forEach((item) => {
          expect(item).to.have.all.keys([
            "id",
            "code",
            "name",
            "model",
            "category",
            "categoryToLabel",
            "status",
            "statusToLabel",
            "price",
            "imageUrl",
          ]);
          expect(item.imageUrl).to.eq(`/api/products/${item.id}/image`);
        });
      });
    });
    it("percorre todo o catálogo sem repetir nem perder itens entre as páginas", () => {
      const pages = Math.ceil(catalog.length / 10);
      const collected = [];
      for (let page = 1; page <= pages; page += 1) {
        ProductsApi.list(brasil.owner.token, { page }).then((response) => {
          expect(response.body.page).to.eq(page);
          expect(response.body.items).to.have.length(
            page < pages ? 10 : catalog.length - 10 * (pages - 1),
          );
          collected.push(...codes(response.body.items));
        });
      }
      cy.then(() => {
        expect(collected).to.deep.eq(catalog.map((item) => item.code));
      });
    });
    it("respeita o tamanho de página solicitado e limita o máximo a 50", () => {
      ProductsApi.list(brasil.owner.token, { pageSize: 5 })
        .its("body.items")
        .should("have.length", 5);
      ProductsApi.list(brasil.owner.token, { pageSize: 500 }).then(
        (response) => {
          expect(response.body.pageSize).to.eq(50);
          expect(response.body.items).to.have.length(
            Math.min(50, catalog.length),
          );
        },
      );
    });
    it("devolve lista vazia, mantendo o total, para uma página além do fim", () => {
      ProductsApi.list(brasil.owner.token, { page: 999 }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.items).to.deep.eq([]);
        expect(response.body.total).to.eq(catalog.length);
      });
    });
    it("trata página inválida como a primeira página", () => {
      ProductsApi.list(brasil.owner.token, { page: -3 })
        .its("body.page")
        .should("eq", 1);
    });
  });
  context("Filtros", () => {
    ["qz7k", "QZ7K", "k5172", "refrigerador", "R7305", "etiqueta ence"].forEach(
      (term) => {
        it(`filtra por nome ou código sem diferenciar maiúsculas: "${term}"`, () => {
          const expected = catalog
            .filter((item) => matches(item, term))
            .map((item) => item.code);
          ProductsApi.list(brasil.owner.token, {
            name: term,
            pageSize: 50,
          }).then((response) => {
            expect(response.body.total).to.eq(expected.length);
            expect(codes(response.body.items)).to.deep.eq(expected);
          });
        });
      },
    );
    it("trata caracteres especiais do termo como texto, sem erro nem coringa", () => {
      [".", "(", "*", "[", "\\"].forEach((term) => {
        ProductsApi.list(brasil.owner.token, { name: term }).then(
          (response) => {
            expect(response.status, `termo "${term}"`).to.eq(200);
            expect(response.body.total, `termo "${term}"`).to.eq(
              catalog.filter((item) => matches(item, term)).length,
            );
          },
        );
      });
    });
    it("filtra por cada categoria", () => {
      [...new Set(catalog.map((item) => item.category))].forEach((category) => {
        const expected = catalog.filter((item) => item.category === category);
        ProductsApi.list(brasil.owner.token, { category, pageSize: 50 }).then(
          (response) => {
            expect(response.body.total, category).to.eq(expected.length);
            response.body.items.forEach((item) =>
              expect(item.category).to.eq(category),
            );
          },
        );
      });
    });
    it("filtra por cada situação", () => {
      ["Ativo", "Inativo"].forEach((status) => {
        const expected = catalog.filter((item) => item.status === status);
        ProductsApi.list(brasil.owner.token, { status, pageSize: 50 }).then(
          (response) => {
            expect(response.body.total, status).to.eq(expected.length);
            response.body.items.forEach((item) =>
              expect(item.status).to.eq(status),
            );
          },
        );
      });
    });
    it("combina os três filtros", () => {
      const filters = {
        name: "qz7k",
        category: "SKU (White Goods Mercado Nacional)",
        status: "Inativo",
      };
      const expected = catalog.filter(
        (item) =>
          matches(item, filters.name) &&
          item.category === filters.category &&
          item.status === filters.status,
      );
      expect(
        expected.length,
        "massa de dados do filtro combinado",
      ).to.be.greaterThan(0);
      ProductsApi.list(brasil.owner.token, { ...filters }).then((response) => {
        expect(codes(response.body.items)).to.deep.eq(
          expected.map((item) => item.code),
        );
      });
    });
    it("devolve total zero quando nada corresponde ao filtro", () => {
      ProductsApi.list(brasil.owner.token, {
        name: "produto-inexistente-xyz",
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.total).to.eq(0);
        expect(response.body.items).to.deep.eq([]);
      });
    });
    it("aplica a paginação sobre o resultado filtrado", () => {
      const expected = catalog.filter((item) =>
        item.name.toLowerCase().includes("etiqueta"),
      );
      ProductsApi.list(brasil.owner.token, {
        name: "etiqueta",
        pageSize: 3,
        page: 2,
      }).then((response) => {
        expect(response.body.total).to.eq(expected.length);
        expect(codes(response.body.items)).to.deep.eq(
          expected.slice(3, 6).map((item) => item.code),
        );
      });
    });
    it("rejeita categoria e situação fora das listas de valores", () => {
      ProductsApi.list(brasil.owner.token, {
        category: "Casa",
        status: "Pendente",
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body).to.deep.eq({
          error: "VALIDATION",
          fields: { category: "INVALID", status: "INVALID" },
        });
      });
    });
    it("rejeita os valores de lista enviados em outro idioma (os valores trafegam em português)", () => {
      ProductsApi.list(argentina.owner.token, { category: "Repuestos" })
        .its("status")
        .should("eq", 400);
      ProductsApi.list(argentina.owner.token, { status: "Activo" })
        .its("status")
        .should("eq", 400);
    });
  });
  context("Idioma e valores de listas (RN07, RN08)", () => {
    it("devolve os rótulos em português para usuário do Brasil", () => {
      ProductsApi.list(brasil.owner.token, { pageSize: 50 }).then(
        (response) => {
          response.body.items.forEach((item) => {
            expect(item.categoryToLabel).to.eq(item.category);
            expect(item.statusToLabel).to.eq(item.status);
          });
        },
      );
    });
    it("devolve os rótulos em espanhol para usuário da Argentina, mantendo os valores em português", () => {
      const categoryLabels = {
        Peças: "Repuestos",
        "SKU (White Goods Mercado Nacional)":
          "SKU (Línea Blanca Mercado Nacional)",
        "Modelo Usual (White Goods Mercado Nacional)":
          "Modelo Habitual (Línea Blanca Mercado Nacional)",
      };
      const statusLabels = { Ativo: "Activo", Inativo: "Inactivo" };
      ProductsApi.list(argentina.owner.token, { pageSize: 50 }).then(
        (response) => {
          response.body.items.forEach((item) => {
            expect(item.categoryToLabel).to.eq(categoryLabels[item.category]);
            expect(item.statusToLabel).to.eq(statusLabels[item.status]);
          });
        },
      );
    });
    it("devolve os dados do catálogo sem alterações", () => {
      ProductsApi.list(brasil.owner.token, { pageSize: 50 }).then(
        (response) => {
          const returned = response.body.items.map(
            ({ code, name, category, model, status, price }) => ({
              code,
              name,
              category,
              model,
              status,
              price,
            }),
          );
          expect(returned).to.deep.eq(catalog);
        },
      );
    });
  });
  context("Imagem do produto", () => {
    it("serve uma imagem PNG válida para cada produto da página", () => {
      ProductsApi.list(brasil.owner.token).then((list) => {
        list.body.items.forEach((item) => {
          ProductsApi.image(brasil.owner.token, item.id).then((image) => {
            expect(image.status, item.code).to.eq(200);
            expect(image.headers["content-type"], item.code).to.eq("image/png");
            expect(
              String(image.body).slice(0, 8),
              `assinatura PNG de ${item.code}`,
            ).to.eq(PNG_SIGNATURE);
          });
        });
      });
    });
    it("responde 404 para produto inexistente", () => {
      ProductsApi.image(brasil.owner.token, "id-inexistente")
        .its("status")
        .should("eq", 404);
    });
    it("exige autenticação para baixar a imagem", () => {
      ProductsApi.list(brasil.owner.token).then((list) => {
        ProductsApi.image(undefined, list.body.items[0].id)
          .its("status")
          .should("eq", 401);
      });
    });
  });
  context("Acesso por perfil (RN01)", () => {
    it("permite a consulta para todos os perfis", () => {
      [admin, brasil.owner, brasil.attendant].forEach((session) => {
        ProductsApi.list(session.token).its("status").should("eq", 200);
      });
    });
    it("exige autenticação", () => {
      ProductsApi.list(undefined).its("status").should("eq", 401);
    });
  });
});
