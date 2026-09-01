import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { migrateEpicAccountMetadata } from "../electron/epic-credential-migration.cjs";
import { createEpicCredentialVault } from "../electron/epic-credential-vault.cjs";

const writeLegacy = (filePath: string, payload: Record<string, unknown>) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
};

describe("epic-credential-migration (metadata only)", () => {
  let tempDir: string;
  let userData: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let originalLocalAppData: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "epic-migration-test-"));
    userData = path.join(tempDir, "userData");
    fs.mkdirSync(userData, { recursive: true });
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    originalLocalAppData = process.env.LOCALAPPDATA;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = originalLocalAppData;
  });

  const setHome = (dir: string) => {
    process.env.HOME = dir;
    process.env.USERPROFILE = dir;
  };

  it("returns no-migration when there is no userDataPath", async () => {
    const result = await migrateEpicAccountMetadata({ userDataPath: "" });
    expect(result.migrated).toBe(false);
    expect(result.source).toBe("none");
  });

  it("skips when the vault already has tokens", async () => {
    const vaultPath = path.join(userData, "epic-vault.enc");
    const keyPath = path.join(userData, "epic-vault.key");
    fs.writeFileSync(vaultPath, "x");
    fs.writeFileSync(keyPath, "x");
    const result = await migrateEpicAccountMetadata({ userDataPath: userData });
    expect(result.migrated).toBe(false);
    expect(result.source).toBe("vault");
  });

  it("migrates account metadata from home .config/legendary", async () => {
    const legendaryDir = path.join(tempDir, "legendary-home");
    setHome(legendaryDir);
    delete process.env.LOCALAPPDATA;
    const legacyFile = path.join(legendaryDir, ".config", "legendary", "user.json");
    writeLegacy(legacyFile, {
      account_id: "epic-acc-1",
      display_name: "Legacy Gamer",
      access_token: "eg1~secret-do-not-touch",
      refresh_token: "eg1~refresh-do-not-touch",
    });

    const result = await migrateEpicAccountMetadata({ userDataPath: userData });
    expect(result.migrated).toBe(true);
    expect(result.source).toBe("user.json");
    expect(result.accountId).toBe("epic-acc-1");
    expect(result.displayName).toBe("Legacy Gamer");

    // Legendary user.json is preserved (Legendary still owns the tokens).
    expect(fs.existsSync(legacyFile)).toBe(true);

    const vault = createEpicCredentialVault({ userDataPath: userData });
    const read = vault.read();
    expect(read?.accountId).toBe("epic-acc-1");
    expect(read?.displayName).toBe("Legacy Gamer");
    expect(read?.accessToken).toBe("metadata-marker");
    expect(read?.expiresAt).toBe(0);
  });

  it("migrates from %LOCALAPPDATA% on Windows when HOME has no candidate", async () => {
    process.env.LOCALAPPDATA = path.join(tempDir, "LocalAppData");
    setHome(path.join(tempDir, "empty-home-no-candidate"));
    const legacyFile = path.join(
      process.env.LOCALAPPDATA,
      "legendary",
      "user.json",
    );
    writeLegacy(legacyFile, {
      account_id: "epic-acc-2",
      access_token: "eg1~local-appdata-access",
    });

    const result = await migrateEpicAccountMetadata({ userDataPath: userData });
    expect(result.migrated).toBe(true);
    expect(result.accountId).toBe("epic-acc-2");
  });

  it("returns no-migration when no candidate file is present", async () => {
    setHome(path.join(tempDir, "empty-home"));
    delete process.env.LOCALAPPDATA;
    const result = await migrateEpicAccountMetadata({ userDataPath: userData });
    expect(result.migrated).toBe(false);
    expect(result.source).toBe("none");
  });

  it("skips invalid legacy JSON without crashing", async () => {
    setHome(path.join(tempDir, "broken-home"));
    delete process.env.LOCALAPPDATA;
    const broken = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".config",
      "legendary",
      "user.json",
    );
    fs.mkdirSync(path.dirname(broken), { recursive: true });
    fs.writeFileSync(broken, "{ this is not json", "utf8");
    const result = await migrateEpicAccountMetadata({ userDataPath: userData });
    expect(result.migrated).toBe(false);
    expect(result.source).toBe("none");
  });

  it("skips legacy file when account_id is missing", async () => {
    setHome(path.join(tempDir, "no-id-home"));
    delete process.env.LOCALAPPDATA;
    const legacyFile = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".config",
      "legendary",
      "user.json",
    );
    writeLegacy(legacyFile, { access_token: "eg1~no-account-id" });
    const result = await migrateEpicAccountMetadata({ userDataPath: userData });
    expect(result.migrated).toBe(false);
    expect(result.source).toBe("none");
  });

  it("never stores the access token in the vault", async () => {
    setHome(path.join(tempDir, "log-home"));
    delete process.env.LOCALAPPDATA;
    const legacyFile = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".config",
      "legendary",
      "user.json",
    );
    writeLegacy(legacyFile, {
      account_id: "epic-acc-3",
      access_token: "eg1~super-secret-do-not-leak",
    });
    await migrateEpicAccountMetadata({ userDataPath: userData });
    const vault = createEpicCredentialVault({ userDataPath: userData });
    const read = vault.read();
    expect(read?.accessToken).not.toBe("eg1~super-secret-do-not-leak");
    expect(read?.accessToken).toBe("metadata-marker");
  });
});
