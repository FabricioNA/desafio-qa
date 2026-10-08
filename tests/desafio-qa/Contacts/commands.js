import { ContactsApi } from "../../support/api/contacts.api";
import { uniqueEmail } from "../../support/data";
import { ContactsPage } from "../../support/pages/contacts.page";

const contactsPage = new ContactsPage();

Cypress.Commands.add("accessContactsPage", (session) => {
  contactsPage.open(session);
  contactsPage.title().should("be.visible");
});

Cypress.Commands.add("buildContact", (overrides = {}) => {
  cy.fixture("contacts/contatos.json").then(({ contato, telefones }) => ({
    name: contato.name,
    email: uniqueEmail(contato.emailPrefix),
    phone: telefones.brasil.validos[0].entrada,
    ...overrides,
  }));
});

Cypress.Commands.add("fillContactFormAndSave", (contact) => {
  contactsPage.fill(contact).save();
});

Cypress.Commands.add("createContactByApi", (session, contact) => {
  ContactsApi.create(session.token, contact).its("status").should("eq", 201);
});

Cypress.Commands.add("contactRowShouldShow", (contact, normalizedPhone) => {
  contactsPage.rowOf(contact.email).within(() => {
    cy.get("td").eq(0).should("have.text", contact.name);
    cy.get("td").eq(2).should("have.text", normalizedPhone);
  });
});

Cypress.Commands.add("typePhone", (digits) => {
  contactsPage.phoneInput().clear().type(digits);
});

Cypress.Commands.add("pastePhone", (value) => {
  contactsPage.paste(value);
});

Cypress.Commands.add("phoneShouldBe", (expected) => {
  contactsPage.phoneInput().should("have.value", expected);
});

export const runContacts = (ownerSession) => {
  cy.accessContactsPage(ownerSession);
  cy.buildContact({ phone: "11987654321" }).then((contact) => {
    cy.fillContactFormAndSave(contact);
    contactsPage.successMessage().should("be.visible");
    cy.contactRowShouldShow(contact, "+5511987654321");
  });
};
