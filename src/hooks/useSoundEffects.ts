import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SoundTheme } from "../context/PreferencesContext";

import ps5PlusNavigateSound from "../sounds/PS5_Plus/deck_ui_navigation.wav";
import ps5PlusHoverSound from "../sounds/PS5_Plus/deck_ui_slider_down.wav";
import ps5PlusActivationSound from "../sounds/PS5_Plus/deck_ui_default_activation.wav";
import ps5PlusReturnSound from "../sounds/PS5_Plus/deck_ui_side_menu_fly_out.wav";
import ps5PlusHideModalSound from "../sounds/PS5_Plus/deck_ui_hide_modal.wav";
import ps5PlusSwitchOnSound from "../sounds/PS5_Plus/deck_ui_switch_toggle_on.wav";
import ps5PlusSwitchOffSound from "../sounds/PS5_Plus/deck_ui_switch_toggle_off.wav";
import ps5PlusOutOfGameDetailSound from "../sounds/PS5_Plus/deck_ui_out_of_game_detail.wav";
import ps5PlusLaunchGameSound from "../sounds/PS5_Plus/deck_ui_launch_game.wav";
import ps5PlusShowModalSound from "../sounds/PS5_Plus/deck_ui_show_modal.wav";
import ps5PlusIntoGameDetailSound from "../sounds/PS5_Plus/deck_ui_into_game_detail.wav";
import ps5PlusMessageToastSound from "../sounds/PS5_Plus/deck_ui_message_toast.wav";
import ps5PlusToastSound from "../sounds/PS5_Plus/deck_ui_toast.wav";
import ps5AchievementUnlockSound from "../sounds/PS5_Plus/deck_ui_achievement_toast.wav";

import ps4NavigateSound from "../sounds/PS4/deck_ui_navigation.wav";
import ps4ShowModalSound from "../sounds/PS4/deck_ui_show_modal.wav";
import ps4ReturnSound from "../sounds/PS4/deck_ui_side_menu_fly_out.wav";
import ps4FlyInSound from "../sounds/PS4/deck_ui_side_menu_fly_in.wav";
import ps4OutOfGameDetailSound from "../sounds/PS4/deck_ui_out_of_game_detail.wav";
import ps4LaunchGameSound from "../sounds/PS4/deck_ui_launch_game.wav";
import ps4IntoGameDetailSound from "../sounds/PS4/deck_ui_into_game_detail.wav";
import ps4ToastSound from "../sounds/PS4/deck_ui_toast.wav";
import ps4AchievementSound from "../sounds/PS4/21. Src27 Se Msg Trophy.mp3";
import ps4FriendRequestSound from "../sounds/PS4/02. Src1 Se Morpheus Noti.mp3";

import pspNavigateSound from "../sounds/PSP Sounds/deck_ui_navigation.wav";
import pspHoverSound from "../sounds/PSP Sounds/deck_ui_slider_down.wav";
import pspPositiveSound from "../sounds/PSP Sounds/confirmation_positive.wav";
import pspNegativeSound from "../sounds/PSP Sounds/confirmation_negative.wav";
import pspHideModalSound from "../sounds/PSP Sounds/deck_ui_hide_modal.wav";
import pspSwitchOnSound from "../sounds/PSP Sounds/deck_ui_switch_toggle_on.wav";
import pspSwitchOffSound from "../sounds/PSP Sounds/deck_ui_switch_toggle_off.wav";
import pspOutOfGameDetailSound from "../sounds/PSP Sounds/deck_ui_out_of_game_detail.wav";
import pspLaunchGameSound from "../sounds/PSP Sounds/deck_ui_launch_game.wav";
import pspShowModalSound from "../sounds/PSP Sounds/deck_ui_show_modal.wav";
import pspIntoGameDetailSound from "../sounds/PSP Sounds/deck_ui_into_game_detail.wav";
import pspToastSound from "../sounds/PSP Sounds/deck_ui_toast.wav";
import pspAchievementToastSound from "../sounds/PSP Sounds/deck_ui_achievement_toast.wav";

import xbPageRightSound from "../sounds/Xbox 360 UI/PageRight.wav";
import xbSelect2Sound from "../sounds/Xbox 360 UI/Select2.wav";
import xbSelectSound from "../sounds/Xbox 360 UI/Select.wav";
import xbBackSound from "../sounds/Xbox 360 UI/Back.wav";
import xbSelectASound from "../sounds/Xbox 360 UI/SelectA.wav";
import xbSelectA2Sound from "../sounds/Xbox 360 UI/SelectA2.wav";
import xbSelectBSound from "../sounds/Xbox 360 UI/SelectB.wav";
import xbStartupSound from "../sounds/Xbox 360 UI/Startup.wav";
import xbBingSound from "../sounds/Xbox 360 UI/Bing.wav";
import xbPageLeftSound from "../sounds/Xbox 360 UI/PageLeft.wav";
import xbAchievementSound from "../sounds/Xbox 360 UI/Achievement.wav";
import xbDownloadCompleteSound from "../sounds/Xbox 360 UI/dl_complete.wav";

import cyberpunkNavigateSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_navigation.wav";
import cyberpunkHoverSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_slider_down.wav";
import cyberpunkActivationSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_default_activation.wav";
import cyberpunkReturnSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_side_menu_fly_out.wav";
import cyberpunkHideModalSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_hide_modal.wav";
import cyberpunkSwitchOnSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_switch_toggle_on.wav";
import cyberpunkSwitchOffSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_switch_toggle_off.wav";
import cyberpunkOutOfGameDetailSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_out_of_game_detail.wav";
import cyberpunkLaunchGameSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_launch_game.wav";
import cyberpunkShowModalSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_show_modal.wav";
import cyberpunkIntoGameDetailSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_into_game_detail.wav";
import cyberpunkToastSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_toast.wav";
import cyberpunkAchievementToastSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_achievement_toast.wav";

import ps2NavigateSound from "../sounds/PS2 System Sounds/deck_ui_navigation.wav";
import ps2ClickSound from "../sounds/PS2 System Sounds/deck_ui_toast.wav";
import ps2ActivationSound from "../sounds/PS2 System Sounds/deck_ui_default_activation.wav";
import ps2ReturnSound from "../sounds/PS2 System Sounds/deck_ui_side_menu_fly_out.wav";
import ps2EditModalSound from "../sounds/PS2 System Sounds/deck_ui_hide_modal.wav";
import ps2FavoriteOnSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_on.wav";
import ps2FavoriteOffSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_off.wav";
import ps2DeleteSound from "../sounds/PS2 System Sounds/deck_ui_out_of_game_detail.wav";
import ps2PlaySoundEffect from "../sounds/PS2 System Sounds/deck_ui_achievement_toast.wav";
import ps2GameBootSound from "../sounds/PS2 System Sounds/deck_ui_launch_game.wav";
import ps2SearchSound from "../sounds/PS2 System Sounds/deck_ui_tab_transition_01.wav";
import ps2DetailOpenSound from "../sounds/PS2 System Sounds/deck_ui_into_game_detail.wav";

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
  ps5: {
    navigate: ps5PlusNavigateSound,
    hover: ps5PlusHoverSound,
    select: ps5PlusActivationSound,
    back: ps5PlusReturnSound,
    edit: ps5PlusHideModalSound,
    modalClose: ps5PlusHideModalSound,
    favoriteOn: ps5PlusSwitchOnSound,
    favoriteOff: ps5PlusSwitchOffSound,
    delete: ps5PlusOutOfGameDetailSound,
    play: ps5PlusLaunchGameSound,
    boot: ps5PlusLaunchGameSound,
    search: ps5PlusShowModalSound,
    detailOpen: ps5PlusIntoGameDetailSound,
    friendRequest: ps5PlusMessageToastSound,
    chatSent: ps5PlusActivationSound,
    chatReceived: ps5PlusMessageToastSound,
    switchOn: ps5PlusSwitchOnSound,
    switchOff: ps5PlusSwitchOffSound,
    screenshot: ps5PlusToastSound,
    showModal: ps5PlusShowModalSound,
    overlayAchievement: ps5AchievementUnlockSound,
  },
  ps4: {
    navigate: ps4NavigateSound,
    hover: ps4NavigateSound,
    select: ps4ShowModalSound,
    back: ps4ReturnSound,
    edit: ps4FlyInSound,
    modalClose: ps4ReturnSound,
    favoriteOn: ps4FlyInSound,
    favoriteOff: ps4ReturnSound,
    delete: ps4OutOfGameDetailSound,
    play: ps4LaunchGameSound,
    boot: ps4LaunchGameSound,
    search: ps4ShowModalSound,
    detailOpen: ps4IntoGameDetailSound,
    friendRequest: ps4FriendRequestSound,
    chatSent: ps4ShowModalSound,
    chatReceived: ps4ToastSound,
    switchOn: ps4FlyInSound,
    switchOff: ps4ReturnSound,
    screenshot: ps4ToastSound,
    showModal: ps4ShowModalSound,
    overlayAchievement: ps4AchievementSound,
  },
  psp: {
    navigate: pspNavigateSound,
    hover: pspHoverSound,
    select: pspPositiveSound,
    back: pspNegativeSound,
    edit: pspHideModalSound,
    modalClose: pspHideModalSound,
    favoriteOn: pspSwitchOnSound,
    favoriteOff: pspSwitchOffSound,
    delete: pspOutOfGameDetailSound,
    play: pspLaunchGameSound,
    boot: pspLaunchGameSound,
    search: pspShowModalSound,
    detailOpen: pspIntoGameDetailSound,
    friendRequest: pspToastSound,
    chatSent: pspPositiveSound,
    chatReceived: pspToastSound,
    switchOn: pspSwitchOnSound,
    switchOff: pspSwitchOffSound,
    screenshot: pspToastSound,
    showModal: pspShowModalSound,
    overlayAchievement: pspAchievementToastSound,
  },
  xbox360: {
    navigate: xbSelect2Sound,
    hover: xbSelect2Sound,
    select: xbSelectSound,
    back: xbPageRightSound,
    edit: xbSelectA2Sound,
    modalClose: xbBackSound,
    favoriteOn: xbSelectASound,
    favoriteOff: xbSelectBSound,
    delete: xbBackSound,
    play: xbSelectSound,
    boot: xbStartupSound,
    search: xbBingSound,
    detailOpen: xbPageLeftSound,
    friendRequest: xbAchievementSound,
    chatSent: xbSelectSound,
    chatReceived: xbAchievementSound,
    switchOn: xbSelectASound,
    switchOff: xbSelectBSound,
    screenshot: xbDownloadCompleteSound,
    showModal: xbSelectA2Sound,
    overlayAchievement: xbAchievementSound,
  },
  cyberpunk: {
    navigate: cyberpunkNavigateSound,
    hover: cyberpunkHoverSound,
    select: cyberpunkActivationSound,
    back: cyberpunkReturnSound,
    edit: cyberpunkHideModalSound,
    modalClose: cyberpunkHideModalSound,
    favoriteOn: cyberpunkSwitchOnSound,
    favoriteOff: cyberpunkSwitchOffSound,
    delete: cyberpunkOutOfGameDetailSound,
    play: cyberpunkLaunchGameSound,
    boot: cyberpunkLaunchGameSound,
    search: cyberpunkShowModalSound,
    detailOpen: cyberpunkIntoGameDetailSound,
    friendRequest: cyberpunkToastSound,
    chatSent: cyberpunkActivationSound,
    chatReceived: cyberpunkToastSound,
    switchOn: cyberpunkSwitchOnSound,
    switchOff: cyberpunkSwitchOffSound,
    screenshot: cyberpunkToastSound,
    showModal: cyberpunkShowModalSound,
    overlayAchievement: cyberpunkAchievementToastSound,
  },
  ps2: {
    navigate: ps2NavigateSound,
    hover: ps2NavigateSound,
    select: ps2ActivationSound,
    back: ps2ReturnSound,
    edit: ps2EditModalSound,
    modalClose: ps2EditModalSound,
    favoriteOn: ps2FavoriteOnSound,
    favoriteOff: ps2FavoriteOffSound,
    delete: ps2DeleteSound,
    play: ps2GameBootSound,
    boot: ps2GameBootSound,
    search: ps2SearchSound,
    detailOpen: ps2DetailOpenSound,
    friendRequest: ps2ClickSound,
    chatSent: ps2ActivationSound,
    chatReceived: ps2ClickSound,
    switchOn: ps2FavoriteOnSound,
    switchOff: ps2FavoriteOffSound,
    screenshot: ps2ClickSound,
    showModal: ps2SearchSound,
    overlayAchievement: ps2PlaySoundEffect,
  },
  gamecube: {
    navigate: gcHoverSound,
    hover: gcNavigateSound,
    select: gcClickSound,
    back: gcReturnSound,
    edit: gcEditModalSound,
    modalClose: gcEditModalSound,
    favoriteOn: gcFavoriteOnSound,
    favoriteOff: gcFavoriteOffSound,
    delete: gcDeleteSound,
    play: gcPlaySoundEffect,
    boot: gcGameBootSound,
    search: gcSearchSound,
    detailOpen: gcDetailOpenSound,
    friendRequest: gcSearchSound,
    chatSent: gcClickSound,
    chatReceived: gcSearchSound,
    switchOn: gcFavoriteOnSound,
    switchOff: gcFavoriteOffSound,
    screenshot: gcSearchSound,
    showModal: gcSearchSound,
    overlayAchievement: gcGameBootSound,
  },
};

export type SoundEffectType = keyof (typeof soundThemes)["ps5"];

const audioCache = new Map<string, HTMLAudioElement>();

const preloadAudio = (path: string) => {
  if (audioCache.has(path)) return audioCache.get(path);
  const audio = new Audio(path);
  audio.preload = "auto";
  audio.load();
  audioCache.set(path, audio);
  return audio;
};

export const useSoundEffects = (
  volume = 0.35,
  theme: SoundTheme = "ps5",
  notificationVolume = 0.4,
) => {
  const lastNavigateAtRef = useRef(0);
  const lastHoverAtRef = useRef(0);
  const activeAudiosRef = useRef(new Set<HTMLAudioElement>());
  const sounds = soundThemes[theme] ?? soundThemes.ps5;
  const soundPaths = useMemo(() => sounds, [sounds]);

  useEffect(() => {
    Array.from(new Set(Object.values(soundPaths))).forEach(preloadAudio);
  }, [soundPaths]);

  const stopActiveSounds = useCallback(() => {
    activeAudiosRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudiosRef.current.clear();
  }, []);

  useEffect(() => {
    const stopWhenInactive = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) {
        stopActiveSounds();
      }
    };

    window.addEventListener("blur", stopActiveSounds);
    document.addEventListener("visibilitychange", stopWhenInactive);
    return () => {
      window.removeEventListener("blur", stopActiveSounds);
      document.removeEventListener("visibilitychange", stopWhenInactive);
      stopActiveSounds();
    };
  }, [stopActiveSounds]);

  const playSound = useCallback(
    (type: SoundEffectType) => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;

      const now = performance.now();
      if (type === "navigate") {
        if (lastNavigateAtRef.current > 0 && now - lastNavigateAtRef.current < 85) return;
        lastNavigateAtRef.current = now;
      }
      if (type === "hover") {
        if (lastHoverAtRef.current > 0 && now - lastHoverAtRef.current < 70) return;
        lastHoverAtRef.current = now;
      }

      const path = soundPaths[type];
      if (!path) return;
      const cachedAudio = preloadAudio(path);
      const audio = cachedAudio?.cloneNode(true) as HTMLAudioElement | undefined;
      if (!audio) return;

      const isNotificationSound =
        type === "friendRequest" || type === "chatReceived" || type === "chatSent";
      audio.volume = isNotificationSound ? notificationVolume : volume;
      activeAudiosRef.current.add(audio);
      audio.addEventListener("ended", () => {
        activeAudiosRef.current.delete(audio);
      }, { once: true });
      audio.play().catch(() => {
        activeAudiosRef.current.delete(audio);
      });
    },
    [notificationVolume, soundPaths, volume],
  );

  return { playSound };
};
