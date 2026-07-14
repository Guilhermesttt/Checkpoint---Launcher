import { useEffect, useRef } from "react";

interface UseIntervalOptions {
  pauseWhenHidden?: boolean;
}

export function useInterval(
  callback: () => void,
  delay: number | null,
  options?: UseIntervalOptions
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    let id: number | null = null;
    let isPaused = false;

    const tick = () => {
      savedCallback.current();
    };

    const start = () => {
      if (id === null) {
        if (isPaused) {
          console.log(`[useInterval] Polling retomado (delay: ${delay}ms)`);
          isPaused = false;
        }
        id = window.setInterval(tick, delay);
      }
    };

    const stop = (pausedByVisibility = false) => {
      if (id !== null) {
        window.clearInterval(id);
        id = null;
        if (pausedByVisibility) {
          console.log(`[useInterval] Polling pausado (delay: ${delay}ms)`);
          isPaused = true;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!options?.pauseWhenHidden) return;
      if (document.visibilityState === "hidden") {
        stop(true);
      } else {
        start();
      }
    };

    if (options?.pauseWhenHidden && document.visibilityState === "hidden") {
      isPaused = true;
      console.log(`[useInterval] Polling iniciado em estado pausado (delay: ${delay}ms)`);
    } else {
      start();
    }

    if (options?.pauseWhenHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stop();
      if (options?.pauseWhenHidden) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [delay, options?.pauseWhenHidden]);
}
