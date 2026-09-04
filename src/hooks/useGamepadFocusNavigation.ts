import { useCallback, useEffect } from "react";
import type { SoundEffectType } from "./useSoundEffects";
import {
  findDeclaredSpatialNeighbor,
  rankSpatialCandidates,
  type SpatialDirection,
} from "../utils/spatialFocus";
export type { SpatialDirection } from "../utils/spatialFocus";

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
      const root = document.querySelector<HTMLElement>("[data-system-page]");
      const declaredNeighbor = root
        ? findDeclaredSpatialNeighbor(root, currentElement, direction)
        : null;
      const rankedCandidates = rankSpatialCandidates(
        currentRect,
        elements
          .filter((element) => element !== currentElement)
          .map((element) => ({ id: element, rect: element.getBoundingClientRect() })),
        direction,
      );

      const nextElement = declaredNeighbor ?? rankedCandidates[0]?.id;

      // Task 8: Wrap-around — se não há candidato na direção, volta ao início/fim da lista
      if (!nextElement) {
        const wrapTarget =
          direction === "down" || direction === "right"
            ? elements[0]
            : elements[elements.length - 1];
        if (wrapTarget && wrapTarget !== currentElement) {
          focusSystemElement(wrapTarget, currentElement);
          return true;
        }
        return false;
      }

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
