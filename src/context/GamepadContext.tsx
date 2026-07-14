import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { resetCachedLedDevice } from "../services/controllerLed";

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
  | "SHARE" | "OPTIONS"
  | "DPAD_UP" | "DPAD_DOWN" | "DPAD_LEFT" | "DPAD_RIGHT";

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
  12: "DPAD_UP",
  13: "DPAD_DOWN",
  14: "DPAD_LEFT",
  15: "DPAD_RIGHT",
};

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

export const GamepadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeInputType, setActiveInputType] = useState<InputType>("mouse");
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadFamily, setGamepadFamily] = useState<GamepadFamily>("generic");
  const [connectedGamepadId, setConnectedGamepadId] = useState<string | null>(null);
  const requestRef = useRef<number>(0);
  const lastButtonState = useRef<Record<string, boolean>>({});
  const lastAxisMove = useRef<number>(0);

  const handleGamepadConnected = useCallback((e: GamepadEvent) => {
    setIsGamepadConnected(true);
    setActiveInputType("gamepad");
    setConnectedGamepadId(e.gamepad.id);
    setGamepadFamily(detectGamepadFamily(e.gamepad.id));
    document.body.style.cursor = "none";
  }, []);

  const handleGamepadDisconnected = useCallback((event: GamepadEvent) => {
    if (connectedGamepadId && event.gamepad.id !== connectedGamepadId) return;
    setIsGamepadConnected(false);
    setConnectedGamepadId(null);
    setGamepadFamily("generic");
    setActiveInputType("mouse");
    document.body.style.cursor = "default";
    lastButtonState.current = {};
    resetCachedLedDevice();
  }, [connectedGamepadId]);

  const dispatchButtonPress = useCallback((buttonName: GamepadButtonName) => {
    const subscribers = Array.from(gamepadButtonSubscribers.get(buttonName) ?? []);
    if (subscribers.length === 0) return;

    const highestPriority = Math.max(...subscribers.map((subscriber) => subscriber.priority));
    subscribers
      .filter((subscriber) => subscriber.priority === highestPriority)
      .forEach((subscriber) => subscriber.callback());
  }, []);

  const pollGamepads = useCallback(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGamepads = Array.from(gamepads).filter(
      (gamepad): gamepad is Gamepad => gamepad !== null,
    );
    const activeGamepad =
      connectedGamepads.find((gamepad) => gamepad.id === connectedGamepadId) ??
      connectedGamepads[0] ??
      null;
    const gamepadFound = activeGamepad !== null;

    if (activeGamepad) {
        const gp = activeGamepad;
        let inputDetected = false;

        gp.buttons.forEach((button, buttonIndex) => {
          // L2/R2 são tratados como gatilhos analógicos abaixo
          if (buttonIndex === 6 || buttonIndex === 7) return;

          const isPressed = button.pressed || button.value > 0.5;
          const stateKey = `${gp.index}:btn:${buttonIndex}`;
          const wasPressed = lastButtonState.current[stateKey];

          if (isPressed && !wasPressed) {
            inputDetected = true;
            const buttonName = BUTTON_MAP[buttonIndex];
            if (buttonName) {
              dispatchButtonPress(buttonName);
            }
          }

          lastButtonState.current[stateKey] = isPressed;
        });

        // L2/R2 analógicos (comum em Xbox e alguns drivers PS)
        (["L2", "R2"] as const).forEach((trigger) => {
          const value = readTriggerValue(gp, trigger);
          const isPressed = value > 0.55;
          const stateKey = `${gp.index}:trigger:${trigger}`;
          const wasPressed = lastButtonState.current[stateKey];

          if (isPressed && !wasPressed) {
            inputDetected = true;
            dispatchButtonPress(trigger);
          }
          lastButtonState.current[stateKey] = isPressed;
        });

        const now = performance.now();
        if (now - lastAxisMove.current > 180) {
          const xAxis = gp.axes[0];
          const yAxis = gp.axes[1];
          const DEADZONE = 0.35;

          let axisTriggered = false;

          if (xAxis !== undefined && xAxis < -DEADZONE) {
            dispatchButtonPress("DPAD_LEFT");
            axisTriggered = true;
          } else if (xAxis !== undefined && xAxis > DEADZONE) {
            dispatchButtonPress("DPAD_RIGHT");
            axisTriggered = true;
          }

          if (yAxis !== undefined && yAxis < -DEADZONE) {
            dispatchButtonPress("DPAD_UP");
            axisTriggered = true;
          } else if (yAxis !== undefined && yAxis > DEADZONE) {
            dispatchButtonPress("DPAD_DOWN");
            axisTriggered = true;
          }

          if (axisTriggered) {
            inputDetected = true;
            lastAxisMove.current = now;
          }
        }

        const rightX = gp.axes[2];
        const rightY = gp.axes[3];
        const RIGHT_DEADZONE = 0.2;
        if (
          (rightX !== undefined && Math.abs(rightX) > RIGHT_DEADZONE) ||
          (rightY !== undefined && Math.abs(rightY) > RIGHT_DEADZONE)
        ) {
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

        if (inputDetected && activeInputType !== "gamepad") {
          setActiveInputType("gamepad");
          document.body.style.cursor = "none";
        }
    }

    if (gamepadFound && activeGamepad) {
      if (!isGamepadConnected) {
        setIsGamepadConnected(true);
        setConnectedGamepadId(activeGamepad.id);
        setGamepadFamily(detectGamepadFamily(activeGamepad.id));
      } else if (connectedGamepadId !== activeGamepad.id) {
        setConnectedGamepadId(activeGamepad.id);
        setGamepadFamily(detectGamepadFamily(activeGamepad.id));
      }
    } else if (!gamepadFound && isGamepadConnected) {
      setIsGamepadConnected(false);
      setConnectedGamepadId(null);
      setGamepadFamily("generic");
      lastButtonState.current = {};
      resetCachedLedDevice();
      if (activeInputType === "gamepad") {
        setActiveInputType("mouse");
        document.body.style.cursor = "default";
      }
    }

    requestRef.current = requestAnimationFrame(pollGamepads);
  }, [activeInputType, connectedGamepadId, dispatchButtonPress, isGamepadConnected]);

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
    const handleMouseInteraction = () => {
      if (activeInputType !== "mouse") {
        setActiveInputType("mouse");
        document.body.style.cursor = "default";
      }
    };

    const handleKeyboardInteraction = (e: Event) => {
      if (!(e as KeyboardEvent).isTrusted) return;

      if (activeInputType !== "keyboard") {
        setActiveInputType("keyboard");
        document.body.style.cursor = "none";
      }
    };

    window.addEventListener("mousemove", handleMouseInteraction);
    window.addEventListener("mousedown", handleMouseInteraction);
    window.addEventListener("wheel", handleMouseInteraction);
    window.addEventListener("keydown", handleKeyboardInteraction);

    return () => {
      window.removeEventListener("mousemove", handleMouseInteraction);
      window.removeEventListener("mousedown", handleMouseInteraction);
      window.removeEventListener("wheel", handleMouseInteraction);
      window.removeEventListener("keydown", handleKeyboardInteraction);
    };
  }, [activeInputType]);

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
