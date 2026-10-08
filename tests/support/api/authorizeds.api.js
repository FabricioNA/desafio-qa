import { call } from "./base";
export const AuthorizedsApi = {
  list: (token) => call("GET", "/api/authorizeds", { token }),
  create: (token, body) => call("POST", "/api/authorizeds", { token, body }),
};
