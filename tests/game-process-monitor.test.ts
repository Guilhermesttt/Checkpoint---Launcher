import { describe, expect, it } from "vitest";

interface ProcessRecord {
  pid: number;
  parentPid: number;
  name: string;
  executablePath: string;
}

interface TrackerResult {
  status: "starting" | "running" | "transition" | "finished";
  activeExecutablePath: string;
  adopted: boolean;
}

interface Tracker {
  observe: (processes: ProcessRecord[], now?: number) => TrackerResult;
}

const {
  createGameProcessTracker,
  isLikelyHelper,
  isLikelyLauncher,
  parseProcessSnapshot,
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = require("../electron/game-process-monitor.cjs") as {
  createGameProcessTracker: (options: {
    targetPath: string;
    rootPid?: number;
    baselineProcesses?: ProcessRecord[];
    startedAt?: number;
    startupTimeoutMs?: number;
    transitionGraceMs?: number;
    absenceThreshold?: number;
    replacementStableObservations?: number;
  }) => Tracker;
  isLikelyHelper: (name: string) => boolean;
  isLikelyLauncher: (name: string) => boolean;
  parseProcessSnapshot: (value: string) => ProcessRecord[];
};

const processRecord = (
  pid: number,
  parentPid: number,
  executablePath: string,
): ProcessRecord => ({
  pid,
  parentPid,
  name: executablePath.split(/[\\/]/).at(-1) || "",
  executablePath,
});

describe("game process monitor", () => {
  it("encerra um executavel direto somente apos ausencias consecutivas", () => {
    const target = "C:\\Games\\Checkpoint\\Checkpoint.exe";
    const tracker = createGameProcessTracker({
      targetPath: target,
      rootPid: 101,
      startedAt: 0,
      absenceThreshold: 3,
    });

    expect(tracker.observe([processRecord(101, 1, target)], 0).status).toBe("running");
    expect(tracker.observe([], 100).status).toBe("transition");
    expect(tracker.observe([], 200).status).toBe("transition");
    expect(tracker.observe([], 300).status).toBe("finished");
  });

  it("adota o jogo filho e ignora o launcher que continua aberto", () => {
    const launcher = "C:\\Games\\Resident Evil 4\\Launcher.exe";
    const game = "C:\\Games\\Resident Evil 4\\Binaries\\Win64\\re4.exe";
    const tracker = createGameProcessTracker({
      targetPath: launcher,
      rootPid: 201,
      baselineProcesses: [],
      startedAt: 0,
      replacementStableObservations: 2,
      absenceThreshold: 3,
    });
    const running = [
      processRecord(201, 1, launcher),
      processRecord(202, 201, game),
    ];

    expect(tracker.observe(running, 0)).toMatchObject({ status: "running", adopted: false });
    expect(tracker.observe(running, 100)).toMatchObject({
      status: "running",
      adopted: true,
      activeExecutablePath: game.toLowerCase(),
    });
    expect(tracker.observe([processRecord(202, 201, game)], 200).status).toBe("running");

    const lingeringLauncher = [processRecord(201, 1, launcher)];
    expect(tracker.observe(lingeringLauncher, 300).status).toBe("transition");
    expect(tracker.observe(lingeringLauncher, 400).status).toBe("transition");
    expect(tracker.observe(lingeringLauncher, 500).status).toBe("finished");
  });

  it("encontra o jogo novo no mesmo diretorio mesmo sem vinculo de pai", () => {
    const launcher = "C:\\Games\\Indie\\GameLauncher.exe";
    const game = "C:\\Games\\Indie\\Bin\\IndieGame.exe";
    const baseline = [processRecord(50, 1, "C:\\Games\\Indie\\tools.exe")];
    const tracker = createGameProcessTracker({
      targetPath: launcher,
      rootPid: 301,
      baselineProcesses: baseline,
      startedAt: 0,
      replacementStableObservations: 2,
    });
    const snapshot = [
      ...baseline,
      processRecord(301, 1, launcher),
      processRecord(302, 999, game),
    ];

    expect(tracker.observe(snapshot, 0).adopted).toBe(false);
    expect(tracker.observe(snapshot, 100)).toMatchObject({
      status: "running",
      adopted: true,
      activeExecutablePath: game.toLowerCase(),
    });
  });

  it("acompanha filho elevado mesmo quando o Windows oculta o caminho", () => {
    const launcher = "C:\\Games\\Secure\\Launcher.exe";
    const elevatedGame: ProcessRecord = {
      pid: 352,
      parentPid: 351,
      name: "SecureGame.exe",
      executablePath: "",
    };
    const tracker = createGameProcessTracker({
      targetPath: launcher,
      rootPid: 351,
      startedAt: 0,
      replacementStableObservations: 2,
    });
    const snapshot = [processRecord(351, 1, launcher), elevatedGame];

    expect(tracker.observe(snapshot, 0).adopted).toBe(false);
    expect(tracker.observe(snapshot, 100)).toMatchObject({
      status: "running",
      adopted: true,
      activeExecutablePath: launcher.toLowerCase(),
    });
    expect(tracker.observe([elevatedGame], 200).status).toBe("running");
  });

  it("nao adota crash reporter e aplica timeout a launchers sem jogo", () => {
    const launcher = "C:\\Games\\Example\\GameLauncher.exe";
    const reporter = "C:\\Games\\Example\\CrashReporter.exe";
    const tracker = createGameProcessTracker({
      targetPath: launcher,
      rootPid: 401,
      startedAt: 0,
      startupTimeoutMs: 1_000,
    });

    expect(isLikelyLauncher("GameLauncher.exe")).toBe(true);
    expect(isLikelyHelper("CrashReporter.exe")).toBe(true);
    expect(tracker.observe([
      processRecord(401, 1, launcher),
      processRecord(402, 401, reporter),
    ], 999).status).toBe("running");
    expect(tracker.observe([
      processRecord(401, 1, launcher),
      processRecord(402, 401, reporter),
    ], 1_000)).toMatchObject({ status: "finished", adopted: false });
  });

  it("interpreta snapshots PowerShell com um ou varios processos", () => {
    expect(parseProcessSnapshot(JSON.stringify({
      pid: 7,
      parentPid: 1,
      name: "Game.exe",
      executablePath: "C:\\Games\\Game.exe",
    }))).toEqual([
      processRecord(7, 1, "C:\\Games\\Game.exe"),
    ].map((record) => ({
      ...record,
      name: record.name.toLowerCase(),
      executablePath: record.executablePath.toLowerCase(),
    })));

    expect(parseProcessSnapshot("[]")).toEqual([]);
  });
});
