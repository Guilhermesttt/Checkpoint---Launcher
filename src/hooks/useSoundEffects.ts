import { useCallback, useMemo, useRef } from "react";

import navigateSound from "../sounds/Select Sound.mp3";
import clickSound from "../sounds/Click Sound.mp3";
import returnSound from "../sounds/Return Sound.mp3";
import gameBootSound from "../sounds/Game Boot.mp3";

const sounds = {
  navigate: navigateSound,
  select: clickSound,
  back: returnSound,
  boot: gameBootSound,
};

export const useSoundEffects = () => {
  const lastNavigateAtRef = useRef(0);
  const audioCache = useMemo(() => {
    const cache: Record<string, HTMLAudioElement> = {};
    Object.entries(sounds).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.volume = 0.35;
      audio.preload = "auto";
      cache[key] = audio;
    });
    return cache;
  }, []);

  const playSound = useCallback(
    (type: keyof typeof sounds) => {
      if (type === "navigate") {
        const now = performance.now();
        if (now - lastNavigateAtRef.current < 85) return;
        lastNavigateAtRef.current = now;
      }
      const audio = audioCache[type];
      if (audio) {
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = 0.35;
        clone.play().catch(() => {
          return;
        });
      }
    },
    [audioCache],
  );

  return { playSound };
};
