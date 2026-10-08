import { BasePage } from "./base.page";
export class EmployeesPage extends BasePage {
  constructor() {
    super(...arguments);
    this.route = "#/employees";
    this.titleTestId = "employees-title";
  }
  form() {
    return cy.getByTestId("employee-form");
  }
  fill(data) {
    if (data.name) cy.getByTestId("employee-name").type(data.name);
    if (data.email) cy.getByTestId("employee-email").type(data.email);
    if (data.role) cy.getByTestId("employee-role").select(data.role);
    return this;
  }
  save() {
    cy.getByTestId("employee-save").click();
    return this;
  }
  roleOptions() {
    return cy.getByTestId("employee-role").find("option");
  }
  filterRoleOptions() {
    return cy.getByTestId("employee-filter-role").find("option");
  }
  filterByRole(role) {
    cy.intercept("GET", "/api/employees*").as("employeesQuery");
    cy.getByTestId("employee-filter-role").select(role);
    cy.wait("@employeesQuery");
    return this;
  }
  successMessage() {
    return cy.getByTestId("employee-success");
  }
  rows() {
    return cy.getByTestId("employee-row");
  }
  rowOf(email) {
    return cy.contains('[data-testid="employee-row"]', email);
  }
  emptyState() {
    return cy.getByTestId("employees-empty");
  }
}
/** Rota alternativa que abre a tela já com o formulário (usada para checar a regra de somente leitura). */
export class EmployeeCreatePage extends EmployeesPage {
  constructor() {
    super(...arguments);
    this.route = "#/employees/create";
  }
}
