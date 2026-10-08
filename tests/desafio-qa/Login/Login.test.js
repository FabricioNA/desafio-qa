import "./commands";
import { AppShell } from "../../support/pages/app-shell";
import { AuthorizedsPage } from "../../support/pages/authorizeds.page";
import { LoginPage } from "../../support/pages/login.page";

describe("Login", () => {
  const loginPage = new LoginPage();
  const shell = new AppShell();
  let users;
  let texts;

  before(() => {
    cy.fixture("users/credenciais.json").then((data) => (users = data));
    cy.fixture("ui/textos.json").then((data) => (texts = data));
  });

  it("Login Super Admin and open the first allowed screen", () => {
    cy.accessLoginPage();
    cy.loginAsSuperAdmin();

    cy.location("hash").should("eq", "#/authorizeds");
    new AuthorizedsPage()
      .title()
      .should("have.text", texts.pt.titulos.authorizeds);
    shell.userName().should("have.text", users.superAdmin.name);
    shell.userRole().should("have.text", "Super Admin");
    shell.companyName().should("not.exist");
    cy.sessionTokenShouldExist();
  });

  it("Logout and return to the login page", () => {
    cy.accessLoginPage();
    cy.intercept("GET", "/api/authorizeds").as("authorizeds");
    cy.loginAsSuperAdmin();
    cy.wait("@authorizeds");
    cy.logoutUser();

    cy.location("hash").should("eq", "#/login");
    loginPage.form().should("be.visible");
    cy.sessionTokenShouldNotExist();
  });

  it("Show login fields with masked password", () => {
    cy.accessLoginPage();

    loginPage.title().should("have.text", "Entrar");
    loginPage.email().should("be.visible");
    loginPage
      .password()
      .should("be.visible")
      .and("have.attr", "type", "password");
    loginPage.submitButton().should("be.enabled");
  });

  it("Login with wrong password shows invalid credentials", () => {
    cy.accessLoginPage();
    cy.loginWithWrongPassword();

    loginPage
      .credentialsError()
      .should("have.text", texts.pt.erros.INVALID_CREDENTIALS);
    cy.location("hash").should("eq", "#/login");
    cy.sessionTokenShouldNotExist();
  });

  it("Login without email and password shows required fields", () => {
    cy.accessLoginPage();
    cy.submitEmptyLogin();

    loginPage.fieldError("email").should("have.text", texts.pt.erros.REQUIRED);
    loginPage
      .fieldError("password")
      .should("have.text", texts.pt.erros.REQUIRED);
  });

  it("Login shows generic error when the server fails (mock 500)", () => {
    cy.intercept("/api/login*", {
      statusCode: 500,
      body: { error: "INTERNAL_ERROR" },
    }).as("loginFailure");
    cy.accessLoginPage();
    cy.loginAsSuperAdmin();

    cy.wait("@loginFailure");
    cy.getByTestId("form-error").should("have.text", texts.pt.erros.GENERIC);
    cy.location("hash").should("eq", "#/login");
  });

  it("[BUG-002] Login does not send the password in the URL", () => {
    cy.intercept("/api/login*").as("loginRequest");
    cy.accessLoginPage();
    cy.loginAsSuperAdmin();

    cy.wait("@loginRequest").then(({ request }) => {
      expect(request.url, "senha na querystring").not.to.contain(
        encodeURIComponent(users.superAdmin.password),
      );
      expect(request.method).to.eq("POST");
    });
  });
});
