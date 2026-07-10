import { useEffect } from "react";
import { useGamepadButton } from "../context/GamepadContext";

interface UseGamepadNavigationProps {
  onClose?: () => void;
  scrollRef?: React.RefObject<HTMLElement>;
  scrollSpeed?: number;
  /** Desabilita X (útil quando o painel define ação própria, ex.: Jogar) */
  disableX?: boolean;
  /** Desabilita O (útil quando o painel define ação própria de fechar) */
  disableO?: boolean;
  enabled?: boolean;
}

export function useGamepadNavigation({
  onClose,
  scrollRef,
  scrollSpeed = 15,
  disableX = false,
  disableO = false,
  enabled = true,
}: UseGamepadNavigationProps = {}) {
  useGamepadButton(
    "X",
    () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.click();
      }
    },
    enabled && !disableX,
  );

  useGamepadButton(
    "O",
    () => {
      if (onClose) onClose();
    },
    enabled && !disableO,
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
