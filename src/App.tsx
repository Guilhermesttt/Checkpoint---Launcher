import React from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Navigate } from "react-router-dom";
import Home from "./pages/Home";
import GameBootIntro from "./components/GameBootIntro";
import AsyncLoader from "./components/AsyncLoader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationCenter";
import MainVideoBackground from "./components/MainVideoBackground";
import { PreferencesProvider, usePreferences } from "./context/PreferencesContext";
import { GamepadProvider } from "./context/GamepadContext";
import { GamepadStatusOverlay } from "./components/ui/GamepadStatusOverlay";
import { useControllerLed } from "./hooks/useControllerLed";
import ControllerVirtualKeyboard from "./components/ui/ControllerVirtualKeyboard";
import { isBackendHealthy } from "./services/api";
import type { SoundTheme } from "./context/PreferencesContext";

const menuMusicLoaders: Record<SoundTheme, () => Promise<string | null>> = {
  ps5: () =>
    import("./sounds/PS5_Plus/003. Home Menu.mp3").then((module) => module.default),
  ps4: () => import("./sounds/PS4/01 Main.mp3").then((module) => module.default),
  psp: () => import("./sounds/PSP Sounds/menu_music.mp3").then((module) => module.default),
  ps2: () =>
    import("./sounds/PS2 System Sounds/menu_music.mp3").then((module) => module.default),
  gamecube: () =>
    import("./sounds/Nintendo GameCube Menu SFX/menu_music.mp3").then((module) => module.default),
  xbox360: () =>
    import("./sounds/Xbox 360 UI/01. Amb 05 Engineroom Lr.mp3").then(
      (module) => module.default,
    ),
  cyberpunk: () =>
    import(
      "./sounds/Cyberpunk 2077 UI SFX PACK/Cyberpunk_2077_-_Pause_Menu_Theme_KLICKAUD.mp3"
    ).then((module) => module.default),
} as const;

// These source tracks were mastered much quieter than the other theme music.
// The gain values bring their peaks close to -2 dB without changing the user's volume setting.
const menuMusicGain: Record<SoundTheme, number> = {
  ps5: 0.7,
  ps4: 25,
  psp: 1,
  ps2: 1,
  gamecube: 1,
  xbox360: 1,
  cyberpunk: 16,
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { musicVolume, soundTheme, lowPerformanceMode } = usePreferences();
  useControllerLed();
  const [isIntroVisible, setIsIntroVisible] = React.useState<boolean | null>(null);
  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  const musicAudioContextRef = React.useRef<AudioContext | null>(null);
  const musicGainRef = React.useRef<GainNode | null>(null);
  const musicFadeRef = React.useRef<number | null>(null);
  const musicStartTimerRef = React.useRef<number | null>(null);
  const pendingMusicStartRef = React.useRef(false);
  const loadedMusicSrcRef = React.useRef<string | null>(null);
  const musicVolumeRef = React.useRef(musicVolume);
  const musicTransitionRef = React.useRef(0);
  const completedIntroUserRef = React.useRef<string | null>(null);
  const spotifyPlayingRef = React.useRef(false);

  React.useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

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

  const ensureMusicSource = React.useCallback(async (theme: SoundTheme) => {
    const loader = menuMusicLoaders[theme] ?? menuMusicLoaders.ps5;
    const musicSrc = await loader();

    if (!musicSrc) {
      musicRef.current?.pause();
      loadedMusicSrcRef.current = null;
      return null;
    }

    if (!musicRef.current) {
      const audio = new Audio(musicSrc);
      audio.loop = true;
      audio.preload = "none";
      musicRef.current = audio;

      const audioContext = new AudioContext();
      const sourceNode = audioContext.createMediaElementSource(audio);
      const gainNode = audioContext.createGain();
      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      musicAudioContextRef.current = audioContext;
      musicGainRef.current = gainNode;
      loadedMusicSrcRef.current = musicSrc;
    }

    const audio = musicRef.current;
    if (loadedMusicSrcRef.current !== musicSrc) {
      audio.pause();
      audio.src = musicSrc;
      audio.load();
      loadedMusicSrcRef.current = musicSrc;
    }

    if (musicGainRef.current) {
      musicGainRef.current.gain.value = menuMusicGain[theme] ?? 1;
    }

    return audio;
  }, []);

  const startBackgroundMusic = React.useCallback(async () => {
    if (spotifyPlayingRef.current) return;
    if (lowPerformanceMode) return;
    if (document.hidden || !document.hasFocus()) {
      pendingMusicStartRef.current = true;
      return;
    }
    const audio = await ensureMusicSource(soundTheme);
    if (!audio) return;
    if (spotifyPlayingRef.current) return;

    if (musicAudioContextRef.current?.state === "suspended") {
      await musicAudioContextRef.current.resume().catch(() => {});
    }
    if (spotifyPlayingRef.current) return;

    if (!audio.paused) return;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        pendingMusicStartRef.current = false;
        fadeMusicTo(musicVolume / 100, 1800);
      })
      .catch(() => {
        pendingMusicStartRef.current = true;
      });
  }, [ensureMusicSource, fadeMusicTo, musicVolume, soundTheme, lowPerformanceMode]);

  const stopBackgroundMusic = React.useCallback(() => {
    const audio = musicRef.current;
    if (!audio || audio.paused) return;
    fadeMusicTo(0, 900, () => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, [fadeMusicTo]);

  const pauseBackgroundMusicForSpotify = React.useCallback(() => {
    clearMusicFade();
    pendingMusicStartRef.current = false;
    musicRef.current?.pause();
  }, [clearMusicFade]);

  React.useEffect(() => {
    const handleSpotifyPlayback = (event: Event) => {
      const playing = Boolean((event as CustomEvent<{ playing?: boolean }>).detail?.playing);
      spotifyPlayingRef.current = playing;
      if (playing) {
        pauseBackgroundMusicForSpotify();
      } else if (user?.uid && isIntroVisible === false) {
        void startBackgroundMusic();
      }
    };
    window.addEventListener("checkpoint:spotify-playback", handleSpotifyPlayback);
    return () => window.removeEventListener("checkpoint:spotify-playback", handleSpotifyPlayback);
  }, [isIntroVisible, pauseBackgroundMusicForSpotify, startBackgroundMusic, user?.uid]);

  React.useEffect(() => {
    if (lowPerformanceMode) {
      stopBackgroundMusic();
    }
  }, [lowPerformanceMode, stopBackgroundMusic]);

  React.useEffect(() => {
    if (loading) return;
    const currentUid = user?.uid ?? null;

    isBackendHealthy().catch(() => {});

    if (!currentUid) {
      completedIntroUserRef.current = null;
      setIsIntroVisible(null);
      if (musicStartTimerRef.current) {
        window.clearTimeout(musicStartTimerRef.current);
        musicStartTimerRef.current = null;
      }
      stopBackgroundMusic();
      return;
    }

    if (completedIntroUserRef.current !== currentUid) {
      setIsIntroVisible(true);
      return;
    }

    setIsIntroVisible(false);
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
    musicVolumeRef.current = musicVolume;
    const audio = musicRef.current;
    if (!audio || audio.paused) return;
    fadeMusicTo(musicVolume / 100, 450);
  }, [fadeMusicTo, musicVolume]);

  React.useEffect(() => {
    const audio = musicRef.current;
    const wasPlaying = Boolean(audio && !audio.paused);
    const transitionId = ++musicTransitionRef.current;

    const changeMusicSource = () => {
      if (transitionId !== musicTransitionRef.current) return;

      void ensureMusicSource(soundTheme).then((resolvedAudio) => {
        if (!resolvedAudio || transitionId !== musicTransitionRef.current) return;
        if (!wasPlaying) return;

        resolvedAudio.volume = 0;
        resolvedAudio.play().then(() => {
          if (transitionId !== musicTransitionRef.current) return;
          fadeMusicTo(musicVolumeRef.current / 100, 900);
        }).catch(() => {
          pendingMusicStartRef.current = true;
        });
      });
    };

    if (wasPlaying) {
      fadeMusicTo(0, 650, changeMusicSource);
    } else {
      changeMusicSource();
    }

    return () => {
      if (musicTransitionRef.current === transitionId) {
        musicTransitionRef.current += 1;
      }
    };
  }, [ensureMusicSource, fadeMusicTo, soundTheme]);

  React.useEffect(
    () => () => {
      clearMusicFade();
      if (musicStartTimerRef.current) {
        window.clearTimeout(musicStartTimerRef.current);
      }
      musicRef.current?.pause();
      void musicAudioContextRef.current?.close();
    },
    [clearMusicFade],
  );

  React.useEffect(() => {
    const handleFocus = () => {
      if (user?.uid && !loading && isIntroVisible === false) {
        startBackgroundMusic();
      }
    };
    const handleBlur = () => {
      const audio = musicRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [user?.uid, loading, isIntroVisible, startBackgroundMusic]);

  if (loading) {
    return <AsyncLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isIntroVisible === null) {
    return <AsyncLoader />;
  }

  return (
    <MotionConfig reducedMotion={lowPerformanceMode ? "always" : "never"}>
      <div className="fixed inset-0 h-dvh w-full select-none overflow-hidden overscroll-none">
        {isIntroVisible ? (
          <AnimatePresence mode="wait">
            <GameBootIntro
              key="boot-intro"
              onFinish={() => {
                completedIntroUserRef.current = user.uid;
                setIsIntroVisible(false);
                window.requestAnimationFrame(() => {
                  startBackgroundMusic();
                });
              }}
            />
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0">
            {!lowPerformanceMode && <MainVideoBackground />}
            <Home />
            <GamepadStatusOverlay />
            <ControllerVirtualKeyboard />
          </div>
        )}
      </div>
    </MotionConfig>
  );
};

const App: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <AppContent />
        </GamepadProvider>
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
);

export default App;
