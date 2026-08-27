import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { resetCachedLedDevice } from "../services/controllerLed";
import { isLauncherInputLocked } from "../utils/launcherInputLock";

export type InputType = "mouse" | "keyboard" | "gamepad";
export type GamepadFamily = "playstation" | "xbox" | "generic";

interface GamepadContextValue {
  activeInputType: InputType;
  isGamepadConnected: boolean;
  gamepadFamily: GamepadFamily;
  connectedGamepadId: string | null;
}

const GamepadContext = createContext<GamepadContextValue | null>(null);

export type GamepadButtonName =
  | "X" | "O" | "SQUARE" | "TRIANGLE"
  | "L1" | "R1" | "L2" | "R2"
  | "SHARE" | "OPTIONS" | "GUIDE"
  | "DPAD_UP" | "DPAD_DOWN" | "DPAD_LEFT" | "DPAD_RIGHT";

// D-pad (12-15) NÃO entra aqui: é tratado exclusivamente pelo loop `dpadButtons`
// mais abaixo. Antes ele também caía nesse mapa e era disparado pelo loop
// genérico de botões — resultado: cada toque no D-pad disparava o evento
// DUAS vezes no mesmo frame (era esse o bug do "pula um item").
const BUTTON_MAP: Record<number, GamepadButtonName> = {
  0: "X",
  1: "O",
  2: "SQUARE",
  3: "TRIANGLE",
  4: "L1",
  5: "R1",
  6: "L2",
  7: "R2",
  8: "SHARE",
  9: "OPTIONS",
  16: "GUIDE",
};

// Índices tratados por loops dedicados (triggers analógicos e D-pad físico) —
// o loop genérico de botões abaixo precisa ignorá-los para não disparar duas vezes.
const DEDICATED_BUTTON_INDEXES = new Set([6, 7, 12, 13, 14, 15]);

interface GamepadButtonSubscriber {
  id: symbol;
  callback: () => void;
  priority: number;
}

const gamepadButtonSubscribers = new Map<GamepadButtonName, Set<GamepadButtonSubscriber>>();

export function detectGamepadFamily(id: string): GamepadFamily {
  const lower = id.toLowerCase();
  if (
    lower.includes("xbox") ||
    lower.includes("045e") ||
    lower.includes("xinput")
  ) {
    return "xbox";
  }
  if (
    lower.includes("dualsense") ||
    lower.includes("dualshock") ||
    lower.includes("wireless controller") ||
    lower.includes("054c") ||
    lower.includes("playstation") ||
    lower.includes("ps5") ||
    lower.includes("ps4")
  ) {
    return "playstation";
  }
  return "generic";
}

function readTriggerValue(gp: Gamepad, side: "L2" | "R2"): number {
  const buttonIndex = side === "L2" ? 6 : 7;
  const axisIndex = side === "L2" ? 4 : 5;
  const buttonValue = gp.buttons[buttonIndex]?.value ?? 0;
  const axisValue = gp.axes[axisIndex] ?? 0;
  return Math.max(buttonValue, axisValue > 0 ? axisValue : 0);
}

const isPressed = (button: GamepadButton | undefined) =>
  Boolean(button?.pressed || (button?.value ?? 0) > 0.5);

const isGamepadOverlayTogglePressed = (gamepad: Gamepad) =>
  isPressed(gamepad.buttons[16])
  || (isPressed(gamepad.buttons[8]) && isPressed(gamepad.buttons[9]));

// ─── Feedback háptico (vibração) ─────────────────────────────────────────────
type HapticPatternName = "nav" | "action" | "launch";

interface HapticStep {
  delay: number;
  duration: number;
  weakMagnitude: number;
  strongMagnitude: number;
}

const HAPTIC_PATTERNS: Record<HapticPatternName, HapticStep[]> = {
  nav: [{ delay: 0, duration: 28, weakMagnitude: 0.12, strongMagnitude: 0 }],
  action: [{ delay: 0, duration: 45, weakMagnitude: 0.22, strongMagnitude: 0.08 }],
  launch: [
    { delay: 0, duration: 60, weakMagnitude: 0.15, strongMagnitude: 0 },
    { delay: 150, duration: 60, weakMagnitude: 0.28, strongMagnitude: 0.10 },
    { delay: 300, duration: 260, weakMagnitude: 0.38, strongMagnitude: 0.55 },
  ],
};

const isHapticsEnabledGlobal = (): boolean => {
  try {
    const v = localStorage.getItem("checkpoint_haptics_enabled_global");
    return v !== "false";
  } catch { return true; }
};

const getHapticActuator = (gp: Gamepad) =>
  (gp as unknown as { vibrationActuator?: { playEffect: (type: string, params: object) => Promise<unknown> } })
    .vibrationActuator;

const playPatternOnGamepad = (gp: Gamepad, steps: HapticStep[]) => {
  if (!isHapticsEnabledGlobal()) return;
  const actuator = getHapticActuator(gp);
  if (!actuator?.playEffect) return;

  steps.forEach((step) => {
    window.setTimeout(() => {
      actuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: step.duration,
        weakMagnitude: step.weakMagnitude,
        strongMagnitude: step.strongMagnitude,
      }).catch(() => undefined);
    }, step.delay);
  });
};

const fireHaptic = (gp: Gamepad, kind: "nav" | "action" = "nav") => {
  playPatternOnGamepad(gp, HAPTIC_PATTERNS[kind]);
};

export const playHapticPattern = (pattern: HapticPatternName) => {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  Array.from(gamepads)
    .filter((gp): gp is Gamepad => gp !== null)
    .forEach((gp) => playPatternOnGamepad(gp, HAPTIC_PATTERNS[pattern]));
};

// ─── Aceleração progressiva do analógico ────────────────────────────────────
const AXIS_INITIAL_DELAY = 320;
const AXIS_FAST_INTERVAL = 80;
const AXIS_ACCEL_STEPS = 5;
const AXIS_DEADZONE = 0.28;

interface AxisState {
  direction: "up" | "down" | "left" | "right" | null;
  heldSince: number;
  lastFire: number;
  repeatCount: number;
}

export const GamepadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeInputType, setActiveInputType] = useState<InputType>("mouse");
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadFamily, setGamepadFamily] = useState<GamepadFamily>("generic");
  const [connectedGamepadId, setConnectedGamepadId] = useState<string | null>(null);

  const [overlayHasFocus, setOverlayHasFocus] = useState(false);
  const overlayFocusRef = useRef(false); // CORREÇÃO: Ref para manter o valor atualizado no pollGamepads

  const requestRef = useRef<number>(0);
  const lastButtonState = useRef<Record<string, boolean>>({});
  const lastGuideToggle = useRef<number>(0);
  const axisState = useRef<Record<"h" | "v", AxisState>>({
    h: { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 },
    v: { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 },
  });

  const activeInputRef = useRef<InputType>("mouse");
  activeInputRef.current = activeInputType;
  const isConnectedRef = useRef(false);
  isConnectedRef.current = isGamepadConnected;
  const connectedIdRef = useRef<string | null>(null);
  connectedIdRef.current = connectedGamepadId;

  // Listener para foco do overlay
  React.useEffect(() => {
    const handleOverlayFocus = (event: CustomEvent) => {
      const hasFocus = event.detail?.hasFocus;
      setOverlayHasFocus(hasFocus);
      overlayFocusRef.current = hasFocus; // Atualiza a ref simultaneamente
    };
    window.addEventListener("checkpoint:overlay-focus-changed", handleOverlayFocus as EventListener);
    return () => window.removeEventListener("checkpoint:overlay-focus-changed", handleOverlayFocus as EventListener);
  }, []);

  React.useEffect(() => {
    if (overlayHasFocus) {
      setActiveInputType("mouse");
    }
  }, [overlayHasFocus]);

  const handleGamepadConnected = useCallback((e: GamepadEvent) => {
    setIsGamepadConnected(true);
    setActiveInputType("gamepad");
    setConnectedGamepadId(e.gamepad.id);
    setGamepadFamily(detectGamepadFamily(e.gamepad.id));
    document.body.style.cursor = "none";
  }, []);

  const handleGamepadDisconnected = useCallback((event: GamepadEvent) => {
    if (connectedIdRef.current && event.gamepad.id !== connectedIdRef.current) return;
    setIsGamepadConnected(false);
    setConnectedGamepadId(null);
    setGamepadFamily("generic");
    setActiveInputType("mouse");
    document.body.style.cursor = "default";
    lastButtonState.current = {};
    axisState.current.h = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
    axisState.current.v = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
    resetCachedLedDevice();
  }, []);

  const dispatchButtonPress = useCallback((buttonName: GamepadButtonName) => {
    if (isLauncherInputLocked()) return;
    const subscribers = Array.from(gamepadButtonSubscribers.get(buttonName) ?? []);
    if (subscribers.length === 0) return;

    const highestPriority = Math.max(...subscribers.map((s) => s.priority));
    subscribers
      .filter((s) => s.priority === highestPriority)
      .forEach((s) => s.callback());
  }, []);

  const getRepeatInterval = (repeatCount: number): number => {
    const t = Math.min(repeatCount / AXIS_ACCEL_STEPS, 1);
    return AXIS_INITIAL_DELAY + (AXIS_FAST_INTERVAL - AXIS_INITIAL_DELAY) * t;
  };

  const pollGamepads = useCallback(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGamepads = Array.from(gamepads).filter(
      (gp): gp is Gamepad => gp !== null,
    );

    const activeGamepad =
      connectedGamepads.find((gp) => gp.id === connectedIdRef.current) ??
      connectedGamepads[0] ??
      null;

    const gamepadFound = activeGamepad !== null;
    const now = performance.now();

    // ── Overlay toggle ──────────────────────────────
    connectedGamepads.forEach((gp) => {
      const isOverlayToggle = isGamepadOverlayTogglePressed(gp);
      const stateKey = `${gp.index}:overlay-toggle`;
      const wasPressed = lastButtonState.current[stateKey];
      const outsideCooldown = lastGuideToggle.current === 0 || now - lastGuideToggle.current > 650;

      if (isOverlayToggle && !wasPressed && outsideCooldown) {
        lastGuideToggle.current = now;

        // CORREÇÃO: Evita crash caso a chamada seja síncrona ou undefined
        try {
          const res = window.electronAPI?.toggleOverlayPanel();
          if (res && typeof res.catch === 'function') {
            res.catch(() => undefined);
          }
        } catch (error) {
          console.error("Erro ao alternar overlay:", error);
        }
      }
      lastButtonState.current[stateKey] = isOverlayToggle;
    });

    // CORREÇÃO: Usando `overlayFocusRef.current` no lugar do state travado no closure
    if (activeGamepad && document.hasFocus() && !overlayFocusRef.current) {
      const gp = activeGamepad;
      let inputDetected = false;

      gp.buttons.forEach((button, buttonIndex) => {
        if (DEDICATED_BUTTON_INDEXES.has(buttonIndex)) return;

        const pressed = button.pressed || button.value > 0.5;
        const stateKey = `${gp.index}:btn:${buttonIndex}`;
        const wasPressed = lastButtonState.current[stateKey];

        if (pressed && !wasPressed) {
          inputDetected = true;
          const name = BUTTON_MAP[buttonIndex];
          if (name) {
            dispatchButtonPress(name);
            fireHaptic(gp, "action");
          }
        }

        lastButtonState.current[stateKey] = pressed;
      });

      // ── Triggers analógicos (L2 / R2) ────────────────────────────────────
      (["L2", "R2"] as const).forEach((trigger) => {
        const value = readTriggerValue(gp, trigger);
        const pressed = value > 0.55;
        const stateKey = `${gp.index}:trigger:${trigger}`;
        const wasPressed = lastButtonState.current[stateKey];

        if (pressed && !wasPressed) {
          inputDetected = true;
          dispatchButtonPress(trigger);
          fireHaptic(gp, "action");
        }
        lastButtonState.current[stateKey] = pressed;
      });

      // ── D-pad físico ─────────────────────────────────────────────────────
      const dpadButtons: Array<[number, GamepadButtonName]> = [
        [12, "DPAD_UP"], [13, "DPAD_DOWN"], [14, "DPAD_LEFT"], [15, "DPAD_RIGHT"],
      ];
      let dpadActive = false;
      dpadButtons.forEach(([idx, name]) => {
        const pressed = gp.buttons[idx]?.pressed ?? false;
        const stateKey = `${gp.index}:dpad:${idx}`;
        const wasPressed = lastButtonState.current[stateKey];
        if (pressed && !wasPressed) {
          inputDetected = true;
          dispatchButtonPress(name);
          fireHaptic(gp, "nav");
        }
        lastButtonState.current[stateKey] = pressed;
        if (pressed) dpadActive = true;
      });

      // ── Analógico esquerdo ──────────────────────────────────────────────
      if (!dpadActive) {
        const xAxis = gp.axes[0] ?? 0;
        const yAxis = gp.axes[1] ?? 0;

        const normalizeAxis = (v: number) => {
          if (Math.abs(v) < AXIS_DEADZONE) return 0;
          return (v - Math.sign(v) * AXIS_DEADZONE) / (1 - AXIS_DEADZONE);
        };

        const nx = normalizeAxis(xAxis);
        const ny = normalizeAxis(yAxis);

        // Horizontal
        const hDir: "left" | "right" | null = nx < -0.1 ? "left" : nx > 0.1 ? "right" : null;
        const hState = axisState.current.h;

        if (hDir) {
          const btnName = hDir === "left" ? "DPAD_LEFT" : "DPAD_RIGHT";
          if (hState.direction !== hDir) {
            hState.direction = hDir;
            hState.heldSince = now;
            hState.lastFire = now;
            hState.repeatCount = 0;
            dispatchButtonPress(btnName);
            fireHaptic(gp, "nav");
            inputDetected = true;
          } else {
            const held = now - hState.heldSince;
            const interval = held < AXIS_INITIAL_DELAY
              ? AXIS_INITIAL_DELAY
              : getRepeatInterval(hState.repeatCount);
            if (now - hState.lastFire >= interval) {
              hState.lastFire = now;
              hState.repeatCount++;
              dispatchButtonPress(btnName);
              fireHaptic(gp, "nav");
              inputDetected = true;
            }
          }
        } else {
          hState.direction = null;
          hState.repeatCount = 0;
        }

        // Vertical
        const vDir: "up" | "down" | null = ny < -0.1 ? "up" : ny > 0.1 ? "down" : null;
        const vState = axisState.current.v;

        if (vDir) {
          const btnName = vDir === "up" ? "DPAD_UP" : "DPAD_DOWN";
          if (vState.direction !== vDir) {
            vState.direction = vDir;
            vState.heldSince = now;
            vState.lastFire = now;
            vState.repeatCount = 0;
            dispatchButtonPress(btnName);
            fireHaptic(gp, "nav");
            inputDetected = true;
          } else {
            const held = now - vState.heldSince;
            const interval = held < AXIS_INITIAL_DELAY
              ? AXIS_INITIAL_DELAY
              : getRepeatInterval(vState.repeatCount);
            if (now - vState.lastFire >= interval) {
              vState.lastFire = now;
              vState.repeatCount++;
              dispatchButtonPress(btnName);
              fireHaptic(gp, "nav");
              inputDetected = true;
            }
          }
        } else {
          vState.direction = null;
          vState.repeatCount = 0;
        }
      } else {
        axisState.current.h = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
        axisState.current.v = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
      }

      // ── Analógico direito ────────────────────────────────────────────────
      const rightX = gp.axes[2] ?? 0;
      const rightY = gp.axes[3] ?? 0;
      const RIGHT_DEADZONE = 0.2;
      const rightActive =
        Math.abs(rightX) > RIGHT_DEADZONE || Math.abs(rightY) > RIGHT_DEADZONE;

      if (!isLauncherInputLocked() && rightActive) {
        inputDetected = true;
        window.dispatchEvent(
          new CustomEvent("gamepad:rightstick", {
            detail: {
              x: Math.abs(rightX) > RIGHT_DEADZONE ? rightX : 0,
              y: Math.abs(rightY) > RIGHT_DEADZONE ? rightY : 0,
            },
          }),
        );
      }

      if (inputDetected && activeInputRef.current !== "gamepad") {
        setActiveInputType("gamepad");
        document.body.style.cursor = "none";
      }
    }

    if (gamepadFound && activeGamepad) {
      if (!isConnectedRef.current) {
        setIsGamepadConnected(true);
        setConnectedGamepadId(activeGamepad.id);
        setGamepadFamily(detectGamepadFamily(activeGamepad.id));
      } else if (connectedIdRef.current !== activeGamepad.id) {
        setConnectedGamepadId(activeGamepad.id);
        setGamepadFamily(detectGamepadFamily(activeGamepad.id));
      }
    } else if (!gamepadFound && isConnectedRef.current) {
      setIsGamepadConnected(false);
      setConnectedGamepadId(null);
      setGamepadFamily("generic");
      lastButtonState.current = {};
      axisState.current.h = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
      axisState.current.v = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
      resetCachedLedDevice();
      if (activeInputRef.current === "gamepad") {
        setActiveInputType("mouse");
        document.body.style.cursor = "default";
      }
    }

    requestRef.current = requestAnimationFrame(pollGamepads);
  }, [dispatchButtonPress]);

  useEffect(() => {
    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
    requestRef.current = requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [handleGamepadConnected, handleGamepadDisconnected, pollGamepads]);

  useEffect(() => {
    const onMouse = () => {
      if (activeInputRef.current !== "mouse") {
        setActiveInputType("mouse");
        document.body.style.cursor = "default";
      }
    };
    const onKeyboard = (e: Event) => {
      if (!(e as KeyboardEvent).isTrusted) return;
      if (activeInputRef.current !== "keyboard") {
        setActiveInputType("keyboard");
        document.body.style.cursor = "none";
      }
    };

    window.addEventListener("mousemove", onMouse);
    window.addEventListener("mousedown", onMouse);
    window.addEventListener("wheel", onMouse);
    window.addEventListener("keydown", onKeyboard);

    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("mousedown", onMouse);
      window.removeEventListener("wheel", onMouse);
      window.removeEventListener("keydown", onKeyboard);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isGamepadConnected && activeInputType === "gamepad") {
      root.dataset.gamepadNavigation = "active";
    } else {
      delete root.dataset.gamepadNavigation;
    }
    return () => { delete root.dataset.gamepadNavigation; };
  }, [activeInputType, isGamepadConnected]);

  return (
    <GamepadContext.Provider value={{ activeInputType, isGamepadConnected, gamepadFamily, connectedGamepadId }}>
      {children}
    </GamepadContext.Provider>
  );
};

export const useGamepad = () => {
  const context = useContext(GamepadContext);
  if (!context) {
    throw new Error("useGamepad must be used within a GamepadProvider");
  }
  return context;
};

export const useGamepadButton = (
  button: GamepadButtonName,
  callback: () => void,
  enabled = true,
  priority = 0,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const subscriber: GamepadButtonSubscriber = {
      id: Symbol(button),
      callback: () => callbackRef.current(),
      priority,
    };
    const subscribers = gamepadButtonSubscribers.get(button) ?? new Set<GamepadButtonSubscriber>();
    subscribers.add(subscriber);
    gamepadButtonSubscribers.set(button, subscribers);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) gamepadButtonSubscribers.delete(button);
    };
  }, [button, enabled, priority]);
};