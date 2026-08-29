#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SECRET_PATTERNS = [
  {
    id: "PRIVATE_KEY_PEM",
    regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  },
  {
    id: "OPENAI_API_KEY",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: "GITHUB_TOKEN",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/,
  },
  {
    id: "GENERIC_API_SECRET",
    regex: /(?:client_secret|api_key|service_role_key|secret_key)\s*[:=]\s*["']([A-Za-z0-9_-]{24,})["']/i,
  },
];

const IGNORED_PLACEHOLDERS = [
  "example",
  "replace_me",
  "your_",
  "placeholder",
  "sample",
  "dummy",
  "test_token",
  "mock",
  "00000000",
  "12345678",
  "supabase_service_role",
];

const isSafePlaceholder = (text) => {
  const lower = text.toLowerCase();
  return IGNORED_PLACEHOLDERS.some((p) => lower.includes(p));
};

const scanWorkingTree = (cwd = process.cwd()) => {
  const findings = [];

  // Check for forbidden tracked files
  const gitFilesRes = spawnSync("git", ["ls-files"], {
    cwd,
    encoding: "utf8",
  });

  if (gitFilesRes.status !== 0) {
    throw new Error(`git ls-files failed: ${gitFilesRes.stderr}`);
  }

  const trackedFiles = gitFilesRes.stdout.split("\n").map((f) => f.trim()).filter(Boolean);

  for (const file of trackedFiles) {
    const base = path.basename(file);
    if (
      base === ".env" ||
      base === ".env.local" ||
      base === ".env.production" ||
      (base.startsWith(".env.") && base !== ".env.example") ||
      file.endsWith(".pem") ||
      file.endsWith(".key") ||
      file.endsWith(".p12")
    ) {
      findings.push({
        ruleId: "FORBIDDEN_TRACKED_FILE",
        file,
        line: 1,
      });
    }
  }

  // Scan file contents for secret patterns
  for (const file of trackedFiles) {
    if (file === "scripts/scan-secrets.cjs" || file.startsWith("tests/secret-scanner.test")) {
      continue;
    }
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue; // binary file
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isSafePlaceholder(line)) continue;

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            ruleId: pattern.id,
            file,
            line: i + 1,
          });
        }
      }
    }
  }

  return findings;
};

const scanGitHistory = (cwd = process.cwd()) => {
  const findings = [];
  const logRes = spawnSync(
    "git",
    ["log", "-p", "-n", "100", "--no-ext-diff", "--text"],
    { cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );

  if (logRes.status !== 0) {
    return findings; // not a git repo or no commits
  }

  const logLines = logRes.stdout.split("\n");
  let currentCommit = "HEAD";
  let currentFile = "";

  for (const line of logLines) {
    if (line.startsWith("commit ")) {
      currentCommit = line.slice(7, 15);
    } else if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      const content = line.slice(1);
      if (
        currentFile === "scripts/scan-secrets.cjs" ||
        currentFile.startsWith("tests/secret-scanner.test") ||
        isSafePlaceholder(content)
      ) {
        continue;
      }

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(content)) {
          findings.push({
            ruleId: `HISTORICAL_${pattern.id}`,
            commit: currentCommit,
            file: currentFile,
          });
        }
      }
    }
  }

  return findings;
};

const runSecretScan = (cwd = process.cwd()) => {
  try {
    const treeFindings = scanWorkingTree(cwd);
    const historyFindings = scanGitHistory(cwd);
    const allFindings = [...treeFindings, ...historyFindings];

    if (allFindings.length === 0) {
      console.log("[scan-secrets] Nenhuma credencial ou arquivo restrito detectado.");
      return { status: 0, findings: [] };
    }

    console.error(`[scan-secrets] ALERTA: ${allFindings.length} vulnerabilidade(s) de credenciais encontrada(s):`);
    for (const f of allFindings) {
      if (f.commit) {
        console.error(`  - [${f.ruleId}] Commit ${f.commit} (${f.file})`);
      } else {
        console.error(`  - [${f.ruleId}] ${f.file}:${f.line}`);
      }
    }

    return { status: 1, findings: allFindings };
  } catch (err) {
    console.error("[scan-secrets] Erro ao executar scanner:", err);
    return { status: 2, findings: [] };
  }
};

if (require.main === module) {
  const result = runSecretScan();
  process.exit(result.status);
}

module.exports = {
  runSecretScan,
  scanWorkingTree,
  scanGitHistory,
};
