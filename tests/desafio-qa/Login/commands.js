import { AppShell } from "../../support/pages/app-shell";
import { LoginPage } from "../../support/pages/login.page";
import { TOKEN_KEY } from "../../support/pages/base.page";

const loginPage = new LoginPage();
const shell = new AppShell();

Cypress.Commands.add("accessLoginPage", () => {
  loginPage.openAnonymous();
  loginPage.form().should("be.visible");
});

Cypress.Commands.add("loginAsSuperAdmin", () => {
  cy.fixture("users/credenciais.json").then(({ superAdmin }) => {
    loginPage.login(superAdmin);
  });
});

Cypress.Commands.add("loginWithWrongPassword", () => {
  cy.fixture("users/credenciais.json").then(({ superAdmin }) => {
    loginPage.login({ email: superAdmin.email, password: "senha-incorreta" });
  });
});

Cypress.Commands.add("submitEmptyLogin", () => {
  loginPage.submit();
});

Cypress.Commands.add("logoutUser", () => {
  shell.logout();
});

Cypress.Commands.add("sessionTokenShouldExist", () => {
  cy.window()
    .its("localStorage")
    .invoke("getItem", TOKEN_KEY)
    .should("be.a", "string");
});

Cypress.Commands.add("sessionTokenShouldNotExist", () => {
  cy.window()
    .its("localStorage")
    .invoke("getItem", TOKEN_KEY)
    .should("be.null");
});

export const runLogin = () => {
  cy.accessLoginPage();
  cy.loginAsSuperAdmin();
  cy.sessionTokenShouldExist();
  cy.logoutUser();
  cy.sessionTokenShouldNotExist();
};
