import { call } from "./base";
export const EmployeesApi = {
  list: (token, role) =>
    call("GET", "/api/employees", { token, qs: role ? { role } : undefined }),
  create: (token, body) => call("POST", "/api/employees", { token, body }),
};
