import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeLaunchProfile, parseArgumentString } = require("../electron/launch-profile.cjs") as {
  parseArgumentString: (value: string) => string[];
  normalizeLaunchProfile: (value: unknown, fallback: string) => {
    arguments: string[];
    workingDirectory: string;
    monitorId: number | null;
    windowMode: string;
    processPriority: string;
  };
};

describe("launch profile", () => {
  it("separa argumentos preservando valores entre aspas", () => {
    expect(parseArgumentString('-fullscreen -name "Gui Santos" --path="C:\\Games\\Save"')).toEqual([
      "-fullscreen",
      "-name",
      "Gui Santos",
      "--path=C:\\Games\\Save",
    ]);
  });

  it("normaliza valores desconhecidos sem aceitar cwd relativo", () => {
    expect(normalizeLaunchProfile({
      arguments: "--safe",
      workingDirectory: "relative/path",
      monitorId: "2",
      windowMode: "invalid",
      processPriority: "realtime",
    }, "C:\\Games")).toMatchObject({
      arguments: ["--safe"],
      workingDirectory: "C:\\Games",
      monitorId: 2,
      windowMode: "default",
      processPriority: "normal",
    });
  });

  it("mantem monitor automatico como null", () => {
    expect(normalizeLaunchProfile({ monitorId: null }, "C:\\Games").monitorId).toBeNull();
    expect(normalizeLaunchProfile({ monitorId: "" }, "C:\\Games").monitorId).toBeNull();
  });

  it("rejeita aspas sem fechamento", () => {
    expect(() => parseArgumentString('--name "checkpoint')).toThrow(/aspas/i);
  });
});
