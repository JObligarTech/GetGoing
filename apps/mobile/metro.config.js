// Metro config for a pnpm monorepo: watch the workspace and resolve hoisted modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Shared packages ship TypeScript source; Metro transpiles them like app code.
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];

module.exports = config;
