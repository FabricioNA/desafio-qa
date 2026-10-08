import { AuthorizedsApi } from "../../support/api/authorizeds.api";
import { uniqueEmail, uniqueName } from "../../support/data";
import { AuthorizedsPage } from "../../support/pages/authorizeds.page";

const authorizedsPage = new AuthorizedsPage();

Cypress.Commands.add("accessAuthorizedsPage", (adminSession) => {
  authorizedsPage.open(adminSession);
  authorizedsPage.form().should("be.visible");
});

Cypress.Commands.add("buildAuthorizedForm", (overrides = {}) => {
  cy.fixture("authorizeds/cadastro.json").then(({ valido }) => ({
    ...valido,
    authorizedName: uniqueName("Autorizada UI"),
    ownerEmail: uniqueEmail("proprietario.ui"),
    ...overrides,
  }));
});

Cypress.Commands.add("fillAuthorizedFormAndSave", (form) => {
  authorizedsPage.fill(form).save();
});

Cypress.Commands.add("createAuthorizedByApi", (adminSession, form) => {
  AuthorizedsApi.create(adminSession.token, form)
    .its("status")
    .should("eq", 201);
});

Cypress.Commands.add(
  "authorizedRowShouldShow",
  (form, countryLabel, employees) => {
    authorizedsPage.rowOf(form.ownerEmail).within(() => {
      cy.testIdTextShouldBe("authorized-row-name", form.authorizedName);
      cy.testIdTextShouldBe("authorized-row-country", countryLabel);
      cy.testIdTextShouldBe("authorized-row-employees", String(employees));
    });
  },
);

export const runRegisterAuthorized = (adminSession) => {
  cy.accessAuthorizedsPage(adminSession);
  cy.buildAuthorizedForm().then((form) => {
    cy.fillAuthorizedFormAndSave(form);
    authorizedsPage.successMessage().should("be.visible");
    cy.authorizedRowShouldShow(form, "Brasil", 1);
  });
};
