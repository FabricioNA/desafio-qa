#!/usr/bin/env node
/**
 * Quality gate da suíte.
 *
 * Lê os relatórios JSON do mochawesome e classifica cada resultado:
 *  - falha de teste marcado [BUG-xxx]  -> defeito conhecido (documentado em docs/defeitos.md)
 *  - falha de teste sem marcação       -> REGRESSÃO (quebra o gate)
 *  - teste [BUG-xxx] que passou        -> defeito aparentemente corrigido (remover a marcação)
 *
 * Por padrão o gate falha só com regressão ou relatório ausente. Com --strict (ou STRICT=true)
 * também falha enquanto houver defeito conhecido em aberto.
 */
const fs = require("fs");
const path = require("path");

const STRICT =
  process.argv.includes("--strict") || process.env.STRICT === "true";
const SUITES = [
  { name: "API", file: "reports/api/index.json" },
  { name: "E2E (UI)", file: "reports/e2e/index.json" },
];
const BUG_TAG = /\[(BUG-\d+)\]/;

function collectTests(suite, found = []) {
  (suite.tests || []).forEach((test) => found.push(test));
  (suite.suites || []).forEach((child) => collectTests(child, found));
  return found;
}

function analyze({ name, file }) {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) return { name, missing: true };

  const report = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const tests = (report.results || []).flatMap((result) =>
    collectTests(result),
  );

  const summary = {
    name,
    total: tests.length,
    passed: 0,
    skipped: 0,
    regressions: [],
    knownDefects: [],
    fixedDefects: [],
  };

  tests.forEach((test) => {
    const bug = BUG_TAG.exec(test.fullTitle || test.title);
    if (test.state === "failed") {
      (bug ? summary.knownDefects : summary.regressions).push({
        bug: bug && bug[1],
        title: test.fullTitle || test.title,
      });
    } else if (test.state === "passed") {
      summary.passed += 1;
      if (bug)
        summary.fixedDefects.push({ bug: bug[1], title: test.fullTitle });
    } else {
      summary.skipped += 1;
    }
  });
  return summary;
}

const results = SUITES.map(analyze);
const lines = ["## Quality gate", ""];

lines.push(
  "| Suíte | Total | Passaram | Regressões | Defeitos conhecidos | Ignorados |",
);
lines.push("|---|---:|---:|---:|---:|---:|");
results.forEach((r) => {
  if (r.missing) {
    lines.push(`| ${r.name} | — | — | — | — | relatório não encontrado |`);
  } else {
    lines.push(
      `| ${r.name} | ${r.total} | ${r.passed} | ${r.regressions.length} | ${r.knownDefects.length} | ${r.skipped} |`,
    );
  }
});

const regressions = results.flatMap((r) =>
  (r.regressions || []).map((t) => ({ ...t, suite: r.name })),
);
const known = results.flatMap((r) =>
  (r.knownDefects || []).map((t) => ({ ...t, suite: r.name })),
);
const fixed = results.flatMap((r) =>
  (r.fixedDefects || []).map((t) => ({ ...t, suite: r.name })),
);
const missing = results.filter((r) => r.missing);

if (regressions.length) {
  lines.push("", "### Regressões (falhas sem marcação de defeito conhecido)");
  regressions.forEach((t) => lines.push(`- **${t.suite}** — ${t.title}`));
}

if (known.length) {
  const byBug = {};
  known.forEach((t) => {
    byBug[t.bug] = byBug[t.bug] || [];
    byBug[t.bug].push(t);
  });
  lines.push("", "### Defeitos conhecidos em aberto (ver docs/defeitos.md)");
  lines.push("| Defeito | Testes que falham |", "|---|---:|");
  Object.keys(byBug)
    .sort()
    .forEach((bug) => lines.push(`| ${bug} | ${byBug[bug].length} |`));
}

if (fixed.length) {
  lines.push(
    "",
    "### Defeitos aparentemente corrigidos (o teste passou — remover a marcação [BUG-xxx])",
  );
  fixed.forEach((t) => lines.push(`- ${t.bug}: ${t.title}`));
}

missing.forEach((r) =>
  lines.push(
    "",
    `> Relatório de **${r.name}** não encontrado: a suíte não chegou a rodar.`,
  ),
);

const failed =
  regressions.length > 0 || missing.length > 0 || (STRICT && known.length > 0);
lines.push("", failed ? "**Resultado: REPROVADO**" : "**Resultado: APROVADO**");
if (!STRICT && known.length) {
  lines.push(
    "",
    "_Modo padrão: defeitos conhecidos não reprovam o gate. Use `--strict` para reprová-los._",
  );
}

const output = lines.join("\n");
console.log(output);
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${output}\n`);

regressions.forEach((t) =>
  console.log(`::error title=Regressão (${t.suite})::${t.title}`),
);
known.forEach((t) =>
  console.log(`::warning title=Defeito conhecido ${t.bug}::${t.title}`),
);

process.exit(failed ? 1 : 0);
