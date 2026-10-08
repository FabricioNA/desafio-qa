import { call } from "./base";
export const AuthApi = {
  login: (credentials) => call("POST", "/api/login", { body: credentials }),
  /** Login por querystring (rota GET legada, usada pelo front). */
  loginByQuery: (credentials) =>
    call("GET", "/api/login", { qs: { ...credentials } }),
  /** Autentica e devolve a sessão (credenciais + token); falha o teste se o login não for aceito. */
  session(credentials) {
    return AuthApi.login(credentials).then((response) => {
      expect(response.status, `login de ${credentials.email}`).to.eq(200);
      return { ...credentials, token: response.body.token };
    });
  },
  health: () => call("GET", "/api/health"),
};
