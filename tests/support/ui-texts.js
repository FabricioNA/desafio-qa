/** Substitui {chave} no texto pelos valores informados (mesmo formato dos dicionários do front). */
export const fill = (text, vars) =>
  Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );
