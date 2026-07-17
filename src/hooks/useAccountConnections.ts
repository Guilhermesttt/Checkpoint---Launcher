import { useState } from "react";
import { isBackendHealthy } from "../services/api";
import {
  disconnectSteamAccount,
  getSteamLinkUrl,
  syncSteamLibraryToLocal,
} from "../services/steam";
import {
  disconnectDiscordAccount,
  getDiscordLinkUrl,
} from "../services/discord";
import { deleteLibraryGamesByLauncher } from "../services/localLibrary";
import type { SoundEffectType } from "./useSoundEffects";

const steamDiscKey = (uid: string) => `checkpoint_steam_disconnected_${uid}`;
const steamIdKey = (uid: string) => `checkpoint_steam_id_${uid}`;

interface UseAccountConnectionsProps {
  userUid?: string;
  resolvedSteamId?: string | null;
  playSound: (type: SoundEffectType) => void;
  notify: (msg: string, type: "success" | "error" | "info") => void;
  refreshProfile: () => Promise<void>;
  setIsLoading: (val: boolean) => void;
  setSelectedIndex: (val: number) => void;
  onLibraryChanged?: () => Promise<void> | void;
}

export function useAccountConnections({
  userUid,
  resolvedSteamId,
  playSound,
  notify,
  refreshProfile,
  setIsLoading,
  setSelectedIndex,
  onLibraryChanged,
}: UseAccountConnectionsProps) {
  const [steamConnecting, setSteamConnecting] = useState(false);
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [steamSyncing, setSteamSyncing] = useState(false);

  const handleSyncSteam = async () => {
    if (!userUid || !resolvedSteamId) {
      notify("Conecte sua conta Steam para sincronizar.", "info");
      return;
    }
    const healthy = await isBackendHealthy();
    if (!healthy) {
      notify("Backend Steam offline.", "error");
      return;
    }
    setIsLoading(true);
    setSteamSyncing(true);
    try {
      const count = await syncSteamLibraryToLocal(userUid, resolvedSteamId);
      notify(
        count === 0
          ? "Nenhum jogo retornado. Verifique se o perfil é público."
          : `${count} jogos importados/atualizados.`,
        count === 0 ? "info" : "success",
      );
      await refreshProfile();
      await onLibraryChanged?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Falha na sincronização Steam.", "error");
    } finally {
      setSteamSyncing(false);
      setIsLoading(false);
    }
  };

  const connectSteam = () => {
    if (!userUid) return;
    playSound("select");
    setSteamConnecting(true);

    notify(
      "Iniciando conexão com Steam. Isso pode levar alguns segundos se o servidor estiver acordando...",
      "info",
    );

    isBackendHealthy().then(async (h) => {
      if (!h) {
        notify("O servidor Steam demorou demais para responder. Tente novamente em instantes.", "error");
        setSteamConnecting(false);
        return;
      }
      try {
        const url = await getSteamLinkUrl();
        if (window.electronAPI?.openExternalUrl) {
          await window.electronAPI.openExternalUrl(url);
          notify("Navegador aberto! Conecte sua conta Steam e volte ao app.", "info");
          setSteamConnecting(false);
        } else {
          window.location.href = url;
        }
      } catch (e) {
        notify(e instanceof Error ? e.message : "Não foi possível conectar com a Steam.", "error");
        setSteamConnecting(false);
      }
    });
  };

  const connectDiscord = () => {
    if (!userUid) return;
    playSound("select");
    setDiscordConnecting(true);

    isBackendHealthy().then(async (h) => {
      if (!h) {
        notify("Backend Discord offline.", "error");
        setDiscordConnecting(false);
        return;
      }
      try {
        const url = await getDiscordLinkUrl();
        if (window.electronAPI?.openExternalUrl) {
          await window.electronAPI.openExternalUrl(url);
          notify("Navegador aberto! Conecte sua conta Discord e volte ao app.", "info");
          setDiscordConnecting(false);
        } else {
          window.location.href = url;
        }
      } catch (e) {
        notify(e instanceof Error ? e.message : "Não foi possível conectar com o Discord.", "error");
        setDiscordConnecting(false);
      }
    });
  };

  const handleDisconnectSteam = async () => {
    if (!userUid) return;
    playSound("back");
    setIsLoading(true);
    try {
      await disconnectSteamAccount();
      await deleteLibraryGamesByLauncher(userUid, "steam");
      localStorage.removeItem(steamDiscKey(userUid));
      localStorage.removeItem(steamIdKey(userUid));
      await refreshProfile();
      setSelectedIndex(0);
      await onLibraryChanged?.();
      notify("Steam desconectada e biblioteca atualizada.", "success");
    } catch {
      notify("Erro ao desconectar conta Steam.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectDiscord = async () => {
    if (!userUid) return;
    try {
      await disconnectDiscordAccount();
      await refreshProfile();
      notify("Discord desconectado.", "success");
    } catch {
      notify("Erro ao desconectar Discord.", "error");
    }
  };

  return {
    steamConnecting,
    setSteamConnecting,
    discordConnecting,
    setDiscordConnecting,
    steamSyncing,
    connectSteam,
    connectDiscord,
    handleDisconnectSteam,
    handleDisconnectDiscord,
    handleSyncSteam,
  };
}
