import { runLogin } from "./Login/commands";
import { runMenuAndAccess } from "./MenuAndAccess/commands";
import { runExpiredSession } from "./ExpiredSession/commands";
import { runRegisterAuthorized } from "./RegisterAuthorized/commands";
import { runContacts } from "./Contacts/commands";
import { runEmployees } from "./Employees/commands";
import { runProducts } from "./Products/commands";
import { decodeJwt } from "../support/data";
import { provisionTenant, superAdminSession } from "../support/tenant";

describe("Regression", () => {
  let admin;
  let tenant;
  let claims;

  before(() => {
    superAdminSession().then((session) => (admin = session));
    provisionTenant("brasil", false).then((created) => {
      tenant = created;
      claims = decodeJwt(created.owner.token);
    });
  });

  beforeEach(() => {
    cy.ignoreUnauthorizedRejection();
  });

  it("Run critical flows end to end", () => {
    runLogin();
    runRegisterAuthorized(admin);
    runMenuAndAccess(tenant.owner);
    runContacts(tenant.owner);
    runEmployees(tenant.owner);
    runProducts(tenant.owner);
    runExpiredSession(tenant.owner, claims);
  });
});
