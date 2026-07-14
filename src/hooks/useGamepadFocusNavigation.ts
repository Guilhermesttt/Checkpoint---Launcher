import { useCallback, useEffect } from "react";
import type { SoundEffectType } from "./useSoundEffects";

export type SpatialDirection = "up" | "down" | "left" | "right";

interface UseGamepadFocusNavigationProps {
  playSound: (t: SoundEffectType) => void;
  activeCategory: string;
  isSystemCategory: boolean;
}

export function useGamepadFocusNavigation({
  playSound,
  activeCategory,
  isSystemCategory,
}: UseGamepadFocusNavigationProps) {
  const getSystemFocusableElements = useCallback(() => {
    const root = document.querySelector<HTMLElement>("[data-system-page]");
    if (!root) return [];

    return Array.from(
      root.querySelectorAll<HTMLElement>(
        [
          "button:not(:disabled)",
          "input:not(:disabled)",
          "select:not(:disabled)",
          "textarea:not(:disabled)",
          "[tabindex]:not([tabindex='-1'])",
        ].join(","),
      ),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
  }, []);

  const focusSystemElement = useCallback(
    (element: HTMLElement, previousElement?: HTMLElement) => {
      document
        .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
        .forEach((focusedElement) => {
          delete focusedElement.dataset.gamepadFocused;
        });

      element.dataset.gamepadFocused = "true";
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "nearest", inline: "nearest" });

      if (element !== previousElement) {
        playSound("navigate");
      }
    },
    [playSound],
  );

  const moveSystemFocus = useCallback(
    (direction: SpatialDirection = "down") => {
      const elements = getSystemFocusableElements();
      if (elements.length === 0) return false;

      const activeElement = document.activeElement;
      const currentIndex = activeElement instanceof HTMLElement ? elements.indexOf(activeElement) : -1;

      if (currentIndex === -1) {
        focusSystemElement(elements[0]);
        return true;
      }

      const currentElement = elements[currentIndex];
      const currentRect = currentElement.getBoundingClientRect();
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;
      const threshold = 8;

      const rankedCandidates = elements
        .map((element, index) => {
          if (index === currentIndex) return null;

          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const deltaX = centerX - currentCenterX;
          const deltaY = centerY - currentCenterY;

          const isInDirection =
            direction === "left"
              ? deltaX < -threshold
              : direction === "right"
              ? deltaX > threshold
              : direction === "up"
              ? deltaY < -threshold
              : deltaY > threshold;

          if (!isInDirection) return null;

          const primaryDistance =
            direction === "left" || direction === "right" ? Math.abs(deltaX) : Math.abs(deltaY);
          const secondaryDistance =
            direction === "left" || direction === "right" ? Math.abs(deltaY) : Math.abs(deltaX);

          return {
            element,
            score: primaryDistance * 4 + secondaryDistance,
          };
        })
        .filter((candidate): candidate is { element: HTMLElement; score: number } => Boolean(candidate))
        .sort((a, b) => a.score - b.score);

      const nextElement = rankedCandidates[0]?.element;
      if (!nextElement) return false;

      focusSystemElement(nextElement, currentElement);
      return true;
    },
    [focusSystemElement, getSystemFocusableElements],
  );

  useEffect(() => {
    if (isSystemCategory) return;
    document
      .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
      .forEach((focusedElement) => {
        delete focusedElement.dataset.gamepadFocused;
      });
  }, [isSystemCategory]);

  useEffect(() => {
    if (!isSystemCategory) return;
    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-system-page]");
      if (root?.contains(document.activeElement)) return;
      moveSystemFocus("down");
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeCategory, isSystemCategory, moveSystemFocus]);

  const adjustFocusedRange = useCallback(
    (direction: 1 | -1) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement) || activeElement.type !== "range") {
        return false;
      }

      const previousValue = activeElement.value;
      if (direction > 0) {
        activeElement.stepUp();
      } else {
        activeElement.stepDown();
      }

      if (activeElement.value !== previousValue) {
        activeElement.dispatchEvent(new Event("input", { bubbles: true }));
        activeElement.dispatchEvent(new Event("change", { bubbles: true }));
        playSound("navigate");
      }
      return true;
    },
    [playSound],
  );

  return { moveSystemFocus, adjustFocusedRange };
}
