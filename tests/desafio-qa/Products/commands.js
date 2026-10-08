import { ProductsPage } from "../../support/pages/products.page";
import { fill } from "../../support/ui-texts";

const productsPage = new ProductsPage();

Cypress.Commands.add("accessProductsPage", (session) => {
  productsPage.open(session);
  productsPage.title().should("be.visible");
});

Cypress.Commands.add("filterProducts", (criteria) => {
  productsPage.filter(criteria);
});

Cypress.Commands.add("clearProductNameFilter", () => {
  productsPage.nameFilter().clear();
  productsPage.search();
});

Cypress.Commands.add("goToNextProductsPage", () => {
  productsPage.nextButton().click();
});

Cypress.Commands.add("productCodesShouldBe", (codes) => {
  productsPage.codes().should(($cells) => {
    expect([...$cells].map((cell) => cell.textContent)).to.deep.eq(codes);
  });
});

Cypress.Commands.add("pageInfoShouldBe", (language, info) => {
  cy.fixture("ui/textos.json").then((texts) => {
    productsPage
      .pageInfo()
      .should("have.text", fill(texts[language].produtos.pagina, info));
  });
});

export const runProducts = (ownerSession) => {
  cy.accessProductsPage(ownerSession);
  cy.filterProducts({ name: "qz7k", status: "Inativo" });
  productsPage.statuses().should(($badges) => {
    expect($badges.length).to.be.greaterThan(0);
    $badges.each((_, badge) => {
      expect(badge.textContent).to.eq("Inativo");
    });
  });
};
