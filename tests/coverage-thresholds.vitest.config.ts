// tests/coverage-thresholds.vitest.config.ts
// Phase 5 — Trophy-only coverage gate (90% lines / 85% branches).
//
// This config layers on top of the repo-wide `vitest.config.ts` and applies a
// stricter threshold to the trophy modules listed below. Run it explicitly
// after Phase 5 changes:
//
//   npx vitest run --config tests/coverage-thresholds.vitest.config.ts --coverage
//
// or via the script:
//
//   npm run test:coverage:trophies
//
// Modules that change the surface of the trophy pipeline (alert dispatcher,
// notification rendering, Supabase schema contract) MUST stay above 90% / 85%.

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const TROPHY_INCLUDE = [
  // Core metrics + instrumentation
  "src/lib/trophyMetrics.ts",
  "src/lib/trophyInstrumentation.ts",
  // Detection / streaming
  "src/services/achievementDetector.ts",
  "src/services/trophyRealtime.ts",
  "src/services/trophyUnlockStream.ts",
  "src/services/trophyHistory.ts",
  // Renderer-side hook
  "src/hooks/useTrophyUnlockStream.ts",
  // Electron-side notification renderer
  "electron/trophy-notification.cjs",
  // Supabase Edge Function shared helpers (email-template + resend client).
  // The Edge Function entrypoint itself runs on Deno and is validated by
  // `tests/supabase-schema-contract.test.ts` rather than the v8 coverage
  // gate; Deno is not available in the Vitest environment.
  "supabase/functions/_shared/email-template.ts",
  "supabase/functions/_shared/resend.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(projectRoot, "./src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      "tests/firestore.rules.test.ts",
      "tests/database.rules.test.ts",
      // The pre-existing unrelated failures (steam, platform-lifecycle, etc.)
      // would otherwise raise noise in this report. We only care about the
      // trophy surface here.
      "tests/steam-achievement-summary.test.ts",
      "tests/platform-lifecycle-service.test.ts",
      "tests/platform-operation-reducer.test.ts",
      "tests/platform-sync-ux.test.tsx",
      "tests/add-game-modal.test.tsx",
      "tests/brand-icons.test.ts",
      "tests/epic-connect-modal.test.tsx",
      "tests/launcher-navigation.test.ts",
      // jsdom/undici WebSocket "event argument" error from an unrelated
      // prerelease smoke test; surfaces as an unhandled exception and
      // poisons the gate's exit code without indicating a trophy issue.
      "tests/app-whats-new.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage/trophies",
      include: TROPHY_INCLUDE,
      // 90% lines/funcs/stmts + 85% branches — locked-in decision (2026-08-31).
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
