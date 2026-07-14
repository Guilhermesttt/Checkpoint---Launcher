import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { useGamepad } from "../context/GamepadContext";
import {
  applyThemeLed,
  getControllerLedState,
  requestControllerLedAccess,
  subscribeControllerLedState,
  testControllerLed,
  type ControllerLedState,
} from "../services/controllerLed";

/**
 * Sincroniza a cor da lightbar (DualShock 4 / DualSense) com o tema visual.
 * Requer permissão WebHID — tenta automaticamente ao conectar um controle PlayStation.
 */
export function useControllerLed(): void {
  const { visualTheme } = usePreferences();
  const { isGamepadConnected, gamepadFamily } = useGamepad();
  const accessRequested = useRef(false);

  useEffect(() => {
    if (!isGamepadConnected || gamepadFamily !== "playstation") return;

    void applyThemeLed(visualTheme);

    const handleUserActivation = () => {
      if (accessRequested.current || !("hid" in navigator)) return;
      accessRequested.current = true;

      // WebHID exige requestDevice diretamente na ativacao; um await anterior invalida o gesto.
      void requestControllerLedAccess().then((granted) => {
        if (granted) void applyThemeLed(visualTheme);
      });
    };

    window.addEventListener("pointerdown", handleUserActivation, { once: true });
    window.addEventListener("keydown", handleUserActivation, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserActivation);
      window.removeEventListener("keydown", handleUserActivation);
    };
  }, [isGamepadConnected, gamepadFamily, visualTheme]);
}

export function useControllerLedStatus(): ControllerLedState & {
  requestAccess: () => void;
  testLed: () => void;
} {
  const { visualTheme } = usePreferences();
  const [state, setState] = useState<ControllerLedState>(getControllerLedState);

  useEffect(() => subscribeControllerLedState(setState), []);

  const requestAccess = useCallback(() => {
    void requestControllerLedAccess().then((granted) => {
      if (granted) void applyThemeLed(visualTheme);
    });
  }, [visualTheme]);

  const testLed = useCallback(() => {
    void testControllerLed(visualTheme);
  }, [visualTheme]);

  return { ...state, requestAccess, testLed };
}
