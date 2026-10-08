import { EmployeesApi } from "../../support/api/employees.api";
import { uniqueEmail } from "../../support/data";
import {
  EmployeeCreatePage,
  EmployeesPage,
} from "../../support/pages/employees.page";

const employeesPage = new EmployeesPage();

Cypress.Commands.add("accessEmployeesPage", (session) => {
  employeesPage.open(session);
  employeesPage.title().should("be.visible");
});

Cypress.Commands.add("accessEmployeeCreateRoute", (session) => {
  new EmployeeCreatePage().open(session);
});

Cypress.Commands.add("buildEmployee", (overrides = {}) => {
  cy.fixture("employees/funcionarios.json").then(({ funcionario }) => ({
    name: funcionario.name,
    email: uniqueEmail(funcionario.emailPrefix),
    role: "Atendente",
    ...overrides,
  }));
});

Cypress.Commands.add("fillEmployeeFormAndSave", (employee) => {
  employeesPage.fill(employee).save();
});

Cypress.Commands.add("createEmployeeByApi", (session, employee) => {
  EmployeesApi.create(session.token, employee).its("status").should("eq", 201);
});

Cypress.Commands.add("employeeRowShouldShow", (employee, roleLabel) => {
  employeesPage.rowOf(employee.email).within(() => {
    cy.testIdTextShouldBe("employee-row-name", employee.name);
    cy.testIdTextShouldBe("employee-row-role", roleLabel);
  });
});

Cypress.Commands.add("filterEmployeesByRole", (role) => {
  employeesPage.filterByRole(role);
});

Cypress.Commands.add("listedRolesShouldBeOnly", (role) => {
  cy.getByTestId("employee-row-role").should(($cells) => {
    expect($cells.length).to.be.greaterThan(0);
    $cells.each((_, cell) => {
      expect(cell.getAttribute("data-role")).to.eq(role);
    });
  });
});

export const runEmployees = (ownerSession) => {
  cy.accessEmployeesPage(ownerSession);
  cy.buildEmployee({ role: "Proprietário" }).then((employee) => {
    cy.fillEmployeeFormAndSave(employee);
    employeesPage.successMessage().should("be.visible");
    cy.employeeRowShouldShow(employee, "Proprietário");
  });
};
