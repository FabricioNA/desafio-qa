export const TOKEN_KEY = "desafio_qa_token";

// A query muda a cada abertura: uma URL que difere só no hash não recarrega a página,
// e o token injetado em onBeforeLoad só vale em um carregamento completo.
const freshUrl = (route) => `/?_=${Date.now()}${route}`;
/**
 * Base dos Page Objects. A autenticação é injetada no localStorage via token obtido pela API
 * e a página é aberta direto pelo deep link (hash), sem login nem navegação pela interface.
 */
export class BasePage {
  open(session) {
    cy.visit(freshUrl(this.route), {
      onBeforeLoad: (win) => win.localStorage.setItem(TOKEN_KEY, session.token),
    });
    return this;
  }
  /** Abre a página como visitante (sem token). */
  openAnonymous() {
    cy.visit(freshUrl(this.route));
    return this;
  }
  title() {
    return cy.getByTestId(this.titleTestId);
  }
  fieldError(name) {
    return cy.getByTestId(`error-${name}`);
  }
  formAlert(testId) {
    return cy.getByTestId(testId);
  }
}
