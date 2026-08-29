import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { EventEmitter } from "node:events";
import {
  createLegendaryManager,
  LEGENDARY_VERSION,
  LEGENDARY_DOWNLOAD_URL,
  LEGENDARY_SHA256,
  LEGENDARY_ASSET_SIZE,
} from "../electron/legendary-manager.cjs";

describe("legendary-manager", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "legendary-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("exposes expected constants", () => {
    expect(LEGENDARY_VERSION).toBe("0.21.0");
    expect(LEGENDARY_DOWNLOAD_URL).toContain("0.21.0/legendary_windows_x64.exe");
    expect(LEGENDARY_SHA256).toBe("4c01a14c0acb0c46069b197ae7212ea4ea6b861661126ca0593cdac31658fb01");
    expect(LEGENDARY_ASSET_SIZE).toBe(17610944);
  });

  it("installs only the pinned artifact after hash verification", async () => {
    const fakeValidBinary = Buffer.from("pinned-legendary-executable-content-0.21.0");
    const fakeSha = crypto.createHash("sha256").update(fakeValidBinary).digest("hex");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeValidBinary,
    });

    const manager = createLegendaryManager({
      userDataPath: tempDir,
      fetchImpl,
      expectedSha256: fakeSha,
      expectedAssetSize: fakeValidBinary.length,
    });

    const installedPath = await manager.ensureInstalled();
    expect(installedPath).toBe(
      path.join(tempDir, "tools", "legendary", "0.21.0", "legendary.exe"),
    );
    expect(fs.readFileSync(installedPath)).toEqual(fakeValidBinary);
  });

  it("rejects a tampered artifact and preserves the verified executable", async () => {
    const validBuf = Buffer.from("verified-valid-binary-content-12345");
    const validSha = crypto.createHash("sha256").update(validBuf).digest("hex");
    const installedPath = path.join(tempDir, "tools", "legendary", "0.21.0", "legendary.exe");
    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.writeFileSync(installedPath, validBuf);

    const tamperedBuf = Buffer.from("tampered-corrupted-binary-content-999");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => tamperedBuf,
    });

    const manager = createLegendaryManager({
      userDataPath: tempDir,
      fetchImpl,
      expectedSha256: validSha,
      expectedAssetSize: validBuf.length,
    });

    await expect(manager.ensureInstalled({ force: true })).rejects.toThrow(
      "Falha na verificacao do Legendary.",
    );
    expect(fs.readFileSync(installedPath)).toEqual(validBuf);
  });

  it("uses the verified fixed path without a shell", async () => {
    const validBuf = Buffer.from("valid-bin");
    const validSha = crypto.createHash("sha256").update(validBuf).digest("hex");
    const installedPath = path.join(tempDir, "tools", "legendary", "0.21.0", "legendary.exe");
    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.writeFileSync(installedPath, validBuf);

    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = vi.fn();

    const spawnImpl = vi.fn().mockImplementation(() => {
      process.nextTick(() => {
        mockChild.stdout.emit("data", Buffer.from('{"status":"ok"}'));
        mockChild.emit("close", 0);
      });
      return mockChild;
    });

    const manager = createLegendaryManager({
      userDataPath: tempDir,
      spawnImpl,
      expectedSha256: validSha,
      expectedAssetSize: validBuf.length,
    });

    const output = await manager.run(["list-games", "--json"]);
    expect(output).toBe('{"status":"ok"}');
    expect(spawnImpl).toHaveBeenCalledWith(
      installedPath,
      ["list-games", "--json"],
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
  });

  it("rejects invalid arguments", async () => {
    const validBuf = Buffer.from("valid-bin");
    const validSha = crypto.createHash("sha256").update(validBuf).digest("hex");
    const installedPath = path.join(tempDir, "tools", "legendary", "0.21.0", "legendary.exe");
    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.writeFileSync(installedPath, validBuf);

    const manager = createLegendaryManager({
      userDataPath: tempDir,
      expectedSha256: validSha,
      expectedAssetSize: validBuf.length,
    });

    await expect(manager.run([])).rejects.toThrow("Argumentos invalidos para o Legendary.");
    await expect(manager.run(["a".repeat(4097)])).rejects.toThrow("Argumentos invalidos para o Legendary.");
    await expect(manager.run(["cmd\x00inject"])).rejects.toThrow("Argumentos invalidos para o Legendary.");
  });

  it("terminates oversized output", async () => {
    const validBuf = Buffer.from("valid-bin");
    const validSha = crypto.createHash("sha256").update(validBuf).digest("hex");
    const installedPath = path.join(tempDir, "tools", "legendary", "0.21.0", "legendary.exe");
    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.writeFileSync(installedPath, validBuf);

    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = vi.fn();

    const spawnImpl = vi.fn().mockImplementation(() => {
      process.nextTick(() => {
        // Emit 2.5 MiB
        mockChild.stdout.emit("data", Buffer.alloc(2.5 * 1024 * 1024, 0x61));
      });
      return mockChild;
    });

    const manager = createLegendaryManager({
      userDataPath: tempDir,
      spawnImpl,
      expectedSha256: validSha,
      expectedAssetSize: validBuf.length,
    });

    await expect(manager.run(["list-games"])).rejects.toThrow(/excedeu o limite/);
    expect(mockChild.kill).toHaveBeenCalled();
  });

  it("terminates on timeout", async () => {
    const validBuf = Buffer.from("valid-bin");
    const validSha = crypto.createHash("sha256").update(validBuf).digest("hex");
    const installedPath = path.join(tempDir, "tools", "legendary", "0.21.0", "legendary.exe");
    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.writeFileSync(installedPath, validBuf);

    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = vi.fn();

    const spawnImpl = vi.fn().mockReturnValue(mockChild);

    const manager = createLegendaryManager({
      userDataPath: tempDir,
      spawnImpl,
      expectedSha256: validSha,
      expectedAssetSize: validBuf.length,
    });

    await expect(manager.run(["list-games"], { timeoutMs: 50 })).rejects.toThrow(
      "Tempo limite atingido para o Legendary.",
    );
    expect(mockChild.kill).toHaveBeenCalled();
  });
});
