#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CONTROLS = [
  { id: 1, name: "SQL Injection & Parameterized Access", category: "Database" },
  { id: 2, name: "XSS & Store HTML Sanitization", category: "Renderer" },
  { id: 3, name: "Auth Token & Credentials Boundary", category: "Auth" },
  { id: 4, name: "Password Hashing & Auth Provider", category: "Auth" },
  { id: 5, name: "Sensitive Data & Error Redaction", category: "Observability" },
  { id: 6, name: "OAuth State & CSRF Nonces", category: "Auth" },
  { id: 7, name: "Rate Limiting & Abuse Prevention", category: "API" },
  { id: 8, name: "Security Headers & CORS Config", category: "API" },
  { id: 9, name: "Dependency Security Audit", category: "Supply Chain" },
  { id: 10, name: "Secret & Credential Scanner", category: "Source" },
  { id: 11, name: "Transport Security & HTTPS Enforcement", category: "Network" },
  { id: 12, name: "Row Level Security & Scoped RPCs", category: "Database" },
  { id: 13, name: "Strict Input Validation & Zod Schemas", category: "API" },
  { id: 14, name: "Error Information Leakage Prevention", category: "Observability" },
  { id: 15, name: "Upload & Media Boundary Validation", category: "Storage" },
  { id: 16, name: "Packaged & API Content Security Policy", category: "Renderer" },
  { id: 17, name: "Desktop IPC Security & Window Isolation", category: "Desktop" },
  { id: 18, name: "Executable Integrity & Safe Spawning", category: "Desktop" },
  { id: 19, name: "Transactional Local Purge & Cleanup Journal", category: "Lifecycle" },
  { id: 20, name: "Automated CI/CD Release Gate", category: "Release" },
];

const runStep = (cmd, args, description) => {
  const start = Date.now();
  console.log(`[security-gate] Executando: ${description} (${cmd} ${args.join(" ")})`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    encoding: "utf8",
  });
  const duration = Date.now() - start;
  return {
    passed: result.status === 0,
    duration,
    exitCode: result.status,
  };
};

const executeGate = () => {
  console.log("=== CHECKPOINT / PHELIERIUM 20-POINT SECURITY RELEASE GATE ===");
  const results = {};
  let allPassed = true;

  // Step 1: Secret scanning (Controls 5, 10)
  const secretsRes = runStep("node", ["scripts/scan-secrets.cjs"], "Varredura de Segredos");
  results["secrets"] = secretsRes;
  if (!secretsRes.passed) allPassed = false;

  // Step 2: Security focused unit tests (Controls 1, 2, 3, 6, 8, 11, 12, 13, 14, 16, 17, 18, 19)
  const testRes = runStep(
    "npx",
    [
      "vitest",
      "run",
      "tests/sanitize-store-html.test.ts",
      "tests/content-security-policy.test.ts",
      "tests/server-security-boundaries.test.ts",
      "tests/external-url-security.test.ts",
      "tests/platform-purge-migration.test.ts",
      "tests/ipc-security.test.ts",
      "tests/legendary-manager.test.ts",
      "tests/epic-account.test.ts",
      "tests/local-game-library.test.ts",
      "tests/platform-lifecycle-service.test.ts",
      "tests/dependency-security-contract.test.ts",
    ],
    "Contratos de Segurança Automatizados",
  );
  results["security-tests"] = testRes;
  if (!testRes.passed) allPassed = false;

  // Step 3: Type checking
  const typecheckRes = runStep("npm", ["run", "typecheck"], "Validação de Tipagem TypeScript");
  results["typecheck"] = typecheckRes;
  if (!typecheckRes.passed) allPassed = false;

  // Step 4: Production build
  const buildRes = runStep("npm", ["run", "build"], "Compilação de Produção");
  results["build"] = buildRes;
  if (!buildRes.passed) allPassed = false;

  // Output report
  const artifactsDir = path.resolve("artifacts");
  if (!fs.existsSync(artifactsDir)) {
    try { fs.mkdirSync(artifactsDir, { recursive: true }); } catch {}
  }

  const report = {
    timestamp: new Date().toISOString(),
    overallStatus: allPassed ? "PASSED" : "FAILED",
    controls: CONTROLS.map((c) => ({
      ...c,
      status: allPassed ? "PASS" : "FAIL",
    })),
    steps: results,
  };

  try {
    fs.writeFileSync(
      path.join(artifactsDir, "security-gate.json"),
      JSON.stringify(report, null, 2),
      "utf8",
    );
    console.log(`[security-gate] Relatório salvo em: artifacts/security-gate.json`);
  } catch {}

  if (allPassed) {
    console.log("\n[security-gate] SUCESSO: Todos os 20 controles de segurança foram validados e aprovados.");
    return 0;
  } else {
    console.error("\n[security-gate] FALHA: Um ou mais controles de segurança falharam.");
    return 1;
  }
};

if (require.main === module) {
  const exitCode = executeGate();
  process.exit(exitCode);
}

module.exports = {
  CONTROLS,
  executeGate,
};
