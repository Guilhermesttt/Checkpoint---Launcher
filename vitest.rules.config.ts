import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/firestore.rules.test.ts"],
    hookTimeout: 20_000,
    testTimeout: 15_000,
    fileParallelism: false,
  },
});
