import { call } from "../../support/api/base";
import {
  ENDPOINTS,
  PROFILES,
  PROFILE_LABELS,
} from "../../support/permission-matrix";
import { provisionTenant, superAdminSession } from "../../support/tenant";

describe("Matriz de permissões por perfil (RN01, RN06, RN13, RN14)", () => {
  const tokens = {};

  before(() => {
    superAdminSession().then((session) => (tokens.superAdmin = session.token));
    provisionTenant("brasil").then((tenant) => {
      tokens.owner = tenant.owner.token;
      tokens.attendant = tenant.attendant.token;
    });
    provisionTenant("colombia").then(
      (tenant) => (tokens.ownerColombia = tenant.owner.token),
    );
  });

  ENDPOINTS.forEach((endpoint) => {
    context(`${endpoint.name} (${endpoint.method} ${endpoint.url})`, () => {
      PROFILES.forEach((profile) => {
        const expected = endpoint.expected[profile];
        const bug = endpoint.bug?.[profile];
        const title = `${bug ? `[${bug}] ` : ""}${PROFILE_LABELS[profile]} recebe ${expected}`;

        it(title, () => {
          call(endpoint.method, endpoint.url, {
            token: tokens[profile],
            body: endpoint.body?.(),
          }).then((response) => {
            expect(response.status).to.eq(expected);
            if (expected === 403) {
              expect(response.body).to.deep.eq({ error: "FORBIDDEN" });
            }
            if (expected === 401) {
              expect(response.body).to.deep.eq({ error: "UNAUTHORIZED" });
            }
          });
        });
      });
    });
  });
});
