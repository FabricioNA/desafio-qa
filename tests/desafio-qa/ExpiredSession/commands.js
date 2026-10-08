import { ContactsPage } from "../../support/pages/contacts.page";
import { LoginPage } from "../../support/pages/login.page";
import { TOKEN_KEY } from "../../support/pages/base.page";

const contactsPage = new ContactsPage();

Cypress.Commands.add("openContactsWithToken", (session, token) => {
  contactsPage.open({ ...session, token });
});

Cypress.Commands.add("openContactsAs", (session) => {
  contactsPage.open(session);
});

Cypress.Commands.add("signExpiredToken", (claims) => {
  cy.task("signToken", { claims, expiresIn: -60 });
});

Cypress.Commands.add("signForgedToken", (claims) => {
  cy.task("signToken", { claims, secret: "chave-forjada", expiresIn: "1h" });
});

Cypress.Commands.add("sessionShouldBeEnded", () => {
  cy.location("hash").should("eq", "#/login");
  new LoginPage().form().should("be.visible");
  cy.window()
    .its("localStorage")
    .invoke("getItem", TOKEN_KEY)
    .should("be.null");
});

// Ao receber 401 o front limpa a sessão e recarrega; a rejeição da chamada interrompida é esperada.
Cypress.Commands.add("ignoreUnauthorizedRejection", () => {
  cy.on(
    "uncaught:exception",
    (error) => !error.message.includes("UNAUTHORIZED"),
  );
});

export const runExpiredSession = (session, claims) => {
  cy.signExpiredToken(claims).then((expired) => {
    cy.openContactsWithToken(session, expired);
    cy.sessionShouldBeEnded();
  });
};
