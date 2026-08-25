import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SoundTheme } from "../context/PreferencesContext";

import phelieriumSelectSound from "../sounds/Phelierium Default/ui_select.mp3";
import phelieriumClickSound from "../sounds/Phelierium Default/ui_click.mp3";
import phelieriumAlertSound from "../sounds/Phelierium Default/ui_alert.mp3";
import phelieriumNotificationSound from "../sounds/Phelierium Default/ui_notification.mp3";
import phelieriumFriendshipSound from "../sounds/Phelierium Default/ui_friendshipsent.mp3";
import phelieriumOpenDetailSound from "../sounds/Phelierium Default/ui_open_game_detail.mp3";
import phelieriumCloseDetailSound from "../sounds/Phelierium Default/ui_close_game_detail.mp3";
import phelieriumEditSound from "../sounds/Phelierium Default/ui_edit_game.mp3";
import phelieriumDeepSelectSound from "../sounds/Phelierium Default/ui_deep_selection.mp3";
import phelieriumAchievementSound from "../sounds/Phelierium Default/Achievment_Unlock.mp3";
import phelieriumUiAchievementSound from "../sounds/Phelierium Default/ui_achievment.mp3";
import phelieriumCallEnterSound from "../sounds/Phelierium Default/ui_call_enter.mp3";

import ps5PlusNavigateSound from "../sounds/PS5_Plus/deck_ui_navigation.wav";
import ps5PlusHoverSound from "../sounds/PS5_Plus/deck_ui_slider_down.wav";
import ps5PlusActivationSound from "../sounds/PS5_Plus/deck_ui_default_activation.wav";
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
import pspHideModalSound from "../sounds/PSP Sounds/deck_ui_hide_modal.wav";
import pspSwitchOnSound from "../sounds/PSP Sounds/deck_ui_switch_toggle_on.wav";
import pspSwitchOffSound from "../sounds/PSP Sounds/deck_ui_switch_toggle_off.wav";
import pspOutOfGameDetailSound from "../sounds/PSP Sounds/deck_ui_out_of_game_detail.wav";
import pspLaunchGameSound from "../sounds/PSP Sounds/deck_ui_launch_game.wav";
import pspShowModalSound from "../sounds/PSP Sounds/deck_ui_show_modal.wav";
import pspIntoGameDetailSound from "../sounds/PSP Sounds/deck_ui_into_game_detail.wav";
import pspToastSound from "../sounds/PSP Sounds/deck_ui_toast.wav";
import pspAchievementToastSound from "../sounds/PSP Sounds/deck_ui_achievement_toast.wav";

import xbNavigateSound from "../sounds/Xbox One/deck_ui_navigation.wav";
import xbHoverSound from "../sounds/Xbox One/deck_ui_slider_down.wav";
import xbActivationSound from "../sounds/Xbox One/deck_ui_default_activation.wav";
import xbBackSound from "../sounds/Xbox One/deck_ui_out_of_game_detail.wav";
import xbEditModalSound from "../sounds/Xbox One/deck_ui_hide_modal.wav";
import xbFavoriteOnSound from "../sounds/Xbox One/deck_ui_slider_up.wav";
import xbFavoriteOffSound from "../sounds/Xbox One/deck_ui_slider_down.wav";
import xbDetailOpenSound from "../sounds/Xbox One/deck_ui_into_game_detail.wav";
import xbLaunchGameSound from "../sounds/Xbox One/deck_ui_launch_game.wav";
import xbShowModalSound from "../sounds/Xbox One/deck_ui_show_modal.wav";
import xbToastSound from "../sounds/Xbox One/deck_ui_toast.wav";
import xbAchievementSound from "../sounds/Xbox One/deck_ui_achievement_toast.wav";
import xbFriendJoinSound from "../sounds/Xbox One/ui_steam_smoother_friend_online.m4a";
import xbChatReceivedSound from "../sounds/Xbox One/steam_at_mention.m4a";

import cyberpunkNavigateSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_navigation.wav";
import cyberpunkHoverSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_slider_down.wav";
import cyberpunkActivationSound from "../sounds/Cyberpunk 2077 UI SFX PACK/deck_ui_default_activation.wav";
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
import ps2HoverSound from "../sounds/PS2 System Sounds/deck_ui_misc_10.wav";
import ps2ActivationSound from "../sounds/PS2 System Sounds/deck_ui_default_activation.wav";
import ps2BackSound from "../sounds/PS2 System Sounds/deck_ui_out_of_game_detail.wav";
import ps2EditModalSound from "../sounds/PS2 System Sounds/deck_ui_hide_modal.wav";
import ps2FavoriteOnSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_on.wav";
import ps2FavoriteOffSound from "../sounds/PS2 System Sounds/deck_ui_switch_toggle_off.wav";
import ps2AchievementSound from "../sounds/PS2 System Sounds/deck_ui_achievement_toast.wav";
import ps2LaunchGameSound from "../sounds/PS2 System Sounds/deck_ui_launch_game.wav";
import ps2ShowModalSound from "../sounds/PS2 System Sounds/deck_ui_show_modal.wav";
import ps2DetailOpenSound from "../sounds/PS2 System Sounds/deck_ui_into_game_detail.wav";
import ps2ToastSound from "../sounds/PS2 System Sounds/deck_ui_toast.wav";

import gcNavigateSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_navigation.wav";
import gcHoverSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_slider_down.wav";
import gcActivationSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_default_activation.wav";
import gcFlyOutSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_side_menu_fly_out.wav";
import gcEditModalSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_hide_modal.wav";
import gcFavoriteSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_misc_10.wav";
import gcDetailOpenSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_side_menu_fly_in.wav";
import gcOpenPhotosSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_into_game_detail.wav";
import gcClosePhotosSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_out_of_game_detail.wav";
import gcLaunchGameSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_launch_game.wav";
import gcShowModalSound from "../sounds/Nintendo GameCube Menu SFX/deck_ui_show_modal.wav";

const soundThemes = {
  default: {
    navigate: phelieriumClickSound,
    hover: phelieriumClickSound,
    select: phelieriumSelectSound,
    back: phelieriumCloseDetailSound,
    edit: phelieriumEditSound,
    modalClose: phelieriumAlertSound,
    favoriteOn: phelieriumDeepSelectSound,
    favoriteOff: phelieriumDeepSelectSound,
    delete: phelieriumAlertSound,
    play: phelieriumCallEnterSound,
    boot: phelieriumCallEnterSound,
    search: phelieriumSelectSound,
    detailOpen: phelieriumOpenDetailSound,
    friendRequest: phelieriumFriendshipSound,
    chatSent: phelieriumSelectSound,
    chatReceived: phelieriumNotificationSound,
    switchOn: phelieriumDeepSelectSound,
    switchOff: phelieriumDeepSelectSound,
    screenshot: phelieriumUiAchievementSound,
    showModal: phelieriumSelectSound,
    overlayAchievement: phelieriumAchievementSound,
  },
  ps5: {
    navigate: ps5PlusNavigateSound,
    hover: ps5PlusHoverSound,
    select: ps5PlusActivationSound,
    back: ps5PlusOutOfGameDetailSound,
    edit: ps5PlusHideModalSound,
    modalClose: ps5PlusOutOfGameDetailSound,
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
    back: ps4OutOfGameDetailSound,
    edit: ps4FlyInSound,
    modalClose: ps4OutOfGameDetailSound,
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
    back: pspOutOfGameDetailSound,
    edit: pspHideModalSound,
    modalClose: pspOutOfGameDetailSound,
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
    navigate: xbNavigateSound,
    hover: xbHoverSound,
    select: xbActivationSound,
    back: xbBackSound,
    edit: xbEditModalSound,
    modalClose: xbBackSound,
    favoriteOn: xbFavoriteOnSound,
    favoriteOff: xbFavoriteOffSound,
    delete: xbBackSound,
    play: xbLaunchGameSound,
    boot: xbLaunchGameSound,
    search: xbShowModalSound,
    detailOpen: xbDetailOpenSound,
    friendRequest: xbFriendJoinSound,
    chatSent: xbActivationSound,
    chatReceived: xbChatReceivedSound,
    switchOn: xbFavoriteOnSound,
    switchOff: xbFavoriteOffSound,
    screenshot: xbToastSound,
    showModal: xbShowModalSound,
    overlayAchievement: xbAchievementSound,
  },
  cyberpunk: {
    navigate: cyberpunkNavigateSound,
    hover: cyberpunkHoverSound,
    select: cyberpunkActivationSound,
    back: cyberpunkOutOfGameDetailSound,
    edit: cyberpunkHideModalSound,
    modalClose: cyberpunkOutOfGameDetailSound,
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
    hover: ps2HoverSound,
    select: ps2ActivationSound,
    back: ps2BackSound,
    edit: ps2EditModalSound,
    modalClose: ps2BackSound,
    favoriteOn: ps2FavoriteOnSound,
    favoriteOff: ps2FavoriteOffSound,
    delete: ps2BackSound,
    play: ps2LaunchGameSound,
    boot: ps2LaunchGameSound,
    search: ps2ShowModalSound,
    detailOpen: ps2DetailOpenSound,
    friendRequest: ps2ToastSound,
    chatSent: ps2ActivationSound,
    chatReceived: ps2ToastSound,
    switchOn: ps2FavoriteOnSound,
    switchOff: ps2FavoriteOffSound,
    screenshot: ps2ToastSound,
    showModal: ps2ShowModalSound,
    overlayAchievement: ps2AchievementSound,
  },
  gamecube: {
    navigate: gcNavigateSound,
    hover: gcHoverSound,
    select: gcActivationSound,
    // Fechar painel de detalhes
    back: gcFlyOutSound,
    edit: gcEditModalSound,
    // Fechar painel de detalhes
    modalClose: gcFlyOutSound,
    // Favoritar / desfavoritar
    favoriteOn: gcFavoriteSound,
    favoriteOff: gcFavoriteSound,
    delete: gcClosePhotosSound,
    play: gcLaunchGameSound,
    boot: gcLaunchGameSound,
    search: gcShowModalSound,
    // Abrir painel de detalhes
    detailOpen: gcDetailOpenSound,
    // Mensagens, pedidos de amizade, notificacoes
    friendRequest: gcShowModalSound,
    chatSent: gcFavoriteSound,
    chatReceived: gcShowModalSound,
    // Abrir fotos
    switchOn: gcOpenPhotosSound,
    // Fechar fotos
    switchOff: gcClosePhotosSound,
    screenshot: gcShowModalSound,
    showModal: gcShowModalSound,
    // Conquistas
    overlayAchievement: gcEditModalSound,
  },
};

export type SoundEffectType = keyof (typeof soundThemes)["ps5"];

const audioCache = new Map<string, HTMLAudioElement>();
const notificationSoundTypes = new Set<SoundEffectType>([
  "friendRequest",
  "chatReceived",
  "chatSent",
]);

const isNotificationSoundType = (type: SoundEffectType) =>
  notificationSoundTypes.has(type);

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
  theme: SoundTheme = "default",
  notificationVolume = 0.4,
) => {
  const lastNavigateAtRef = useRef(0);
  const lastHoverAtRef = useRef(0);
  const activeAudiosRef = useRef(new Set<HTMLAudioElement>());
  const activeNotificationAudiosRef = useRef(new Set<HTMLAudioElement>());
  const sounds = soundThemes[theme] ?? soundThemes.default ?? soundThemes.ps5;
  const soundPaths = useMemo(() => sounds, [sounds]);

  useEffect(() => {
    Array.from(new Set(Object.values(soundPaths))).forEach(preloadAudio);
  }, [soundPaths]);

  const stopActiveSounds = useCallback((includeNotifications = false) => {
    activeAudiosRef.current.forEach((audio) => {
      if (!includeNotifications && activeNotificationAudiosRef.current.has(audio)) return;
      audio.pause();
      audio.currentTime = 0;
      activeAudiosRef.current.delete(audio);
      activeNotificationAudiosRef.current.delete(audio);
    });
  }, []);

  useEffect(() => {
    const stopInterfaceSounds = () => stopActiveSounds();
    const stopWhenInactive = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) {
        stopInterfaceSounds();
      }
    };

    window.addEventListener("blur", stopInterfaceSounds);
    document.addEventListener("visibilitychange", stopWhenInactive);
    return () => {
      window.removeEventListener("blur", stopInterfaceSounds);
      document.removeEventListener("visibilitychange", stopWhenInactive);
      stopActiveSounds(true);
    };
  }, [stopActiveSounds]);

  const playSound = useCallback(
    (type: SoundEffectType) => {
      const isNotificationSound = isNotificationSoundType(type);
      if (
        !isNotificationSound
        && (document.visibilityState !== "visible" || !document.hasFocus())
      ) return;

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

      audio.volume = isNotificationSound ? notificationVolume : volume;
      activeAudiosRef.current.add(audio);
      if (isNotificationSound) activeNotificationAudiosRef.current.add(audio);
      audio.addEventListener("ended", () => {
        activeAudiosRef.current.delete(audio);
        activeNotificationAudiosRef.current.delete(audio);
      }, { once: true });
      audio.play().catch(() => {
        activeAudiosRef.current.delete(audio);
        activeNotificationAudiosRef.current.delete(audio);
      });
    },
    [notificationVolume, soundPaths, volume],
  );

  return { playSound };
};
