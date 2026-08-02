// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type GamepadActions = {
  togglePanel: ReturnType<typeof vi.fn>;
  moveFocus: ReturnType<typeof vi.fn>;
  activateFocus: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  switchTab: ReturnType<typeof vi.fn>;
  spotifyTrack: ReturnType<typeof vi.fn>;
  onGamepadInput: ReturnType<typeof vi.fn>;
};

type OverlayController = { start: () => void; stop: () => void };
type ControllerFactory = (options: {
  getGamepads: () => Array<Gamepad | null>;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  now: () => number;
  isPanelOpen: () => boolean;
  isSpotifyActive: () => boolean;
  actions: GamepadActions;
}) => OverlayController;

const makeGamepad = ({
  pressed = [],
  axes = [0, 0, 0, 0],
}: {
  pressed?: number[];
  axes?: number[];
} = {}) => ({
  id: "Xbox Wireless Controller",
  index: 0,
  connected: true,
  mapping: "standard",
  timestamp: 0,
  axes,
  buttons: Array.from({ length: 17 }, (_, index) => ({
    pressed: pressed.includes(index),
    touched: pressed.includes(index),
    value: pressed.includes(index) ? 1 : 0,
  })),
  vibrationActuator: null,
} as unknown as Gamepad);

describe("motor de gamepad do overlay", () => {
  let createController: ControllerFactory;
  let gamepads: Array<Gamepad | null>;
  let nextFrame: FrameRequestCallback | null;
  let panelOpen: boolean;
  let spotifyActive: boolean;
  let currentTime: number;
  let actions: GamepadActions;

  beforeEach(() => {
    const source = fs.readFileSync(path.resolve("electron/overlay-gamepad.js"), "utf8");
    window.eval(source);
    createController = (window as unknown as { createOverlayGamepadController: ControllerFactory })
      .createOverlayGamepadController;
    gamepads = [];
    nextFrame = null;
    panelOpen = false;
    spotifyActive = false;
    currentTime = 1_000;
    actions = {
      togglePanel: vi.fn(),
      moveFocus: vi.fn(),
      activateFocus: vi.fn(),
      goBack: vi.fn(),
      switchTab: vi.fn(),
      spotifyTrack: vi.fn(),
      onGamepadInput: vi.fn(),
    };
  });

  const start = () => createController({
    getGamepads: () => gamepads,
    requestFrame: (callback) => {
      nextFrame = callback;
      return 1;
    },
    cancelFrame: vi.fn(),
    now: () => currentTime,
    isPanelOpen: () => panelOpen,
    isSpotifyActive: () => spotifyActive,
    actions,
  }).start();

  const runFrame = () => {
    const callback = nextFrame;
    nextFrame = null;
    if (!callback) throw new Error("Polling do overlay nao foi agendado.");
    callback(currentTime);
  };

  it("alterna o painel apenas uma vez enquanto Guide permanece pressionado", () => {
    start();
    gamepads = [makeGamepad({ pressed: [16] })];
    runFrame();
    runFrame();

    expect(actions.togglePanel).toHaveBeenCalledOnce();
  });

  it("aceita View e Menu juntos como fallback do botao central", () => {
    start();
    gamepads = [makeGamepad({ pressed: [8, 9] })];
    runFrame();

    expect(actions.togglePanel).toHaveBeenCalledOnce();
  });

  it("ignora navegacao quando o painel esta fechado", () => {
    start();
    gamepads = [makeGamepad({ pressed: [12, 0, 5, 7] })];
    runFrame();

    expect(actions.moveFocus).not.toHaveBeenCalled();
    expect(actions.activateFocus).not.toHaveBeenCalled();
    expect(actions.switchTab).not.toHaveBeenCalled();
    expect(actions.spotifyTrack).not.toHaveBeenCalled();
  });

  it("mapeia direcional, confirmacao, retorno e troca de abas com o painel aberto", () => {
    panelOpen = true;
    start();

    for (const [button, assertion] of [
      [15, () => expect(actions.moveFocus).toHaveBeenLastCalledWith("right")],
      [0, () => expect(actions.activateFocus).toHaveBeenCalledOnce()],
      [1, () => expect(actions.goBack).toHaveBeenCalledOnce()],
      [4, () => expect(actions.switchTab).toHaveBeenLastCalledWith(-1)],
      [5, () => expect(actions.switchTab).toHaveBeenLastCalledWith(1)],
    ] as const) {
      gamepads = [makeGamepad({ pressed: [button] })];
      runFrame();
      assertion();
      gamepads = [makeGamepad()];
      runFrame();
      currentTime += 200;
    }
  });

  it("usa o analogico esquerdo como direcional com repeticao controlada", () => {
    panelOpen = true;
    start();
    gamepads = [makeGamepad({ axes: [0, 0.8, 0, 0] })];
    runFrame();
    currentTime += 100;
    runFrame();
    currentTime += 100;
    runFrame();

    expect(actions.moveFocus).toHaveBeenCalledTimes(2);
    expect(actions.moveFocus).toHaveBeenLastCalledWith("down");
  });

  it("troca faixa uma vez por gatilho somente na aba Spotify", () => {
    panelOpen = true;
    spotifyActive = true;
    start();
    gamepads = [makeGamepad({ pressed: [7] })];
    runFrame();
    runFrame();
    gamepads = [makeGamepad()];
    runFrame();
    gamepads = [makeGamepad({ pressed: [6] })];
    runFrame();

    expect(actions.spotifyTrack).toHaveBeenNthCalledWith(1, 1);
    expect(actions.spotifyTrack).toHaveBeenNthCalledWith(2, -1);
  });
});
