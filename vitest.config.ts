import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      "tests/firestore.rules.test.ts",
      "tests/database.rules.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/context/GamepadContext.tsx",
        "src/utils/controllerTextInput.ts",
        "src/utils/achievementTotals.ts",
        "src/hooks/useInterval.ts",
      "electron/achievement-summary.cjs",
      "electron/launch-profile.cjs",
        "electron/ipc-security.cjs",
      ],
      thresholds: { lines: 55, functions: 55, statements: 55, branches: 45 },
    },
  },
});
