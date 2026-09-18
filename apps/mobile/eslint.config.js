// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "node_modules/*"] },
  // Jest config/setup are CommonJS files run by Node, not app code.
  { files: ["jest.config.js", "jest.setup.ts"], languageOptions: { globals: { __dirname: "readonly", require: "readonly" } }, rules: { "@typescript-eslint/no-require-imports": "off" } },
]);
