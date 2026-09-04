import { useEffect, useRef } from "react";
import { useGamepadButton } from "../context/GamepadContext";
import { activateElementWithController } from "../utils/controllerTextInput";

interface UseGamepadNavigationProps {
  onClose?: () => void;
  scrollRef?: React.RefObject<HTMLElement | null>;
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
  scrollSpeed = 18,
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

  const rightStickXRef = useRef(0);
  const rightStickYRef = useRef(0);

  useEffect(() => {
    if (!enabled || !scrollRef?.current) return;

    const MAX_PX_PER_FRAME = scrollSpeed;

    const handleRightStick = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      rightStickXRef.current = detail?.x ?? 0;
      rightStickYRef.current = detail?.y ?? 0;
    };

    let rafId = requestAnimationFrame(function tick() {
      if (scrollRef.current && (rightStickYRef.current !== 0 || rightStickXRef.current !== 0)) {
        // Task 2: Bounds checking — scroll para dentro dos limites do elemento
        const el = scrollRef.current;
        if (rightStickYRef.current !== 0) {
          const maxScrollTop = el.scrollHeight - el.clientHeight;
          el.scrollTop = Math.max(0, Math.min(el.scrollTop + rightStickYRef.current * MAX_PX_PER_FRAME, maxScrollTop));
        }
        if (rightStickXRef.current !== 0) {
          const maxScrollLeft = el.scrollWidth - el.clientWidth;
          el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + rightStickXRef.current * MAX_PX_PER_FRAME, maxScrollLeft));
        }
      }
      rafId = requestAnimationFrame(tick);
    });

    window.addEventListener("gamepad:rightstick", handleRightStick);
    return () => {
      window.removeEventListener("gamepad:rightstick", handleRightStick);
      cancelAnimationFrame(rafId);
      rightStickXRef.current = 0;
      rightStickYRef.current = 0;
    };
  }, [scrollRef, scrollSpeed, enabled]);
}
