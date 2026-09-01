import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createEpicCredentialVault } from "../electron/epic-credential-vault.cjs";
import { createEpicSession } from "../electron/epic-session.cjs";

const validToken = (overrides: Record<string, unknown> = {}) => ({
  accessToken: "eg1~access-token-value",
  refreshToken: "eg1~refresh-token-value",
  accountId: "epic-account-123",
  displayName: "Tester",
  expiresAt: Date.now() + 60 * 60 * 1000,
  scope: "basic_profile",
  ...overrides,
});

const buildLegendary = (overrides: Partial<{ run: any; logout: any }> = {}) => ({
  run: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("epic-session", () => {
  let tempDir: string;
  let vault: ReturnType<typeof createEpicCredentialVault>;
  let now: number;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "epic-session-test-"));
    vault = createEpicCredentialVault({ userDataPath: tempDir });
    now = Date.now();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects missing vault or legendary", () => {
    expect(() =>
      createEpicSession({ vault: undefined as any, legendary: buildLegendary() as any }),
    ).toThrow(/vault/i);
    expect(() =>
      createEpicSession({ vault, legendary: undefined as any }),
    ).toThrow(/legendary/i);
  });

  it("get() returns null when vault is empty", async () => {
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    expect(await session.get()).toBeNull();
  });

  it("get() returns stored token when not close to expiry", async () => {
    vault.write(validToken({ expiresAt: now + 60 * 60 * 1000 }));
    const legendary = buildLegendary();
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.get();
    expect(result?.accessToken).toBe("eg1~access-token-value");
    expect(legendary.run).not.toHaveBeenCalled();
  });

  it("get() refreshes proactively within the lead window", async () => {
    vault.write(validToken({ expiresAt: now + 60 * 1000 })); // 1 min from now (inside 5 min lead)
    const legendary = buildLegendary({
      run: vi.fn().mockResolvedValue(
        JSON.stringify({ account_id: "epic-account-123", display_name: "Tester" }) + "eg1~refreshed",
      ),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.get();
    expect(legendary.run).toHaveBeenCalledWith([
      "auth",
      "--refresh-token",
      "eg1~refresh-token-value",
      "-y",
    ]);
    expect(result?.expiresAt).toBeGreaterThan(now);
  });

  it("get() forces refresh when expiresAt is zero (unknown)", async () => {
    vault.write(validToken({ expiresAt: 0 }));
    const legendary = buildLegendary({
      run: vi.fn().mockResolvedValue('"account_id":"a","display_name":"b"eg1~x'),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    await session.get();
    expect(legendary.run).toHaveBeenCalled();
  });

  it("get() returns the stale token if refresh fails (does not throw)", async () => {
    vault.write(validToken({ expiresAt: 0 }));
    const legendary = buildLegendary({
      run: vi.fn().mockRejectedValue(new Error("network down")),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.get();
    expect(result?.accessToken).toBe("eg1~access-token-value");
  });

  it("validate() reports missing when vault is empty", async () => {
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    const result = await session.validate();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing");
  });

  it("validate() reports valid when token is fresh", async () => {
    vault.write(validToken({ expiresAt: now + 60 * 60 * 1000 }));
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    const result = await session.validate();
    expect(result.valid).toBe(true);
  });

  it("validate() refreshes when expiring soon and reports valid on success", async () => {
    vault.write(validToken({ expiresAt: now + 60 * 1000 }));
    const legendary = buildLegendary({
      run: vi.fn().mockResolvedValue('"account_id":"a","display_name":"b"eg1~x'),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.validate();
    expect(result.valid).toBe(true);
    expect(legendary.run).toHaveBeenCalled();
  });

  it("validate() reports network on refresh failure", async () => {
    vault.write(validToken({ expiresAt: 0 }));
    const legendary = buildLegendary({
      run: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.validate();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("network");
  });

  it("refresh() throws when there is no stored token", async () => {
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    await expect(session.refresh()).rejects.toThrow(/nenhum token/i);
  });

  it("refresh() calls Legendary and persists the new set", async () => {
    vault.write(validToken({ expiresAt: now + 60 * 1000 }));
    const legendary = buildLegendary({
      run: vi.fn().mockResolvedValue('"account_id":"epic-account-123","display_name":"Tester"eg1~new-access'),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.refresh();
    expect(result.accessToken).toBe(
      '"account_id":"epic-account-123","display_name":"Tester"eg1~new-access',
    );
    expect(vault.read()?.accessToken).toBe(result.accessToken);
  });

  it("setFromAuthCode() rejects too-short codes", async () => {
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    await expect(session.setFromAuthCode("short")).rejects.toThrow(/invalido/i);
  });

  it("setFromAuthCode() stores the new token set", async () => {
    const legendary = buildLegendary({
      run: vi.fn().mockResolvedValue('"account_id":"acc","display_name":"New"eg1~new'),
    });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    const result = await session.setFromAuthCode("valid-code-12345");
    expect(result.accessToken).toContain("eg1~new");
    expect(vault.read()?.accessToken).toBe(result.accessToken);
  });

  it("clear() wipes the vault and calls legendary.logout", async () => {
    vault.write(validToken());
    const legendary = buildLegendary();
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    await session.clear();
    expect(vault.exists()).toBe(false);
    expect(legendary.logout).toHaveBeenCalled();
  });

  it("clear() does not throw if legendary.logout rejects", async () => {
    vault.write(validToken());
    const legendary = buildLegendary({ logout: vi.fn().mockRejectedValue(new Error("x")) });
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
    });
    await expect(session.clear()).resolves.toBeUndefined();
    expect(vault.exists()).toBe(false);
  });

  it("getAccountSummary() returns null on empty vault", async () => {
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    expect(await session.getAccountSummary()).toBeNull();
  });

  it("getAccountSummary() returns account metadata", async () => {
    vault.write(validToken());
    const session = createEpicSession({
      vault,
      legendary: buildLegendary() as any,
      now: () => now,
    });
    const summary = await session.getAccountSummary();
    expect(summary).toEqual({ accountId: "epic-account-123", displayName: "Tester" });
  });

  it("does not log tokens when logger is provided", async () => {
    vault.write(validToken({ expiresAt: 0 }));
    const legendary = buildLegendary({
      run: vi.fn().mockRejectedValue(new Error("boom contains eg1~access-token-value")),
    });
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const session = createEpicSession({
      vault,
      legendary: legendary as any,
      now: () => now,
      logger,
    });
    await session.get();
    // logger.warn was called but should NOT contain the token value
    const calls = logger.warn.mock.calls.flat().join(" ");
    expect(calls).not.toContain("eg1~access-token-value");
  });
});
