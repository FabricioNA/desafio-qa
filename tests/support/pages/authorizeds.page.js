import { BasePage } from "./base.page";
export class AuthorizedsPage extends BasePage {
  constructor() {
    super(...arguments);
    this.route = "#/authorizeds";
    this.titleTestId = "authorizeds-title";
  }
  form() {
    return cy.getByTestId("authorized-form");
  }
  fill(data) {
    if (data.authorizedName)
      cy.getByTestId("authorized-name").type(data.authorizedName);
    if (data.ownerName) cy.getByTestId("owner-name").type(data.ownerName);
    if (data.ownerEmail) cy.getByTestId("owner-email").type(data.ownerEmail);
    if (data.country) cy.getByTestId("authorized-country").select(data.country);
    return this;
  }
  save() {
    cy.getByTestId("authorized-save").click();
    return this;
  }
  successMessage() {
    return cy.getByTestId("authorized-success");
  }
  rows() {
    return cy.getByTestId("authorized-row");
  }
  rowOf(ownerEmail) {
    return cy.contains('[data-testid="authorized-row"]', ownerEmail);
  }
  countryOptions() {
    return cy.getByTestId("authorized-country").find("option");
  }
}
