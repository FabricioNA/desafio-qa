/** Componente do cabeçalho/menu presente em todas as telas autenticadas. */
export class AppShell {
  menu() {
    return cy.getByTestId("menu");
  }
  menuItem(resource) {
    return cy.getByTestId(`menu-${resource}`);
  }
  menuItems() {
    return this.menu().find("a");
  }
  userName() {
    return cy.getByTestId("user-name");
  }
  userRole() {
    return cy.getByTestId("user-role");
  }
  companyName() {
    return cy.getByTestId("company-name");
  }
  logoutButton() {
    return cy.getByTestId("logout");
  }
  logout() {
    this.logoutButton().click();
  }
  noAccess() {
    return cy.getByTestId("no-access");
  }
}
