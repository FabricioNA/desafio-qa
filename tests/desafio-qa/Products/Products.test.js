import "./commands";
import { ProductsApi } from "../../support/api/products.api";
import { ProductsPage } from "../../support/pages/products.page";
import { provisionTenant } from "../../support/tenant";

const PAGE_SIZE = 10;

describe("Products - Search products", () => {
  const page = new ProductsPage();
  let catalog;
  let texts;
  let brasil;
  let argentina;

  const matches = (item, term) =>
    item.name.toLowerCase().includes(term.toLowerCase()) ||
    item.code.toLowerCase().includes(term.toLowerCase());
  const totalPages = () => Math.ceil(catalog.length / PAGE_SIZE);

  before(() => {
    cy.fixture("products/catalogo.json").then((fixture) => (catalog = fixture));
    cy.fixture("ui/textos.json").then((fixture) => (texts = fixture));
    provisionTenant("brasil").then((tenant) => (brasil = tenant));
    provisionTenant("argentina").then((tenant) => (argentina = tenant));
  });

  context("List and pagination", () => {
    beforeEach(() => {
      cy.accessProductsPage(brasil.owner);
    });

    it("Show the first page with 10 products with code, name, model and status", () => {
      page.rows().should("have.length", PAGE_SIZE);
      page.codes().first().should("have.text", catalog[0].code);
      cy.getByTestId("product-name")
        .first()
        .should("have.text", catalog[0].name);
      cy.getByTestId("product-model")
        .eq(5)
        .should("have.text", catalog[5].model);
      page
        .statuses()
        .eq(3)
        .should("have.text", catalog[3].status)
        .and("have.class", "inactive");
      page
        .statuses()
        .first()
        .should("have.text", catalog[0].status)
        .and("have.class", "active");
    });

    it("Load the image of every product in the page", () => {
      page
        .images()
        .should("have.length", PAGE_SIZE)
        .each(($img) => {
          cy.wrap($img).should(($el) => {
            expect($el[0].naturalWidth, "imagem carregada").to.be.greaterThan(
              0,
            );
          });
        });
    });

    it("Show the current page and the total of items", () => {
      cy.pageInfoShouldBe("pt", {
        page: 1,
        pages: totalPages(),
        total: catalog.length,
      });
    });

    it("Navigate between the pages and disable the buttons at the edges", () => {
      page.previousButton().should("be.disabled");
      page.nextButton().should("be.enabled");

      for (let current = 2; current <= totalPages(); current += 1) {
        cy.goToNextProductsPage();
        cy.pageInfoShouldBe("pt", {
          page: current,
          pages: totalPages(),
          total: catalog.length,
        });
        page
          .codes()
          .first()
          .should("have.text", catalog[(current - 1) * PAGE_SIZE].code);
      }

      page
        .rows()
        .should("have.length", catalog.length - PAGE_SIZE * (totalPages() - 1));
      page.nextButton().should("be.disabled");
      page.previousButton().should("be.enabled").click();
      page.pageInfo().should("contain.text", `Página ${totalPages() - 1} de`);
    });

    it("Return to the first page when applying a filter", () => {
      cy.goToNextProductsPage();

      cy.filterProducts({ status: "Inativo" });

      page.pageInfo().should("contain.text", "Página 1 de");
    });
  });

  context("Filters", () => {
    beforeEach(() => {
      cy.accessProductsPage(brasil.owner);
    });

    ["qz7k", "K5172"].forEach((term) => {
      it(`Filter by name or code ignoring case: ${term}`, () => {
        const expected = catalog
          .filter((item) => matches(item, term))
          .slice(0, PAGE_SIZE);

        cy.filterProducts({ name: term });

        cy.productCodesShouldBe(expected.map((item) => item.code));
      });
    });

    it("Filter by category", () => {
      const category = "Peças";
      const expected = catalog
        .filter((item) => item.category === category)
        .slice(0, PAGE_SIZE);

      cy.filterProducts({ category });

      page.categories().should(($cells) => {
        expect($cells).to.have.length(expected.length);
        $cells.each((_, cell) => {
          expect(cell.textContent).to.eq(category);
        });
      });
    });

    it("Filter by status", () => {
      const expected = catalog.filter((item) => item.status === "Inativo");

      cy.filterProducts({ status: "Inativo" });

      page.statuses().should(($badges) => {
        expect($badges).to.have.length(expected.length);
        $badges.each((_, badge) => {
          expect(badge.textContent).to.eq("Inativo");
        });
      });
    });

    it("Combine name, category and status filters", () => {
      const expected = catalog.filter(
        (item) =>
          matches(item, "qz7k") &&
          item.category.startsWith("SKU") &&
          item.status === "Inativo",
      );

      cy.filterProducts({
        name: "qz7k",
        category: "SKU (White Goods Mercado Nacional)",
        status: "Inativo",
      });

      cy.productCodesShouldBe(expected.map((item) => item.code));
    });

    it("Show the empty state when no product matches", () => {
      cy.filterProducts({ name: "produto-inexistente-xyz" });

      page.emptyState().should("have.text", texts.pt.produtos.vazio);
      page.rows().should("not.exist");
    });

    it("List everything again after removing the filters", () => {
      cy.filterProducts({ name: "produto-inexistente-xyz" });
      page.emptyState().should("be.visible");

      cy.clearProductNameFilter();

      page.rows().should("have.length", PAGE_SIZE);
    });

    it("Offer the categories and statuses as filter options", () => {
      page.categoryFilter().find("option").should("have.length", 4);
      page.statusFilter().find("option").should("have.length", 3);
    });
  });

  context("Language (RN07, RN08)", () => {
    it("Show the products screen in Spanish for Argentina", () => {
      cy.accessProductsPage(argentina.owner);

      page.title().should("have.text", texts.es.titulos.products);
      cy.pageInfoShouldBe("es", {
        page: 1,
        pages: totalPages(),
        total: catalog.length,
      });
      page.statuses().first().should("have.text", "Activo");
      page.statuses().eq(3).should("have.text", "Inactivo");
    });

    it("[BUG-006] Show the product category in the user language (label, not the Portuguese value)", () => {
      cy.accessProductsPage(argentina.owner);

      ProductsApi.list(argentina.owner.token).then((response) => {
        page.categories().each(($cell, index) => {
          expect($cell.text()).to.eq(
            response.body.items[index].categoryToLabel,
          );
        });
      });
    });

    it("Filter by category using the Portuguese value with the interface in Spanish", () => {
      const expected = catalog
        .filter((item) => item.category === "Peças")
        .slice(0, PAGE_SIZE);
      cy.accessProductsPage(argentina.owner);

      page
        .categoryFilter()
        .find("option")
        .contains("Repuestos")
        .should("exist");
      cy.filterProducts({ category: "Peças" });

      page.rows().should("have.length", expected.length);
    });
  });

  context("Integration states (mock)", () => {
    it("Render the server response with active/inactive status and formatted price", () => {
      cy.intercept("GET", "/api/products*", {
        fixture: "products/resposta-mock.json",
      }).as("products");
      cy.accessProductsPage(brasil.owner);
      cy.wait("@products");

      page.rows().should("have.length", 2);
      page.codes().first().should("have.text", "MOCK0001");
      page.statuses().first().should("have.class", "active");
      page.statuses().last().should("have.class", "inactive");
      page.rows().first().should("contain.text", "1.234,50");
      cy.pageInfoShouldBe("pt", { page: 1, pages: 2, total: 11 });
    });

    it("Show the empty state when the server returns an empty list", () => {
      cy.intercept("GET", "/api/products*", {
        body: { items: [], total: 0, page: 1, pageSize: 10 },
      }).as("products");
      cy.accessProductsPage(brasil.owner);
      cy.wait("@products");

      page.emptyState().should("have.text", texts.pt.produtos.vazio);
    });

    it("Keep the screen working when a product image is unavailable (mock 404)", () => {
      cy.intercept("GET", "/api/products?*", {
        fixture: "products/resposta-mock.json",
      }).as("products");
      cy.intercept("GET", "/api/products/*/image", {
        statusCode: 404,
        body: { error: "NOT_FOUND" },
      }).as("image");
      cy.accessProductsPage(brasil.owner);
      cy.wait("@products");
      cy.wait("@image");

      page.rows().should("have.length", 2);
      page.images().first().should("not.have.attr", "src");
      page.codes().first().should("have.text", "MOCK0001");
    });

    it("[BUG-008] Warn the user when the products query fails (mock 500)", () => {
      // O front não trata a rejeição da promessa: o erro vira exceção não tratada e a tela fica sem feedback.
      cy.on("uncaught:exception", () => false);
      cy.intercept("GET", "/api/products?*", {
        statusCode: 500,
        body: { error: "INTERNAL_ERROR" },
      }).as("products");
      page.open(brasil.owner);
      cy.wait("@products");

      cy.get('[role="alert"]').should("be.visible");
    });
  });
});
