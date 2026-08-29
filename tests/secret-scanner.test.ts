import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { runSecretScan } from "../scripts/scan-secrets.cjs";

describe("secret-scanner", () => {
  it("detects forbidden tracked files like .env and private keys in working tree", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-scan-test-"));
    try {
      spawnSync("git", ["init"], { cwd: tempDir });
      spawnSync("git", ["config", "user.name", "Test"], { cwd: tempDir });
      spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir });

      fs.writeFileSync(path.join(tempDir, ".env"), "SECRET=true\n");
      spawnSync("git", ["add", ".env"], { cwd: tempDir });

      const result = runSecretScan(tempDir);
      expect(result.status).toBe(1);
      expect(result.findings.some((f: any) => f.ruleId === "FORBIDDEN_TRACKED_FILE")).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes when tracked files only contain safe placeholder values", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-scan-clean-"));
    try {
      spawnSync("git", ["init"], { cwd: tempDir });
      spawnSync("git", ["config", "user.name", "Test"], { cwd: tempDir });
      spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir });

      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        "OPENAI_API_KEY=your_openai_key_here\nDISCORD_CLIENT_SECRET=your_discord_secret_here\n",
      );
      spawnSync("git", ["add", ".env.example"], { cwd: tempDir });
      spawnSync("git", ["commit", "-m", "initial"], { cwd: tempDir });

      const result = runSecretScan(tempDir);
      expect(result.status).toBe(0);
      expect(result.findings).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
