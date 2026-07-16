// @vitest-environment jsdom
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectGamepadFamily,
  GamepadProvider,
  useGamepad,
  useGamepadButton,
} from "../src/context/GamepadContext";
import { setLauncherInputLocked } from "../src/utils/launcherInputLock";

let gamepads: Array<Gamepad | null> = [];
let nextFrame: FrameRequestCallback | null = null;

const makeGamepad = ({
  id = "DualSense Wireless Controller",
  pressed = [],
  axes = [0, 0, 0, 0],
}: {
  id?: string;
  pressed?: number[];
  axes?: number[];
} = {}): Gamepad => ({
  id,
  index: 0,
  connected: true,
  mapping: "standard",
  timestamp: 1,
  axes,
  buttons: Array.from({ length: 18 }, (_, index) => ({
    pressed: pressed.includes(index),
    touched: pressed.includes(index),
    value: pressed.includes(index) ? 1 : 0,
  })),
  vibrationActuator: null,
} as unknown as Gamepad);

const runFrame = () => {
  const callback = nextFrame;
  nextFrame = null;
  if (!callback) throw new Error("Polling do gamepad nao foi agendado.");
  act(() => callback(performance.now()));
};

beforeEach(() => {
  setLauncherInputLocked(false);
  Reflect.deleteProperty(window, "electronAPI");
  gamepads = [];
  nextFrame = null;
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: vi.fn(() => gamepads),
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(performance, "now").mockReturnValue(1000);
});

const Status = () => {
  const state = useGamepad();
  return <output>{`${state.isGamepadConnected}:${state.gamepadFamily}:${state.activeInputType}`}</output>;
};

describe("navegacao por gamepad", () => {
  it("classifica familias sem tratar controles genericos como Xbox", () => {
    expect(detectGamepadFamily("DualSense Wireless Controller")).toBe("playstation");
    expect(detectGamepadFamily("Xbox Wireless Controller")).toBe("xbox");
    expect(detectGamepadFamily("8BitDo Pro 2")).toBe("generic");
  });

  it("detecta um controle simulado e muda o metodo de entrada", () => {
    render(<GamepadProvider><Status /></GamepadProvider>);
    gamepads = [makeGamepad()];
    runFrame();
    expect(screen.getByText("true:playstation:mouse")).toBeInTheDocument();

    gamepads = [makeGamepad({ pressed: [0] })];
    runFrame();
    expect(screen.getByText("true:playstation:gamepad")).toBeInTheDocument();
  });

  it("entrega o botao somente para a camada de maior prioridade", () => {
    const pageAction = vi.fn();
    const modalAction = vi.fn();
    const Harness = () => {
      useGamepadButton("X", pageAction, true, 0);
      useGamepadButton("X", modalAction, true, 100);
      return null;
    };
    render(<GamepadProvider><Harness /></GamepadProvider>);
    gamepads = [makeGamepad({ pressed: [0] })];
    runFrame();
    expect(modalAction).toHaveBeenCalledOnce();
    expect(pageAction).not.toHaveBeenCalled();
  });

  it("converte analogico esquerdo em navegacao direcional", () => {
    const moveRight = vi.fn();
    const Harness = () => {
      useGamepadButton("DPAD_RIGHT", moveRight);
      return null;
    };
    render(<GamepadProvider><Harness /></GamepadProvider>);
    gamepads = [makeGamepad({ axes: [0.8, 0, 0, 0] })];
    runFrame();
    expect(moveRight).toHaveBeenCalledOnce();
  });

  it("ignora comandos enquanto a intro bloqueia a interface", () => {
    const action = vi.fn();
    const Harness = () => {
      useGamepadButton("X", action);
      return null;
    };
    render(<GamepadProvider><Harness /></GamepadProvider>);
    setLauncherInputLocked(true);
    gamepads = [makeGamepad({ pressed: [0] })];
    runFrame();
    expect(action).not.toHaveBeenCalled();
  });

  it("abre o overlay uma vez ao pressionar o botao central", () => {
    const toggleOverlayPanel = vi.fn().mockResolvedValue({ open: true });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { toggleOverlayPanel },
    });
    render(<GamepadProvider><Status /></GamepadProvider>);

    gamepads = [makeGamepad({ pressed: [16] })];
    runFrame();
    runFrame();

    expect(toggleOverlayPanel).toHaveBeenCalledOnce();
  });
});
