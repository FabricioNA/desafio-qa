// Comandos auxiliares gerais

Cypress.Commands.add("getByTestId", (testId, options) =>
  cy.get(`[data-testid="${testId}"]`, options),
);

Cypress.Commands.add("getAndClick", (testId) => {
  cy.getByTestId(testId).click();
});

Cypress.Commands.add("getInputAndType", (testId, text) => {
  cy.getByTestId(testId).clear().type(text);
});

Cypress.Commands.add("getAndSelect", (testId, value) => {
  cy.getByTestId(testId).select(value);
});

Cypress.Commands.add("testIdTextShouldBe", (testId, text) => {
  cy.getByTestId(testId).should("have.text", text);
});

Cypress.Commands.add("testIdShouldBeVisible", (testId) => {
  cy.getByTestId(testId).should("be.visible");
});

Cypress.Commands.add("testIdShouldNotExist", (testId) => {
  cy.getByTestId(testId).should("not.exist");
});
