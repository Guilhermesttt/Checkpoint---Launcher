import { useEffect, useRef } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { useGamepad } from "../context/GamepadContext";
import { applyThemeLed, requestControllerLedAccess } from "../services/controllerLed";

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

    const sync = async (allowPermissionPrompt: boolean) => {
      let ok = await applyThemeLed(visualTheme);
      if (!ok && allowPermissionPrompt && !accessRequested.current && "hid" in navigator) {
        accessRequested.current = true;
        const granted = await requestControllerLedAccess();
        if (granted) ok = await applyThemeLed(visualTheme);
      }
    };

    void sync(false);

    const handleUserActivation = () => {
      void sync(true);
    };

    window.addEventListener("pointerdown", handleUserActivation, { once: true });
    window.addEventListener("keydown", handleUserActivation, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserActivation);
      window.removeEventListener("keydown", handleUserActivation);
    };
  }, [isGamepadConnected, gamepadFamily, visualTheme]);
}
