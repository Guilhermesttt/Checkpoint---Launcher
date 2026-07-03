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
import ps5MenuMusic from "./sounds/PS5_Sounds/menu_music.mp3";
import ps2MenuMusic from "./sounds/PS2-System-Sounds/menu_music.mp3";
import gamecubeMenuMusic from "./sounds/Nintendo GameCube Menu SFX/menu_music.mp3";
import xbox360MenuMusic from "./sounds/Xbox 360 Metro UI Sounds/menu_music.mp3";

const menuMusicByTheme = {
  ps5: ps5MenuMusic,
  ps2: ps2MenuMusic,
  gamecube: gamecubeMenuMusic,
  xbox360: xbox360MenuMusic,
} as const;

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { musicVolume, soundTheme } = usePreferences();
  const [isIntroVisible, setIsIntroVisible] = React.useState(false);
  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  const musicFadeRef = React.useRef<number | null>(null);
  const musicStartTimerRef = React.useRef<number | null>(null);
  const pendingMusicStartRef = React.useRef(false);

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
    const musicSrc = menuMusicByTheme[soundTheme] ?? menuMusicByTheme.ps5;

    if (!musicRef.current) {
      musicRef.current = new Audio(musicSrc);
      musicRef.current.loop = true;
      musicRef.current.preload = "auto";
    }

    const audio = musicRef.current;
    if (audio.src !== new URL(musicSrc, window.location.href).href) {
      audio.pause();
      audio.src = musicSrc;
      audio.load();
    }
    if (!audio.paused) return;

    audio.currentTime = 0;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        pendingMusicStartRef.current = false;
        fadeMusicTo(musicVolume / 100, 1800);
      })
      .catch(() => {
        pendingMusicStartRef.current = true;
        return;
      });
  }, [fadeMusicTo, musicVolume, soundTheme]);

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
    if (!user?.uid) return;
    const retryMusicStart = () => {
      if (pendingMusicStartRef.current || !musicRef.current || musicRef.current.paused) {
        startBackgroundMusic();
      }
    };

    window.addEventListener("pointerdown", retryMusicStart);
    window.addEventListener("keydown", retryMusicStart);
    return () => {
      window.removeEventListener("pointerdown", retryMusicStart);
      window.removeEventListener("keydown", retryMusicStart);
    };
  }, [startBackgroundMusic, user?.uid]);

  React.useEffect(() => {
    const audio = musicRef.current;
    if (!audio || audio.paused) return;
    fadeMusicTo(musicVolume / 100, 450);
  }, [fadeMusicTo, musicVolume]);

  React.useEffect(() => {
    const audio = musicRef.current;
    const musicSrc = menuMusicByTheme[soundTheme] ?? menuMusicByTheme.ps5;
    if (!audio) return;

    const nextUrl = new URL(musicSrc, window.location.href).href;
    if (audio.src === nextUrl) return;

    const wasPlaying = !audio.paused;
    clearMusicFade();
    audio.pause();
    audio.src = musicSrc;
    audio.load();
    if (wasPlaying) {
      audio.volume = 0;
      audio.play().then(() => {
        fadeMusicTo(musicVolume / 100, 700);
      }).catch(() => {
        pendingMusicStartRef.current = true;
      });
    }
  }, [clearMusicFade, fadeMusicTo, musicVolume, soundTheme]);

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
