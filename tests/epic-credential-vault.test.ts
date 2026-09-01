import { describe, expect, it, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  createEpicCredentialVault,
  VAULT_FILE_NAME,
  KEY_FILE_NAME,
} from "../electron/epic-credential-vault.cjs";

const validToken = (overrides: Record<string, unknown> = {}) => ({
  accessToken: "eg1~access-token-value",
  refreshToken: "eg1~refresh-token-value",
  accountId: "epic-account-123",
  displayName: "Tester",
  expiresAt: Date.now() + 60 * 60 * 1000,
  scope: "basic_profile",
  ...overrides,
});

describe("epic-credential-vault", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "epic-vault-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects missing userDataPath", () => {
    expect(() => createEpicCredentialVault({ userDataPath: "" as any })).toThrow(
      /usuario invalido/i,
    );
  });

  it("round-trips a token set", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    const read = vault.read();
    expect(read).not.toBeNull();
    expect(read?.accessToken).toBe("eg1~access-token-value");
    expect(read?.refreshToken).toBe("eg1~refresh-token-value");
    expect(read?.accountId).toBe("epic-account-123");
    expect(read?.displayName).toBe("Tester");
    expect(read?.scope).toBe("basic_profile");
  });

  it("writes a non-plaintext envelope on disk", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    const raw = fs.readFileSync(path.join(tempDir, VAULT_FILE_NAME), "utf8");
    expect(raw).not.toContain("eg1~access-token-value");
    expect(raw).not.toContain("eg1~refresh-token-value");
    const parsed = JSON.parse(raw);
    expect(parsed.v).toBe(1);
    expect(typeof parsed.iv).toBe("string");
    expect(typeof parsed.tag).toBe("string");
    expect(typeof parsed.data).toBe("string");
  });

  it("stores the master key with restrictive permissions", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    const stats = fs.statSync(path.join(tempDir, KEY_FILE_NAME));
    // On POSIX, the mode is meaningful. On Windows it may be 0o666 due to ACL semantics.
    if (process.platform !== "win32") {
      // Mask to permission bits only
      const mode = stats.mode & 0o777;
      expect(mode & 0o077).toBe(0);
    } else {
      expect(stats.size).toBe(32);
    }
  });

  it("rejects writing an invalid token set", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    expect(() => vault.write({} as any)).toThrow(/invalido/i);
    expect(() =>
      vault.write({
        accessToken: "ok",
        refreshToken: "ok",
        accountId: "",
      } as any),
    ).toThrow(/invalido/i);
  });

  it("returns null on missing vault file", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    expect(vault.read()).toBeNull();
    expect(vault.exists()).toBe(false);
  });

  it("returns null on corrupted envelope (bad base64)", () => {
    fs.writeFileSync(
      path.join(tempDir, VAULT_FILE_NAME),
      JSON.stringify({ v: 1, iv: "!!!", tag: "???", data: "@@@" }),
    );
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    expect(vault.read()).toBeNull();
  });

  it("returns null when envelope JSON is unparseable", () => {
    fs.writeFileSync(path.join(tempDir, VAULT_FILE_NAME), "not json {");
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    expect(vault.read()).toBeNull();
  });

  it("returns null on unsupported schema version", () => {
    fs.writeFileSync(
      path.join(tempDir, VAULT_FILE_NAME),
      JSON.stringify({ v: 999, iv: "AA", tag: "BB", data: "CC" }),
    );
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    expect(vault.read()).toBeNull();
  });

  it("rejects tampered ciphertext (auth tag mismatch)", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    const file = path.join(tempDir, VAULT_FILE_NAME);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    // Flip a bit in the data
    const dataBuf = Buffer.from(parsed.data, "base64");
    dataBuf[0] = dataBuf[0] ^ 0xff;
    parsed.data = dataBuf.toString("base64");
    fs.writeFileSync(file, JSON.stringify(parsed));
    const vault2 = createEpicCredentialVault({ userDataPath: tempDir });
    expect(vault2.read()).toBeNull();
  });

  it("uses a fresh IV on each write", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    const iv1 = JSON.parse(
      fs.readFileSync(path.join(tempDir, VAULT_FILE_NAME), "utf8"),
    ).iv;
    vault.write(validToken({ displayName: "Tester2" }));
    const iv2 = JSON.parse(
      fs.readFileSync(path.join(tempDir, VAULT_FILE_NAME), "utf8"),
    ).iv;
    expect(iv1).not.toBe(iv2);
  });

  it("regenerates the master key when the key file is missing but vault is present", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    fs.rmSync(path.join(tempDir, KEY_FILE_NAME));
    // Now reading should fail because the key is gone.
    expect(vault.read()).toBeNull();
    // Writing again should recreate a fresh key.
    vault.write(validToken({ displayName: "Recovered" }));
    const recovered = vault.read();
    expect(recovered?.displayName).toBe("Recovered");
  });

  it("clear() removes both files and the cached key", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken());
    expect(vault.exists()).toBe(true);
    vault.clear();
    expect(vault.exists()).toBe(false);
    expect(fs.existsSync(path.join(tempDir, VAULT_FILE_NAME))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, KEY_FILE_NAME))).toBe(false);
  });

  it("uses injectable random bytes for deterministic tests", () => {
    const sequence: number[][] = [];
    const fakeRandomBytes = (size: number) => {
      const buf = new Uint8Array(size);
      for (let i = 0; i < size; i += 1) buf[i] = (sequence.length + i) & 0xff;
      sequence.push(Array.from(buf));
      return buf;
    };
    const customCrypto = {
      ...crypto,
      createCipheriv: crypto.createCipheriv.bind(crypto),
      createDecipheriv: crypto.createDecipheriv.bind(crypto),
      randomBytes: (size: number) => Buffer.from(fakeRandomBytes(size)),
    } as any;
    const vault = createEpicCredentialVault({
      userDataPath: tempDir,
      crypto: customCrypto,
    });
    vault.write(validToken());
    const read = vault.read();
    expect(read?.accountId).toBe("epic-account-123");
  });

  it("exposes its paths for diagnostics", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    expect(vault.paths.vaultPath).toBe(path.join(tempDir, VAULT_FILE_NAME));
    expect(vault.paths.keyPath).toBe(path.join(tempDir, KEY_FILE_NAME));
  });

  it("treats expiresAt=0 as not-yet-known (still round-trips)", () => {
    const vault = createEpicCredentialVault({ userDataPath: tempDir });
    vault.write(validToken({ expiresAt: 0 }));
    expect(vault.read()?.expiresAt).toBe(0);
  });
});
