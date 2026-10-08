import { BasePage } from "./base.page";
export class ContactsPage extends BasePage {
  constructor() {
    super(...arguments);
    this.route = "#/contacts";
    this.titleTestId = "contacts-title";
  }
  form() {
    return cy.getByTestId("contact-form");
  }
  nameInput() {
    return cy.getByTestId("contact-name");
  }
  emailInput() {
    return cy.getByTestId("contact-email");
  }
  phoneInput() {
    return cy.getByTestId("contact-phone");
  }
  fieldLabel(field) {
    return this.form().find(`label[for="contact-${field}"]`);
  }
  saveButton() {
    return cy.getByTestId("contact-save");
  }
  fill(data) {
    if (data.name) this.nameInput().type(data.name);
    if (data.email) this.emailInput().type(data.email);
    if (data.phone) this.phoneInput().type(data.phone);
    return this;
  }
  /** Simula a colagem de um valor (um único evento input, sem digitação tecla a tecla). */
  paste(phone) {
    this.phoneInput().invoke("val", phone).trigger("input");
    return this;
  }
  save() {
    this.saveButton().click();
    return this;
  }
  successMessage() {
    return cy.getByTestId("contact-success");
  }
  rows() {
    return cy.getByTestId("contact-row");
  }
  rowOf(email) {
    return cy.contains('[data-testid="contact-row"]', email);
  }
  emptyState() {
    return cy.getByTestId("contacts-empty");
  }
}
