import { AppShell } from "../../support/pages/app-shell";
import { LoginPage } from "../../support/pages/login.page";
import { pageFor } from "../../support/pages";

const shell = new AppShell();

Cypress.Commands.add("openScreenAs", (screen, session) => {
  pageFor(screen).open(session);
});

Cypress.Commands.add("openScreenAsVisitor", (screen) => {
  pageFor(screen).openAnonymous();
});

Cypress.Commands.add("menuShouldShow", (resources, language = "pt") => {
  cy.fixture("ui/textos.json").then((texts) => {
    shell.menuItems().should("have.length", resources.length);
    resources.forEach((resource) => {
      shell
        .menuItem(resource)
        .should("be.visible")
        .and("have.text", texts[language].menu[resource]);
    });
  });
});

Cypress.Commands.add("menuItemShouldNotExist", (resource) => {
  shell.menuItem(resource).should("not.exist");
});

Cypress.Commands.add("clickMenuItem", (resource) => {
  shell.menuItem(resource).click();
});

Cypress.Commands.add("shouldBeRedirectedTo", (hash) => {
  cy.location("hash").should("eq", hash);
});

Cypress.Commands.add("shouldBeAtLogin", () => {
  cy.location("hash").should("eq", "#/login");
  new LoginPage().form().should("be.visible");
});

export const runMenuAndAccess = (brasilOwner) => {
  cy.openScreenAs("products", brasilOwner);
  cy.menuShouldShow(["contacts", "products", "employees"]);
  cy.clickMenuItem("employees");
  cy.shouldBeRedirectedTo("#/employees");
};
