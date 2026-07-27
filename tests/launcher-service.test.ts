// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Game } from "../src/types/domain";
import { launchGame } from "../src/services/launcher";

const localGame: Game = {
  id: "local-game",
  title: "Local Game",
  image: "",
  launcherType: "local",
  executablePath: "C:\\Games\\LocalGame.exe",
};

const setLaunchExecutable = () => {
  const launchExecutable = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: { launchExecutable },
  });
  return launchExecutable;
};

afterEach(() => {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: undefined,
  });
});

describe("game launcher service", () => {
  it("delega ao Electron a ocultacao do launcher", async () => {
    const launchExecutable = setLaunchExecutable();

    await launchGame(localGame, { hideLauncher: true });

    expect(launchExecutable).toHaveBeenCalledWith(
      localGame.executablePath,
      undefined,
      { hideLauncher: true },
    );
  });

  it("mantem a janela aberta quando a preferencia esta desativada", async () => {
    const launchExecutable = setLaunchExecutable();

    await launchGame(localGame, { hideLauncher: false });

    expect(launchExecutable).toHaveBeenCalledWith(
      localGame.executablePath,
      undefined,
      { hideLauncher: false },
    );
  });
});
