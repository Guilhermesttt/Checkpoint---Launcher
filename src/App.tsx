import React from "react";
import { AnimatePresence } from "framer-motion";
import { Navigate } from "react-router-dom";
import Home from "./pages/Home";
import GameBootIntro from "./components/GameBootIntro";
import AsyncLoader from "./components/AsyncLoader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationCenter";
import MainVideoBackground from "./components/MainVideoBackground";
import { PreferencesProvider, usePreferences } from "./context/PreferencesContext";
import { isBackendHealthy } from "./services/api";

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { musicVolume } = usePreferences();
  const [isIntroVisible, setIsIntroVisible] = React.useState(false);
  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  const musicFadeRef = React.useRef<number | null>(null);
  const musicStartTimerRef = React.useRef<number | null>(null);

  const clearMusicFade = React.useCallback(() => {
    if (musicFadeRef.current) {
      window.clearInterval(musicFadeRef.current);
      musicFadeRef.current = null;
    }
  }, []);

  const fadeMusicTo = React.useCallback(
    (targetVolume: number, durationMs: number, onComplete?: () => void) => {
      const audio = musicRef.current;
      if (!audio) return;

      clearMusicFade();
      const startVolume = audio.volume;
      const startedAt = performance.now();

      musicFadeRef.current = window.setInterval(() => {
        const progress = Math.min((performance.now() - startedAt) / durationMs, 1);
        audio.volume = startVolume + (targetVolume - startVolume) * progress;

        if (progress >= 1) {
          clearMusicFade();
          onComplete?.();
        }
      }, 40);
    },
    [clearMusicFade],
  );

  const startBackgroundMusic = React.useCallback(() => {
    if (!musicRef.current) {
      musicRef.current = new Audio("/Good-at-what-you-do.mp3");
      musicRef.current.loop = true;
      musicRef.current.preload = "auto";
    }

    const audio = musicRef.current;
    if (!audio.paused) return;

    audio.currentTime = 0;
    audio.volume = 0;
    audio
      .play()
      .then(() => fadeMusicTo(musicVolume / 100, 1800))
      .catch(() => {
        return;
      });
  }, [fadeMusicTo, musicVolume]);

  const stopBackgroundMusic = React.useCallback(() => {
    const audio = musicRef.current;
    if (!audio || audio.paused) return;
    fadeMusicTo(0, 900, () => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, [fadeMusicTo]);

  React.useEffect(() => {
    if (loading) return;
    const currentUid = user?.uid ?? null;

    isBackendHealthy().catch(() => {});

    if (!currentUid) {
      sessionStorage.removeItem("hasSeenIntro");
      setIsIntroVisible(false);
      if (musicStartTimerRef.current) {
        window.clearTimeout(musicStartTimerRef.current);
        musicStartTimerRef.current = null;
      }
      stopBackgroundMusic();
      return;
    }

    if (currentUid && !sessionStorage.getItem("hasSeenIntro")) {
      sessionStorage.setItem("hasSeenIntro", "true");
      setIsIntroVisible(true);
      return;
    }

    musicStartTimerRef.current = window.setTimeout(startBackgroundMusic, 1200);
    return () => {
      if (musicStartTimerRef.current) {
        window.clearTimeout(musicStartTimerRef.current);
        musicStartTimerRef.current = null;
      }
    };
  }, [loading, startBackgroundMusic, stopBackgroundMusic, user?.uid]);

  React.useEffect(() => {
    window.addEventListener("checkpoint:game-launch", stopBackgroundMusic);
    return () =>
      window.removeEventListener("checkpoint:game-launch", stopBackgroundMusic);
  }, [stopBackgroundMusic]);

  React.useEffect(() => {
    const audio = musicRef.current;
    if (!audio || audio.paused) return;
    fadeMusicTo(musicVolume / 100, 450);
  }, [fadeMusicTo, musicVolume]);

  React.useEffect(
    () => () => {
      clearMusicFade();
      if (musicStartTimerRef.current) {
        window.clearTimeout(musicStartTimerRef.current);
      }
    },
    [clearMusicFade],
  );

  if (loading) {
    return <AsyncLoader />;
  }

  // Redirect unauthenticated users to /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="overflow-hidden select-none h-screen w-full">
      <MainVideoBackground />
      <Home />
      <AnimatePresence>
        {isIntroVisible && (
          <GameBootIntro
            key="boot-intro"
            onFinish={() => {
              setIsIntroVisible(false);
              startBackgroundMusic();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const App: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <AppContent />
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
);

export default App;
