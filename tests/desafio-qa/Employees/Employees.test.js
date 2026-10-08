import "./commands";
import { EmployeesPage } from "../../support/pages/employees.page";
import { provisionTenant } from "../../support/tenant";

describe("Employees - Register and list employees", () => {
  const page = new EmployeesPage();
  let texts;
  let picklists;
  let brasil;
  let argentina;
  let other;
  let colombia;

  before(() => {
    cy.fixture("ui/textos.json").then((fixture) => (texts = fixture));
    cy.fixture("picklists/listas.json").then(
      (fixture) => (picklists = fixture),
    );
    provisionTenant("brasil").then((tenant) => (brasil = tenant));
    provisionTenant("argentina").then((tenant) => (argentina = tenant));
    provisionTenant("brasil").then((tenant) => (other = tenant));
    provisionTenant("colombia").then((tenant) => (colombia = tenant));
  });

  context("Register employee", () => {
    it("Register employee and list it with the chosen role", () => {
      cy.accessEmployeesPage(brasil.owner);
      cy.buildEmployee({ role: "Proprietário" }).then((employee) => {
        cy.fillEmployeeFormAndSave(employee);

        page
          .successMessage()
          .should("have.text", texts.pt.funcionarios.sucesso);
        cy.employeeRowShouldShow(employee, "Proprietário");
        cy.getByTestId("employee-name").should("have.value", "");
        cy.getByTestId("employee-role").should("have.value", "");
      });
    });

    it("Register employee in Argentina shows the role in Spanish", () => {
      cy.accessEmployeesPage(argentina.owner);
      cy.buildEmployee({ role: "Atendente" }).then((employee) => {
        cy.fillEmployeeFormAndSave(employee);

        page
          .successMessage()
          .should("have.text", texts.es.funcionarios.sucesso);
        cy.employeeRowShouldShow(employee, "Asistente");
      });
    });

    it("Register employee without filling shows the required fields", () => {
      cy.accessEmployeesPage(brasil.owner);
      page.save();

      page.fieldError("name").should("have.text", texts.pt.erros.REQUIRED);
      page.fieldError("email").should("have.text", texts.pt.erros.REQUIRED);
      page.successMessage().should("not.exist");
    });

    it("[BUG-007] Register employee without role shows the required error", () => {
      cy.accessEmployeesPage(brasil.owner);
      cy.buildEmployee({ role: "" }).then((employee) => {
        cy.fillEmployeeFormAndSave(employee);

        page.successMessage().should("not.exist");
        page.form().should("contain.text", texts.pt.erros.REQUIRED);
      });
    });

    it("Register employee with short name and invalid email shows validation errors", () => {
      cy.accessEmployeesPage(brasil.owner);
      cy.buildEmployee({ name: "F", email: "sem-arroba" }).then((employee) => {
        cy.fillEmployeeFormAndSave(employee);

        page.fieldError("name").should("have.text", texts.pt.erros.MIN_LENGTH);
        page
          .fieldError("email")
          .should("have.text", texts.pt.erros.INVALID_EMAIL);
      });
    });

    it("Register employee with an email from another authorized shows duplicate error", () => {
      cy.buildEmployee().then((employee) => {
        cy.createEmployeeByApi(argentina.owner, employee);
        cy.accessEmployeesPage(brasil.owner);

        cy.fillEmployeeFormAndSave(employee);

        page
          .fieldError("email")
          .should("have.text", texts.pt.erros.DUPLICATE_EMAIL);
        page.successMessage().should("not.exist");
      });
    });

    it("Register employee shows generic error when the server fails (mock 500)", () => {
      cy.intercept("POST", "/api/employees", {
        statusCode: 500,
        body: { error: "INTERNAL_ERROR" },
      }).as("createFailure");
      cy.accessEmployeesPage(brasil.owner);
      cy.buildEmployee().then((employee) => {
        cy.fillEmployeeFormAndSave(employee);

        cy.wait("@createFailure");
        page
          .formAlert("form-error")
          .should("have.text", texts.pt.erros.GENERIC);
      });
    });

    it("Register employee shows permission error when the server answers 403 (mock)", () => {
      cy.intercept("POST", "/api/employees", {
        statusCode: 403,
        body: { error: "FORBIDDEN" },
      }).as("forbidden");
      cy.accessEmployeesPage(brasil.owner);
      cy.buildEmployee().then((employee) => {
        cy.fillEmployeeFormAndSave(employee);

        cy.wait("@forbidden");
        page
          .formAlert("form-error")
          .should("have.text", texts.pt.erros.FORBIDDEN);
      });
    });
  });

  context(
    "Employees display by profile and country (RN01, RN04, RN06, RN07, RN13)",
    () => {
      it("Show the form to the owner with only the assignable roles", () => {
        cy.accessEmployeesPage(brasil.owner);

        page.title().should("have.text", texts.pt.titulos.employees);
        page.form().should("be.visible");
        page
          .roleOptions()
          .should("have.length", picklists.pt.assignableRole.length + 1);
        page
          .roleOptions()
          .first()
          .should("have.text", texts.pt.funcionarios.selecione);
        picklists.pt.assignableRole.forEach((role) => {
          page
            .roleOptions()
            .filter(`[value="${role.value}"]`)
            .should("have.text", role.toLabel);
        });
        page.roleOptions().filter('[value="Super Admin"]').should("not.exist");
      });

      it("List the owner and the attendant with the role in the user language", () => {
        cy.accessEmployeesPage(brasil.owner);

        page.rows().should("have.length.at.least", 2);
        page
          .rowOf(brasil.owner.email)
          .find('[data-testid="employee-row-role"]')
          .should("have.text", "Proprietário")
          .and("have.attr", "data-role", "Proprietário");
        page
          .rowOf(brasil.attendant.email)
          .find('[data-testid="employee-row-role"]')
          .should("have.text", "Atendente");
      });

      it("Show screen and roles in Spanish for Argentina keeping the Portuguese value (RN07, RN08)", () => {
        cy.accessEmployeesPage(argentina.owner);

        page.title().should("have.text", texts.es.titulos.employees);
        page
          .rowOf(argentina.attendant.email)
          .find('[data-testid="employee-row-role"]')
          .should("have.text", "Asistente")
          .and("have.attr", "data-role", "Atendente");
        picklists.es.assignableRole.forEach((role) => {
          page
            .roleOptions()
            .filter(`[value="${role.value}"]`)
            .should("have.text", role.toLabel);
        });
      });

      it("[RN04] Do not list employees from other authorizeds", () => {
        cy.accessEmployeesPage(brasil.owner);

        page.rowOf(brasil.owner.email).should("be.visible");
        cy.contains(
          '[data-testid="employee-row-email"]',
          other.owner.email,
        ).should("not.exist");
        cy.contains(
          '[data-testid="employee-row-email"]',
          argentina.owner.email,
        ).should("not.exist");
      });

      it("Filter the list by role", () => {
        cy.accessEmployeesPage(brasil.owner);

        cy.filterEmployeesByRole("Atendente");
        cy.listedRolesShouldBeOnly("Atendente");
        page.rowOf(brasil.owner.email).should("not.exist");

        cy.filterEmployeesByRole("Proprietário");
        page.rowOf(brasil.owner.email).should("be.visible");
        page.rowOf(brasil.attendant.email).should("not.exist");
      });

      it("Clear the role filter shows all employees again", () => {
        cy.accessEmployeesPage(brasil.owner);
        cy.filterEmployeesByRole("Atendente");
        page.rowOf(brasil.owner.email).should("not.exist");

        cy.filterEmployeesByRole("");

        page.rowOf(brasil.owner.email).should("be.visible");
      });

      it("[RN06] Attendant lists the employees but does not see the register form", () => {
        cy.accessEmployeesPage(brasil.attendant);

        page.rowOf(brasil.owner.email).should("be.visible");
        page.form().should("not.exist");
      });

      it("[BUG-001] Attendant does not see the form when opening the create route by deep link", () => {
        cy.accessEmployeeCreateRoute(brasil.attendant);

        page.title().should("be.visible");
        page.form().should("not.exist");
      });

      it("[RN13] Hide the module in Colombia even opening the create route directly", () => {
        cy.accessEmployeeCreateRoute(colombia.owner);

        cy.location("hash").should("eq", "#/contacts");
        cy.testIdShouldNotExist("employee-form");
        cy.testIdShouldNotExist("menu-employees");
      });
    },
  );
});
