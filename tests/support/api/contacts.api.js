import { call } from "./base";
export const ContactsApi = {
  list: (token) => call("GET", "/api/contacts", { token }),
  create: (token, body) => call("POST", "/api/contacts", { token, body }),
};
