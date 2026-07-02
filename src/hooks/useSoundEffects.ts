import { useCallback, useMemo, useRef } from "react";
import type { SoundTheme } from "../context/PreferencesContext";

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

const soundThemes = {
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
  },
};

export type SoundEffectType = keyof (typeof soundThemes)["ps2"];

export const useSoundEffects = (volume = 0.35, theme: SoundTheme = "ps2") => {
  const lastNavigateAtRef = useRef(0);
  const sounds = soundThemes[theme] ?? soundThemes.ps2;
  const soundPaths = useMemo(() => sounds, [sounds]);

  const playSound = useCallback(
    (type: SoundEffectType) => {
      if (type === "navigate") {
        const now = performance.now();
        if (now - lastNavigateAtRef.current < 85) return;
        lastNavigateAtRef.current = now;
      }
      const path = soundPaths[type];
      if (!path) return;
      const audio = new Audio(path);
      audio.volume = volume;
      audio.preload = "none";
      audio.play().catch(() => {
        return;
      });
    },
    [soundPaths, volume],
  );

  return { playSound };
};
