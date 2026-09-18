import { defineConfig } from "vitest/config";
// Database/RLS tests — need VOYA_TEST_DATABASE_URL (see supabase/tests/run-local.sh).
export default defineConfig({
  test: { include: ["db-tests/**/*.test.ts"], testTimeout: 30_000, fileParallelism: false },
});
