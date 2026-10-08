import "./commands";
import { AppShell } from "../../support/pages/app-shell";
import { pageFor } from "../../support/pages";
import { provisionTenant, superAdminSession } from "../../support/tenant";

describe("Menu - Menu and access by profile", () => {
  const shell = new AppShell();
  let texts;
  let admin;
  let brasil;
  let colombia;

  before(() => {
    cy.fixture("ui/textos.json").then((data) => (texts = data));
    superAdminSession().then((session) => (admin = session));
    provisionTenant("brasil").then((tenant) => (brasil = tenant));
    provisionTenant("colombia").then((tenant) => (colombia = tenant));
  });

  it("Super Admin sees only Autorizadas and Produtos in the menu", () => {
    cy.openScreenAs("products", admin);
    cy.menuShouldShow(["authorizeds", "products"]);
  });

  it("Owner sees Contatos, Produtos and Funcionarios in the menu", () => {
    cy.openScreenAs("products", brasil.owner);
    cy.menuShouldShow(["contacts", "products", "employees"]);
  });

  it("Attendant sees Contatos, Produtos and Funcionarios in the menu", () => {
    cy.openScreenAs("products", brasil.attendant);
    cy.menuShouldShow(["contacts", "products", "employees"]);
  });

  it("[RN13] Owner from Colombia does not see Funcionarios in the menu", () => {
    cy.openScreenAs("products", colombia.owner);
    cy.menuShouldShow(["contacts", "products"], "es");
    cy.menuItemShouldNotExist("employees");
  });

  it("Show name, role and company of the logged user", () => {
    cy.openScreenAs("contacts", brasil.owner);

    shell.userName().should("have.text", "Proprietário QA");
    shell.userRole().should("have.text", "Proprietário");
    shell.companyName().should("have.text", brasil.authorizedName);
  });

  it("Show the logout button in the user language", () => {
    cy.openScreenAs("contacts", colombia.owner);

    shell.logoutButton().should("have.text", texts.es.logout);
  });

  it("Owner opening Autorizadas by deep link is redirected to Contatos", () => {
    cy.openScreenAs("authorizeds", brasil.owner);

    cy.shouldBeRedirectedTo("#/contacts");
    pageFor("contacts").title().should("be.visible");
    cy.testIdShouldNotExist("authorized-form");
  });

  it("Super Admin opening Contatos by deep link is redirected to Autorizadas", () => {
    cy.openScreenAs("contacts", admin);

    cy.shouldBeRedirectedTo("#/authorizeds");
    pageFor("authorizeds").form().should("be.visible");
  });

  it("[RN13] User from Colombia opening Funcionarios by deep link is redirected", () => {
    cy.openScreenAs("employees", colombia.owner);

    cy.shouldBeRedirectedTo("#/contacts");
    cy.testIdShouldNotExist("employees-title");
  });

  it("Visitor without session is sent to the login page", () => {
    cy.openScreenAsVisitor("contacts");

    cy.shouldBeAtLogin();
  });

  it("Navigate between the allowed screens using the menu", () => {
    cy.openScreenAs("contacts", brasil.owner);

    cy.clickMenuItem("products");
    cy.shouldBeRedirectedTo("#/products");
    pageFor("products").title().should("have.text", texts.pt.titulos.products);

    cy.clickMenuItem("employees");
    cy.shouldBeRedirectedTo("#/employees");
    pageFor("employees")
      .title()
      .should("have.text", texts.pt.titulos.employees);
  });
});
