import { BasePage } from "./base.page";
export class LoginPage extends BasePage {
  constructor() {
    super(...arguments);
    this.route = "#/login";
    this.titleTestId = "login-title";
  }
  form() {
    return cy.getByTestId("login-form");
  }
  email() {
    return cy.getByTestId("login-email");
  }
  password() {
    return cy.getByTestId("login-password");
  }
  submitButton() {
    return cy.getByTestId("login-submit");
  }
  credentialsError() {
    return cy.getByTestId("login-error");
  }
  submit() {
    this.submitButton().click();
    return this;
  }
  login({ email, password }) {
    if (email) this.email().type(email);
    if (password) this.password().type(password, { log: false });
    return this.submit();
  }
}
