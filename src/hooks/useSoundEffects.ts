import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SoundTheme } from "../context/PreferencesContext";

import ps5NavigateSound from "../sounds/PS5_Sounds/deck_ui_navigation.wav";
import ps5HoverSound from "../sounds/PS5_Sounds/deck_ui_slider_down.wav";
import ps5ClickSound from "../sounds/PS5_Sounds/deck_ui_default_activation.wav";
import ps5ReturnSound from "../sounds/PS5_Sounds/deck_ui_side_menu_fly_out.wav";
import ps5EditModalSound from "../sounds/PS5_Sounds/deck_ui_hide_modal.wav";
import ps5FavoriteOnSound from "../sounds/PS5_Sounds/deck_ui_switch_toggle_on.wav";
import ps5FavoriteOffSound from "../sounds/PS5_Sounds/deck_ui_switch_toggle_off.wav";
import ps5DeleteSound from "../sounds/PS5_Sounds/deck_ui_out_of_game_detail.wav";
import ps5PlaySoundEffect from "../sounds/PS5_Sounds/deck_ui_achievement_toast.wav";
import ps5GameBootSound from "../sounds/PS5_Sounds/deck_ui_launch_game.wav";
import ps5SearchSound from "../sounds/PS5_Sounds/deck_ui_show_modal.wav";
import ps5DetailOpenSound from "../sounds/PS5_Sounds/deck_ui_into_game_detail.wav";
import ps5MessageToastSound from "../sounds/PS5_Sounds/deck_ui_message_toast.wav";
import ps5AchievementUnlockSound from "../sounds/PS5_Sounds/Achievment_Unlock.mp3";

import ps2NavigateSound from "../sounds/PS2-System-Sounds/deck_ui_navigation.wav";
import ps2ClickSound from "../sounds/PS2-System-Sounds/deck_ui_toast.wav";
import ps2ReturnSound from "../sounds/PS2-System-Sounds/deck_ui_side_menu_fly_out.wav";
import ps2EditModalSound from "../sounds/PS2-System-Sounds/deck_ui_hide_modal.wav";
import ps2FavoriteOnSound from "../sounds/PS2-System-Sounds/deck_ui_switch_toggle_on.wav";
import ps2FavoriteOffSound from "../sounds/PS2-System-Sounds/deck_ui_switch_toggle_off.wav";
import ps2DeleteSound from "../sounds/PS2-System-Sounds/deck_ui_out_of_game_detail.wav";
import ps2PlaySoundEffect from "../sounds/PS2-System-Sounds/deck_ui_achievement_toast.wav";
import ps2GameBootSound from "../sounds/PS2-System-Sounds/deck_ui_launch_game.wav";
import ps2SearchSound from "../sounds/PS2-System-Sounds/deck_ui_tab_transition_01.wav";
import ps2DetailOpenSound from "../sounds/PS2-System-Sounds/deck_ui_into_game_detail.wav";

import gcNavigateSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_slider_down.wav";
import gcHoverSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_navigation.wav";
import gcClickSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_default_activation.wav";
import gcReturnSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_side_menu_fly_out.wav";
import gcEditModalSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_hide_modal.wav";
import gcFavoriteOnSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_slider_up.wav";
import gcFavoriteOffSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_slider_down.wav";
import gcDeleteSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_out_of_game_detail.wav";
import gcPlaySoundEffect from "../sounds/Nintendo GameCube Menu SFX/deck_ui_launch_game.wav";
import gcGameBootSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_launch_game.wav";
import gcSearchSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_show_modal.wav";
import gcDetailOpenSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_side_menu_fly_in.wav";

import xbNavigateSound from "../sounds/Xbox 360 Metro UI Sounds/PageRight.wav";
import xbHoverSound from "../sounds/Xbox 360 Metro UI Sounds/SliderDown.wav";
import xbClickSound from "../sounds/Xbox 360 Metro UI Sounds/Select.wav";
import xbReturnSound from "../sounds/Xbox 360 Metro UI Sounds/Back.wav";
import xbEditModalSound from "../sounds/Xbox 360 Metro UI Sounds/SelectA.wav";
import xbFavoriteOnSound from "../sounds/Xbox 360 Metro UI Sounds/RareAchievementStart.wav";
import xbFavoriteOffSound from "../sounds/Xbox 360 Metro UI Sounds/Back2.wav";
import xbDeleteSound from "../sounds/Xbox 360 Metro UI Sounds/Unknown1.wav";
import xbPlaySoundEffect from "../sounds/Xbox 360 Metro UI Sounds/Achievement.wav";
import xbGameBootSound from "../sounds/Xbox 360 Metro UI Sounds/Launch.wav";
import xbSearchSound from "../sounds/Xbox 360 Metro UI Sounds/Bing.wav";
import xbDetailOpenSound from "../sounds/Xbox 360 Metro UI Sounds/PageLeft.wav";

const soundThemes = {
  ps5: {
    navigate: ps5NavigateSound,
    hover: ps5HoverSound,
    select: ps5ClickSound,
    back: ps5ReturnSound,
    edit: ps5EditModalSound,
    modalClose: ps5EditModalSound,
    favoriteOn: ps5FavoriteOnSound,
    favoriteOff: ps5FavoriteOffSound,
    delete: ps5DeleteSound,
    play: ps5PlaySoundEffect,
    boot: ps5GameBootSound,
    search: ps5SearchSound,
    detailOpen: ps5DetailOpenSound,
    friendRequest: ps5MessageToastSound,
    showModal: ps5SearchSound,
    overlayAchievement: ps5AchievementUnlockSound,
  },
  ps2: {
    navigate: ps2NavigateSound,
    hover: ps2NavigateSound,
    select: ps2ClickSound,
    back: ps2ReturnSound,
    edit: ps2EditModalSound,
    modalClose: ps2EditModalSound,
    favoriteOn: ps2FavoriteOnSound,
    favoriteOff: ps2FavoriteOffSound,
    delete: ps2DeleteSound,
    play: ps2PlaySoundEffect,
    boot: ps2GameBootSound,
    search: ps2SearchSound,
    detailOpen: ps2DetailOpenSound,
    friendRequest: ps5MessageToastSound,
    showModal: ps2SearchSound,
    overlayAchievement: ps5AchievementUnlockSound,
  },
  gamecube: {
    navigate: gcNavigateSound,
    hover: gcHoverSound,
    select: gcClickSound,
    back: gcReturnSound,
    edit: gcEditModalSound,
    modalClose: gcDeleteSound,
    favoriteOn: gcFavoriteOnSound,
    favoriteOff: gcFavoriteOffSound,
    delete: gcDeleteSound,
    play: gcPlaySoundEffect,
    boot: gcGameBootSound,
    search: gcSearchSound,
    detailOpen: gcDetailOpenSound,
    friendRequest: ps5MessageToastSound,
    showModal: gcSearchSound,
    overlayAchievement: ps5AchievementUnlockSound,
  },
  xbox360: {
    navigate: xbNavigateSound,
    hover: xbHoverSound,
    select: xbClickSound,
    back: xbReturnSound,
    edit: xbEditModalSound,
    modalClose: xbReturnSound,
    favoriteOn: xbGameBootSound,
    favoriteOff: xbFavoriteOffSound,
    delete: xbDeleteSound,
    play: xbFavoriteOnSound,
    boot: xbGameBootSound,
    search: xbSearchSound,
    detailOpen: xbDetailOpenSound,
    friendRequest: ps5MessageToastSound,
    showModal: xbSearchSound,
    overlayAchievement: ps5AchievementUnlockSound,
  },
};

export type SoundEffectType = keyof (typeof soundThemes)["ps2"];

const audioCache = new Map<string, HTMLAudioElement>();
const allSoundPaths = Array.from(
  new Set(Object.values(soundThemes).flatMap((themeSounds) => Object.values(themeSounds))),
);

const preloadAudio = (path: string) => {
  if (audioCache.has(path)) return audioCache.get(path);
  const audio = new Audio(path);
  audio.preload = "auto";
  audio.load();
  audioCache.set(path, audio);
  return audio;
};

export const useSoundEffects = (volume = 0.35, theme: SoundTheme = "ps2") => {
  const lastNavigateAtRef = useRef(0);
  const sounds = soundThemes[theme] ?? soundThemes.ps2;
  const soundPaths = useMemo(() => sounds, [sounds]);

  useEffect(() => {
    allSoundPaths.forEach(preloadAudio);
  }, []);

  const playSound = useCallback(
    (type: SoundEffectType) => {
      if (type === "navigate") {
        const now = performance.now();
        if (now - lastNavigateAtRef.current < 85) return;
        lastNavigateAtRef.current = now;
      }
      const path = soundPaths[type];
      if (!path) return;
      const cachedAudio = preloadAudio(path);
      const audio = cachedAudio?.cloneNode(true) as HTMLAudioElement | undefined;
      if (!audio) return;
      audio.volume = volume;
      audio.play().catch(() => {
        return;
      });
    },
    [soundPaths, volume],
  );

  return { playSound };
};
