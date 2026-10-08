import { BasePage } from "./base.page";
export class ProductsPage extends BasePage {
  constructor() {
    super(...arguments);
    this.route = "#/products";
    this.titleTestId = "products-title";
  }
  nameFilter() {
    return cy.getByTestId("product-filter-name");
  }
  categoryFilter() {
    return cy.getByTestId("product-filter-category");
  }
  statusFilter() {
    return cy.getByTestId("product-filter-status");
  }
  /** Aciona a busca e aguarda a resposta, evitando asserções sobre a lista anterior. */
  search() {
    cy.intercept("GET", "/api/products*").as("productsQuery");
    cy.getByTestId("product-search").click();
    cy.wait("@productsQuery");
    return this;
  }
  filter(criteria) {
    if (criteria.name) this.nameFilter().clear().type(criteria.name);
    if (criteria.category) this.categoryFilter().select(criteria.category);
    if (criteria.status) this.statusFilter().select(criteria.status);
    return this.search();
  }
  rows() {
    return cy.getByTestId("product-row");
  }
  images() {
    return cy.getByTestId("product-image");
  }
  codes() {
    return cy.getByTestId("product-code");
  }
  categories() {
    return cy.getByTestId("product-category");
  }
  statuses() {
    return cy.getByTestId("product-status");
  }
  emptyState() {
    return cy.getByTestId("products-empty");
  }
  pageInfo() {
    return cy.getByTestId("page-info");
  }
  previousButton() {
    return cy.getByTestId("page-prev");
  }
  nextButton() {
    return cy.getByTestId("page-next");
  }
}
