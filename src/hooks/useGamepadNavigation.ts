import { useEffect } from "react";
import { useGamepadButton } from "../context/GamepadContext";
import { activateElementWithController } from "../utils/controllerTextInput";

interface UseGamepadNavigationProps {
  onClose?: () => void;
  scrollRef?: React.RefObject<HTMLElement>;
  scrollSpeed?: number;
  /** Desabilita X (útil quando o painel define ação própria, ex.: Jogar) */
  disableX?: boolean;
  /** Desabilita O (útil quando o painel define ação própria de fechar) */
  disableO?: boolean;
  enabled?: boolean;
  /** Camada de entrada. Modais devem usar prioridade maior que paginas. */
  priority?: number;
}

export function useGamepadNavigation({
  onClose,
  scrollRef,
  scrollSpeed = 15,
  disableX = false,
  disableO = false,
  enabled = true,
  priority = 0,
}: UseGamepadNavigationProps = {}) {
  useGamepadButton(
    "X",
    () => {
      if (document.activeElement instanceof HTMLElement) {
        activateElementWithController(document.activeElement);
      }
    },
    enabled && !disableX,
    priority,
  );

  useGamepadButton(
    "O",
    () => {
      if (onClose) onClose();
    },
    enabled && !disableO,
    priority,
  );

  useEffect(() => {
    if (!enabled || !scrollRef?.current) return;

    const handleRightStick = (e: Event) => {
      const customEvent = e as CustomEvent<{ x: number; y: number }>;
      const { y } = customEvent.detail;

      if (Math.abs(y) > 0) {
        scrollRef.current!.scrollBy({
          top: y * scrollSpeed,
          behavior: "auto",
        });
      }
    };

    window.addEventListener("gamepad:rightstick", handleRightStick);
    return () => {
      window.removeEventListener("gamepad:rightstick", handleRightStick);
    };
  }, [scrollRef, scrollSpeed, enabled]);
}
