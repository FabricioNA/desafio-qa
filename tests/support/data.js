let sequence = 0;
/** Sufixo único por execução: permite repetir a suíte sem recriar o banco. */
export const uniqueSuffix = () =>
  `${Date.now().toString(36)}${(sequence++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const uniqueEmail = (prefix = "qa") =>
  `${prefix}.${uniqueSuffix()}@example.com`;
export const uniqueName = (base) => `${base} ${uniqueSuffix()}`;
/** Decodifica o payload de um JWT (sem validar a assinatura). */
export function decodeJwt(token) {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(decodeURIComponent(escape(atob(payload))));
}
