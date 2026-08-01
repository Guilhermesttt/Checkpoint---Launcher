import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { selectModGameDirectory } = require("../electron/mod-game-directory.cjs") as {
  selectModGameDirectory: (options: {
    dialog: { showOpenDialog: (parent: unknown, options: unknown) => Promise<{
      canceled: boolean;
      filePaths: string[];
    }> };
    parentWindow?: unknown;
    gameTitle?: string;
    fsImpl?: { promises: { stat: (path: string) => Promise<{ isDirectory: () => boolean }> } };
  }) => Promise<string | null>;
};

describe("seletor da pasta de mods", () => {
  it("abre o seletor de diretorio e devolve a pasta escolhida", async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ["C:\\Games\\Cyberpunk 2077"],
    });
    const folder = await selectModGameDirectory({
      dialog: { showOpenDialog },
      parentWindow: {},
      gameTitle: "Cyberpunk 2077",
      fsImpl: {
        promises: {
          stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
        },
      },
    });

    expect(folder).toBe("C:\\Games\\Cyberpunk 2077");
    expect(showOpenDialog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      properties: ["openDirectory"],
      buttonLabel: "Selecionar pasta",
    }));
  });

  it("nao altera a configuracao quando o usuario cancela", async () => {
    await expect(selectModGameDirectory({
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
      },
    })).resolves.toBeNull();
  });

});
