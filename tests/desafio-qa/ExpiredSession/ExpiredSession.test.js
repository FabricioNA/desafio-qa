import "./commands";
import { ContactsPage } from "../../support/pages/contacts.page";
import { decodeJwt } from "../../support/data";
import { provisionTenant } from "../../support/tenant";

describe("Session - Expired or invalid session", () => {
  const contactsPage = new ContactsPage();
  let tenant;
  let claims;

  before(() => {
    provisionTenant("brasil", false).then((created) => {
      tenant = created;
      claims = decodeJwt(created.owner.token);
    });
  });

  beforeEach(() => {
    cy.ignoreUnauthorizedRejection();
  });

  it("Return to login when the token expired", () => {
    cy.signExpiredToken(claims).then((expired) => {
      cy.openContactsWithToken(tenant.owner, expired);

      cy.sessionShouldBeEnded();
    });
  });

  it("Return to login when the token signature is invalid", () => {
    cy.signForgedToken(claims).then((forged) => {
      cy.openContactsWithToken(tenant.owner, forged);

      cy.sessionShouldBeEnded();
    });
  });

  it("Return to login when the server refuses the token during use (mock 401)", () => {
    cy.intercept("GET", "/api/contacts", {
      statusCode: 401,
      body: { error: "UNAUTHORIZED" },
    }).as("unauthorized");
    cy.openContactsAs(tenant.owner);
    cy.wait("@unauthorized");

    cy.sessionShouldBeEnded();
  });

  it("Keep the valid session after reloading the page", () => {
    cy.openContactsAs(tenant.owner);
    contactsPage.title().should("be.visible");

    cy.reload();

    contactsPage.title().should("be.visible");
    cy.location("hash").should("eq", "#/contacts");
  });
});
