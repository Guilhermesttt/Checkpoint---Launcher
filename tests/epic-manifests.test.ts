import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  normalizeEpicManifest,
  searchInstalledEpicGames,
} = require("../electron/epic-manifests.cjs") as {
  normalizeEpicManifest: (value: Record<string, unknown>) => Record<string, string> | null;
  searchInstalledEpicGames: (query: string, programData: string) => Array<Record<string, string>>;
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) =>
    fs.rmSync(directory, { recursive: true, force: true }));
});

describe("manifests locais da Epic Games", () => {
  it("monta o identificador oficial e o executavel instalado", () => {
    const game = normalizeEpicManifest({
      DisplayName: "Fortnite",
      AppName: "Fortnite",
      NamespaceId: "fn",
      CatalogItemId: "catalog",
      InstallLocation: "C:\\Epic\\Fortnite",
      LaunchExecutable: "FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe",
    });

    expect(game).toMatchObject({
      id: "catalog",
      name: "Fortnite",
      epicLaunchId: "fn:catalog:Fortnite",
      executablePath: "C:\\Epic\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe",
    });
  });

  it("pesquisa os arquivos .item instalados sem depender do catalogo remoto", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "checkpoint-epic-"));
    temporaryDirectories.push(root);
    const manifests = path.join(root, "Epic", "EpicGamesLauncher", "Data", "Manifests");
    fs.mkdirSync(manifests, { recursive: true });
    fs.writeFileSync(path.join(manifests, "rocket.item"), JSON.stringify({
      DisplayName: "Rocket League",
      AppName: "Sugar",
      NamespaceId: "rocket",
      CatalogItemId: "league",
      InstallLocation: "D:\\Jogos\\RocketLeague",
      LaunchExecutable: "Binaries\\Win64\\RocketLeague.exe",
    }));

    expect(searchInstalledEpicGames("rocket", root)).toMatchObject([{
      name: "Rocket League",
      appName: "Sugar",
      epicLaunchId: "rocket:league:Sugar",
    }]);
  });

  it("funde nome e caminho do LauncherInstalled com o namespace do manifest", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "checkpoint-epic-"));
    temporaryDirectories.push(root);
    const manifests = path.join(root, "Epic", "EpicGamesLauncher", "Data", "Manifests");
    const installedDirectory = path.join(root, "Epic", "UnrealEngineLauncher");
    fs.mkdirSync(manifests, { recursive: true });
    fs.mkdirSync(installedDirectory, { recursive: true });
    fs.writeFileSync(path.join(manifests, "game.item"), JSON.stringify({
      AppName: "GameArtifact",
      NamespaceId: "game-namespace",
      CatalogItemId: "game-catalog",
    }));
    fs.writeFileSync(path.join(installedDirectory, "LauncherInstalled.dat"), JSON.stringify({
      InstallationList: [{
        DisplayName: "Meu Jogo",
        AppName: "GameArtifact",
        ItemId: "game-catalog",
        InstallLocation: "D:\\Epic\\MeuJogo",
        LaunchExecutable: "Binaries\\MeuJogo.exe",
      }],
    }));

    expect(searchInstalledEpicGames("meu jogo", root)).toMatchObject([{
      name: "Meu Jogo",
      namespace: "game-namespace",
      epicLaunchId: "game-namespace:game-catalog:GameArtifact",
      executablePath: "D:\\Epic\\MeuJogo\\Binaries\\MeuJogo.exe",
    }]);
  });
});
