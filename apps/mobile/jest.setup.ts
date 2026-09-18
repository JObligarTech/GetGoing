// Reanimated 4 test harness (mocks the native worklet runtime, keeps layout animations inert).
require("react-native-reanimated").setUpTests();

// jest-expo's "winter" runtime installs web globals as lazy getters that `require` their polyfill on
// first access. If that first access happens from async work after a test body returns, Jest throws
// "import a file outside of the scope of the test code". Touch them here, inside test scope.
for (const name of ["URL", "URLSearchParams", "DOMException", "__ExpoImportMetaRegistry", "structuredClone", "TextEncoder", "TextDecoder"]) {
  try { void (globalThis as Record<string, unknown>)[name]; } catch { /* not installed in this runtime */ }
}

// jest-expo installs `fetch` as a lazy getter that requires Expo's polyfill on first access, which
// Jest rejects once a test module touches it (supabase-js reads globalThis.fetch at import). Tests
// never hit the network, so replace the getter with an explicit stub up front.
Object.defineProperty(globalThis, "fetch", { value: jest.fn(() => Promise.reject(new Error("network disabled in tests"))), writable: true, configurable: true });

// Native modules without a JS fallback in Jest.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
});
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}));
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { WebView: (props: object) => React.createElement(View, { testID: "webview", ...props }) };
});
