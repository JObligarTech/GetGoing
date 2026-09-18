const path = require("node:path");

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Reanimated 4 / worklets: resolve the JS (non-.native) implementations under Jest.
  resolver: path.join(__dirname, "../../node_modules/react-native-worklets/jest/resolver.js"),
  setupFilesAfterEnv: ["./jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)", "**/*.test.[jt]s?(x)"],
  // Shared workspace packages are TS source; let babel-jest handle them too.
  // jest-expo's default list (prefix matches, so `expo` also covers expo-router, expo-modules-core…) plus our workspace packages.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@voya/.*|react-native-webview)",
  ],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
