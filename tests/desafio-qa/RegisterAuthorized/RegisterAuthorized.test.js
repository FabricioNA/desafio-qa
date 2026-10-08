import "./commands";
import { AuthorizedsPage } from "../../support/pages/authorizeds.page";
import { superAdminSession } from "../../support/tenant";
import { uniqueName } from "../../support/data";

describe("Authorizeds - Register authorized", () => {
  const page = new AuthorizedsPage();
  let admin;
  let texts;
  let picklists;

  before(() => {
    superAdminSession().then((session) => (admin = session));
    cy.fixture("ui/textos.json").then((data) => (texts = data));
    cy.fixture("picklists/listas.json").then((data) => (picklists = data));
  });

  beforeEach(() => {
    cy.accessAuthorizedsPage(admin);
  });

  it("Show the form with the country options in the user language", () => {
    page
      .countryOptions()
      .should("have.length", picklists.pt.country.length + 1);
    picklists.pt.country.forEach((option) => {
      page
        .countryOptions()
        .filter(`[value="${option.value}"]`)
        .should("have.text", option.toLabel);
    });
  });

  it("Register authorized and owner and show the new record in the list", () => {
    cy.buildAuthorizedForm().then((form) => {
      cy.fillAuthorizedFormAndSave(form);

      page.successMessage().should("have.text", texts.pt.autorizadas.sucesso);
      cy.authorizedRowShouldShow(form, "Brasil", 1);
      page
        .rowOf(form.ownerEmail)
        .find('[data-testid="authorized-row-country"]')
        .should("have.attr", "data-country", "brasil");
    });
  });

  it("Clear the form after registering", () => {
    cy.buildAuthorizedForm().then((form) => {
      cy.fillAuthorizedFormAndSave(form);

      page.successMessage().should("be.visible");
      cy.getByTestId("authorized-name").should("have.value", "");
      cy.getByTestId("owner-email").should("have.value", "");
    });
  });

  it("Show the authorized country by its Portuguese label (RN08)", () => {
    cy.buildAuthorizedForm({ country: "colombia" }).then((form) => {
      cy.fillAuthorizedFormAndSave(form);

      cy.authorizedRowShouldShow(form, "Colômbia", 1);
    });
  });

  it("Register without filling shows the required fields", () => {
    page.save();

    ["authorizedName", "ownerName", "ownerEmail", "country"].forEach(
      (field) => {
        page.fieldError(field).should("have.text", texts.pt.erros.REQUIRED);
      },
    );
    page.successMessage().should("not.exist");
  });

  it("Register with invalid owner email and short name shows validation errors", () => {
    cy.buildAuthorizedForm({
      ownerEmail: "sem-arroba",
      authorizedName: "A",
    }).then((form) => {
      cy.fillAuthorizedFormAndSave(form);

      page
        .fieldError("ownerEmail")
        .should("have.text", texts.pt.erros.INVALID_EMAIL);
      page
        .fieldError("authorizedName")
        .should("have.text", texts.pt.erros.MIN_LENGTH);
    });
  });

  it("Register with an owner email already registered shows duplicate error", () => {
    cy.buildAuthorizedForm().then((form) => {
      cy.createAuthorizedByApi(admin, form);

      cy.fillAuthorizedFormAndSave({
        ...form,
        authorizedName: uniqueName("Outra Autorizada"),
      });

      page
        .fieldError("ownerEmail")
        .should("have.text", texts.pt.erros.DUPLICATE_EMAIL);
      page.successMessage().should("not.exist");
    });
  });

  it("Register shows generic error when the server fails (mock 500)", () => {
    cy.intercept("POST", "/api/authorizeds", {
      statusCode: 500,
      body: { error: "INTERNAL_ERROR" },
    }).as("createFailure");
    cy.buildAuthorizedForm().then((form) => {
      cy.fillAuthorizedFormAndSave(form);

      cy.wait("@createFailure");
      page.formAlert("form-error").should("have.text", texts.pt.erros.GENERIC);
    });
  });

  it("Show the list returned by the server (mock) with the employees count", () => {
    cy.intercept("GET", "/api/authorizeds", {
      body: {
        total: 1,
        items: [
          {
            id: "mock-1",
            name: "Autorizada Mock",
            country: "argentina",
            countryToLabel: "Argentina",
            language: "es",
            owner: { name: "Dono Mock", email: "dono@example.com" },
            employeesCount: 7,
          },
        ],
      },
    }).as("listAuthorizeds");
    cy.accessAuthorizedsPage(admin);
    cy.wait("@listAuthorizeds");

    page.rows().should("have.length", 1);
    page
      .rowOf("dono@example.com")
      .find('[data-testid="authorized-row-employees"]')
      .should("have.text", "7");
  });
});
