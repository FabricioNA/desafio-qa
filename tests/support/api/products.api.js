import { call } from "./base";
export const ProductsApi = {
  list: (token, query = {}) =>
    call("GET", "/api/products", { token, qs: query }),
  image: (token, id) =>
    cy.request({
      url: `/api/products/${id}/image`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      encoding: "binary",
      failOnStatusCode: false,
    }),
};
export const PicklistsApi = {
  list: (token) => call("GET", "/api/picklists", { token }),
};
