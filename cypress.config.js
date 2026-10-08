const { defineConfig } = require("cypress");
const jwt = require("jsonwebtoken");

const reportDir = process.env.REPORT_DIR ?? "reports/html";

module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: `${reportDir}/screenshots`,
  trashAssetsBeforeRuns: true,
  viewportWidth: 1280,
  viewportHeight: 800,
  reporter: "cypress-mochawesome-reporter",
  reporterOptions: {
    reportDir,
    reportFilename: "index",
    reportPageTitle: "Desafio QA — Relatório de execução",
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
    saveJson: true,
  },
  e2e: {
    baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
    specPattern: "tests/**/*.test.js",
    supportFile: "tests/support/e2e.js",
    fixturesFolder: "tests/fixtures",
    defaultCommandTimeout: 6000,
    requestTimeout: 8000,
    setupNodeEvents(on) {
      require("cypress-mochawesome-reporter/plugin")(on);

      on("task", {
        // Gera tokens com assinatura/expiração controladas para os cenários de sessão (RN14).
        signToken({ claims, secret, expiresIn }) {
          const { iat, exp, ...payload } = claims;
          const key =
            secret ?? process.env.JWT_SECRET ?? "dev-only-secret-change-me";
          return jwt.sign(payload, key, { expiresIn });
        },
      });
    },
  },
});
