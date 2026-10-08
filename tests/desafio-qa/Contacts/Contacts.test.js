import "./commands";
import { ContactsPage } from "../../support/pages/contacts.page";
import { provisionTenant } from "../../support/tenant";

describe("Contacts - Register and list contacts", () => {
  const page = new ContactsPage();
  const countries = ["brasil", "argentina", "colombia"];
  const tenants = {};
  let emptyTenant;
  let data;
  let texts;

  before(() => {
    cy.fixture("contacts/contatos.json").then((fixture) => (data = fixture));
    cy.fixture("ui/textos.json").then((fixture) => (texts = fixture));
    countries.forEach((country) => {
      provisionTenant(country).then((tenant) => (tenants[country] = tenant));
    });
    provisionTenant("brasil", false).then((tenant) => (emptyTenant = tenant));
  });

  context("Register contact", () => {
    beforeEach(() => {
      cy.accessContactsPage(tenants.brasil.owner);
    });

    it("Register contact with valid data and list the new record", () => {
      cy.buildContact({ phone: "11987654321" }).then((contact) => {
        cy.fillContactFormAndSave(contact);

        page.successMessage().should("have.text", texts.pt.contatos.sucesso);
        page.nameInput().should("have.value", "");
        page.emailInput().should("have.value", "");
        page.phoneInput().should("have.value", "");
        cy.contactRowShouldShow(contact, "+5511987654321");
      });
    });

    it("Register contact without filling shows the required fields", () => {
      page.save();

      page.fieldError("name").should("have.text", texts.pt.erros.REQUIRED);
      page.fieldError("email").should("have.text", texts.pt.erros.REQUIRED);
      page.fieldError("phone").should("have.text", texts.pt.erros.REQUIRED);
      page.successMessage().should("not.exist");
    });

    it("Register contact with short name and invalid email shows validation errors", () => {
      cy.buildContact({ name: "J", email: "sem-arroba" }).then((contact) => {
        cy.fillContactFormAndSave(contact);

        page.fieldError("name").should("have.text", texts.pt.erros.MIN_LENGTH);
        page
          .fieldError("email")
          .should("have.text", texts.pt.erros.INVALID_EMAIL);
      });
    });

    it("Register contact with an email already in the authorized shows duplicate error", () => {
      cy.buildContact().then((contact) => {
        cy.createContactByApi(tenants.brasil.owner, contact);

        cy.fillContactFormAndSave(contact);

        page
          .fieldError("email")
          .should("have.text", texts.pt.erros.DUPLICATE_EMAIL);
        page.successMessage().should("not.exist");
      });
    });

    it("Register contact with incomplete phone shows invalid phone", () => {
      cy.buildContact({ phone: data.interface.telefoneIncompleto.brasil }).then(
        (contact) => {
          cy.fillContactFormAndSave(contact);

          page
            .fieldError("phone")
            .should("have.text", texts.pt.erros.INVALID_PHONE);
          page.successMessage().should("not.exist");
        },
      );
    });

    it("Register contact shows generic error when the server fails (mock 500)", () => {
      cy.intercept("POST", "/api/contacts", {
        statusCode: 500,
        body: { error: "INTERNAL_ERROR" },
      }).as("createFailure");
      cy.buildContact().then((contact) => {
        cy.fillContactFormAndSave(contact);

        cy.wait("@createFailure");
        page
          .formAlert("form-error")
          .should("have.text", texts.pt.erros.GENERIC);
      });
    });

    it("Register contact shows permission error when the server answers 403 (mock)", () => {
      cy.intercept("POST", "/api/contacts", {
        statusCode: 403,
        body: { error: "FORBIDDEN" },
      }).as("forbidden");
      cy.buildContact().then((contact) => {
        cy.fillContactFormAndSave(contact);

        cy.wait("@forbidden");
        page
          .formAlert("form-error")
          .should("have.text", texts.pt.erros.FORBIDDEN);
      });
    });
  });

  context("Phone field mask and validation (RN10)", () => {
    countries.forEach((country) => {
      context(country, () => {
        // Argentina: o front não aplica prefixo nem limite de dígitos no campo.
        const bug = (title) =>
          country === "argentina" ? `[BUG-004] ${title}` : title;

        beforeEach(() => {
          cy.accessContactsPage(tenants[country].owner);
        });

        it(bug("Type phone applies the country prefix and mask"), () => {
          data.interface.mascaras[country].forEach((mask) => {
            cy.typePhone(mask.digitado);
            cy.phoneShouldBe(mask.exibido);
          });
        });

        it(bug("Paste phone with or without the country code"), function () {
          const pasted = data.interface.colagem[country];
          if (!pasted) this.skip();

          cy.pastePhone(pasted.colado);

          cy.phoneShouldBe(pasted.exibido);
        });

        it(
          bug(
            "Leave an incomplete phone shows invalid phone and typing clears it",
          ),
          () => {
            page
              .phoneInput()
              .type(data.interface.telefoneIncompleto[country])
              .blur();
            page
              .fieldError("phone")
              .should(
                "have.text",
                texts[country === "brasil" ? "pt" : "es"].erros.INVALID_PHONE,
              );

            page.phoneInput().type("0");

            page.fieldError("phone").should("have.text", "");
          },
        );

        it("Leave an empty phone does not show error", () => {
          page.phoneInput().focus().blur();

          page.fieldError("phone").should("have.text", "");
        });
      });
    });

    it("Register contact from Colombia with formatted phone and list it normalized", () => {
      cy.accessContactsPage(tenants.colombia.owner);
      cy.buildContact({ phone: "3001234567" }).then((contact) => {
        cy.fillContactFormAndSave(contact);

        page.successMessage().should("have.text", texts.es.contatos.sucesso);
        cy.contactRowShouldShow(contact, "+573001234567");
      });
    });
  });

  context("Contacts display by profile and country (RN06, RN07)", () => {
    it("Show the empty state when the authorized has no contacts", () => {
      cy.accessContactsPage(emptyTenant.owner);

      page.title().should("have.text", texts.pt.titulos.contacts);
      page.emptyState().should("have.text", texts.pt.contatos.vazio);
    });

    it("List the authorized contacts with the normalized phone", () => {
      cy.buildContact().then((contact) => {
        cy.createContactByApi(tenants.brasil.owner, contact);

        cy.accessContactsPage(tenants.brasil.owner);

        cy.contactRowShouldShow(
          contact,
          data.telefones.brasil.validos[0].esperado,
        );
      });
    });

    it("Show the form fields in Portuguese for Brazil", () => {
      cy.accessContactsPage(tenants.brasil.owner);

      page.form().should("be.visible");
      page.fieldLabel("name").should("have.text", texts.pt.contatos.nome);
      page.fieldLabel("email").should("have.text", texts.pt.contatos.email);
      page.fieldLabel("phone").should("have.text", texts.pt.contatos.telefone);
    });

    countries.forEach((country) => {
      it(`Show the phone placeholder of the country (${country})`, () => {
        cy.accessContactsPage(tenants[country].owner);

        page
          .phoneInput()
          .should(
            "have.attr",
            "placeholder",
            data.interface.placeholders[country],
          );
      });
    });

    it("[BUG-005] Show the form fields in Spanish for Argentina (RN07)", () => {
      cy.accessContactsPage(tenants.argentina.owner);

      page.title().should("have.text", texts.es.titulos.contacts);
      page.fieldLabel("name").should("have.text", texts.es.contatos.nome);
      page.fieldLabel("email").should("have.text", texts.es.contatos.email);
      page.fieldLabel("phone").should("have.text", texts.es.contatos.telefone);
    });

    it("Show the form fields in Spanish for Colombia (RN07)", () => {
      cy.accessContactsPage(tenants.colombia.owner);

      page.fieldLabel("name").should("have.text", texts.es.contatos.nome);
      page.fieldLabel("phone").should("have.text", texts.es.contatos.telefone);
    });

    it("[RN06] Attendant lists the contacts but does not see the register form", () => {
      cy.buildContact().then((contact) => {
        cy.createContactByApi(tenants.brasil.owner, contact);

        cy.accessContactsPage(tenants.brasil.attendant);

        page.rowOf(contact.email).should("be.visible");
        page.form().should("not.exist");
      });
    });
  });
});
