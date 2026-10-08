/** Cliente HTTP base: nunca falha por status, quem decide é a asserção do teste. */
export function call(method, url, options = {}) {
  return cy.request({
    method,
    url,
    qs: options.qs,
    body: options.body,
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
    failOnStatusCode: false,
  });
}
/** SLA de resposta (ms) dos fluxos críticos. */
export const SLA_MS = 2000;
