import { AuthApi } from "./api/auth.api";
import { AuthorizedsApi } from "./api/authorizeds.api";
import { EmployeesApi } from "./api/employees.api";
import { uniqueEmail, uniqueName } from "./data";
/**
 * Cria, via API, uma autorizada nova com proprietário (e atendente, se o país permitir).
 * Cada spec trabalha na sua própria autorizada: não há dependência entre specs nem de limpeza de dados.
 */
export function provisionTenant(country, withAttendant = true) {
  return cy.fixture("users/credenciais.json").then((users) =>
    AuthApi.session(users.superAdmin).then((admin) => {
      const authorizedName = uniqueName("Autorizada QA");
      const ownerEmail = uniqueEmail("proprietario");
      return AuthorizedsApi.create(admin.token, {
        authorizedName,
        ownerName: "Proprietário QA",
        ownerEmail,
        country,
      }).then((created) => {
        expect(created.status, "criação da autorizada").to.eq(201);
        return AuthApi.session({
          email: ownerEmail,
          password: users.defaultPassword,
        }).then((owner) => {
          const tenant = {
            authorizedId: created.body.id,
            authorizedName,
            country,
            owner,
          };
          // Colômbia não tem o módulo de funcionários (RN13): não há como criar o atendente.
          if (!withAttendant || country === "colombia") return cy.wrap(tenant);
          const attendantEmail = uniqueEmail("atendente");
          return EmployeesApi.create(owner.token, {
            name: "Atendente QA",
            email: attendantEmail,
            role: "Atendente",
          }).then((employee) => {
            expect(employee.status, "criação do atendente").to.eq(201);
            return AuthApi.session({
              email: attendantEmail,
              password: users.defaultPassword,
            }).then((attendant) => cy.wrap({ ...tenant, attendant }));
          });
        });
      });
    }),
  );
}
export function superAdminSession() {
  return cy
    .fixture("users/credenciais.json")
    .then((users) => AuthApi.session(users.superAdmin));
}
