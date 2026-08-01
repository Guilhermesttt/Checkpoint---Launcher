import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  createWindowBehaviorController,
  resolveWindowCloseAction,
} = require("../electron/window-behavior.cjs");

describe("comportamento de fechamento da janela", () => {
  it.each([
    [{ isQuitting: true, minimizeToTray: true, confirmBeforeExit: true }, "quit"],
    [{ isQuitting: false, minimizeToTray: true, confirmBeforeExit: true }, "hide"],
    [{ isQuitting: false, minimizeToTray: false, confirmBeforeExit: true }, "confirm"],
    [{ isQuitting: false, minimizeToTray: false, confirmBeforeExit: false }, "quit"],
  ])("respeita a precedencia entre encerrar, ocultar e confirmar", (input, expected) => {
    expect(resolveWindowCloseAction(input)).toBe(expected);
  });

  it("nao deixa preferencias locais bloquearem um encerramento forcado", () => {
    expect(resolveWindowCloseAction({
      isQuitting: true,
      minimizeToTray: false,
      confirmBeforeExit: true,
    })).toBe("quit");
  });

  it("oculta o launcher quando a bandeja esta habilitada", () => {
    const effects: string[] = [];
    const controller = createWindowBehaviorController({
      hideWindow: () => effects.push("hide"),
      showWindow: () => effects.push("show"),
      requestConfirmation: () => effects.push("confirm"),
      quitApp: () => effects.push("quit"),
    });

    expect(controller.handleWindowClose(false)).toBe("hide");
    expect(effects).toEqual(["hide"]);
  });

  it("solicita confirmacao para saida explicita e encerra apenas apos confirmar", () => {
    const effects: string[] = [];
    const controller = createWindowBehaviorController({
      hideWindow: () => effects.push("hide"),
      showWindow: () => effects.push("show"),
      requestConfirmation: () => effects.push("confirm"),
      quitApp: () => effects.push("quit"),
    });
    controller.setBehavior({ minimizeToTray: true, confirmBeforeExit: true });

    expect(controller.requestAppQuit()).toEqual({ confirmationRequired: true });
    expect(effects).toEqual(["show", "confirm"]);

    controller.confirmAppQuit();
    expect(effects).toEqual(["show", "confirm", "quit"]);
  });
});
