import { useState, useEffect, useCallback } from "react";
import type { Game } from "../types/domain";

interface DiscordActivity {
  details?: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: Array<{
    label: string;
    url: string;
  }>;
  instance?: boolean;
}

interface RichPresenceConfig {
  applicationId: string;
  enabled: boolean;
}

class DiscordRichPresenceService {
  private config: RichPresenceConfig = {
    applicationId: import.meta.env.VITE_DISCORD_APPLICATION_ID || "1234567890123456789",
    enabled: false,
  };

  private currentActivity: DiscordActivity | null = null;
  private gameStartTime: number | null = null;
  private isConnected = false;

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.config.applicationId || this.config.applicationId === "1234567890123456789") {
        const changed = this.isConnected !== false || this.config.enabled !== false;
        this.isConnected = false;
        this.config.enabled = false;
        if (changed) this.notifyListeners();
        return false;
      }

      if (typeof window !== "undefined" && (window as any).DiscordSDK) {
        const changed = this.isConnected !== true || this.config.enabled !== true;
        this.isConnected = true;
        this.config.enabled = true;
        if (changed) this.notifyListeners();
        return true;
      }

      const changed = this.isConnected !== false || this.config.enabled !== false;
      this.isConnected = false;
      this.config.enabled = false;
      if (changed) this.notifyListeners();
      return false;
    } catch (error) {
      console.warn("Discord Rich Presence indisponivel:", error);
      const changed = this.isConnected !== false || this.config.enabled !== false;
      this.isConnected = false;
      this.config.enabled = false;
      if (changed) this.notifyListeners();
      return false;
    }
  }

  async setGameActivity(game: Game, status: "menu" | "playing" | "paused" = "playing"): Promise<void> {
    if (!this.config.enabled || !this.isConnected) return;

    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }

    const activity: DiscordActivity = {
      details: this.getGameDetails(game, status),
      state: this.getGameState(game, status),
      timestamps: {
        start: this.gameStartTime,
      },
      assets: {
        large_image: this.getGameImage(game),
        large_text: game.title,
        small_image: "checkpoint_logo",
        small_text: "Checkpoint Launcher",
      },
      buttons: [
        {
          label: "Ver no Checkpoint",
          url: `https://checkpoint-launcher.com/games/${game.id}`,
        },
      ],
      instance: false,
    };

    await this.updateActivity(activity);
  }

  async setBrowsingActivity(): Promise<void> {
    if (!this.config.enabled || !this.isConnected) return;

    const activity: DiscordActivity = {
      details: "Navegando na biblioteca",
      state: "Escolhendo o proximo jogo",
      assets: {
        large_image: "checkpoint_logo_large",
        large_text: "Checkpoint Launcher",
        small_image: "checkpoint_logo",
        small_text: "Organizando jogos",
      },
      buttons: [
        {
          label: "Baixar Checkpoint",
          url: "https://checkpoint-launcher.com",
        },
      ],
    };

    this.gameStartTime = null;
    await this.updateActivity(activity);
  }

  async clearActivity(): Promise<void> {
    if (!this.config.enabled || !this.isConnected) return;

    this.currentActivity = null;
    this.gameStartTime = null;

    try {
      if ((window as any).DiscordSDK) {
        await (window as any).DiscordSDK.commands.setActivity({ activity: null });
      }
    } catch (error) {
      console.warn("Erro ao limpar atividade Discord:", error);
    }
  }

  private async updateActivity(activity: DiscordActivity): Promise<void> {
    this.currentActivity = activity;

    try {
      if ((window as any).DiscordSDK) {
        await (window as any).DiscordSDK.commands.setActivity({ activity });
      }
    } catch (error) {
      console.error("Erro ao atualizar Discord Rich Presence:", error);
    }
  }

  private getGameDetails(game: Game, status: string): string {
    switch (status) {
      case "menu":
        return `No menu de ${game.title}`;
      case "paused":
        return `${game.title} (Pausado)`;
      case "playing":
      default:
        return `Jogando ${game.title}`;
    }
  }

  private getGameState(game: Game, status: string): string {
    const category = game.category || "Jogo";
    const platform =
      game.launcherType === "steam"
        ? "Steam"
        : game.launcherType === "epic"
          ? "Epic Games"
          : "Local";

    if (status === "paused") {
      return "Em pausa";
    }

    return `${category} • ${platform}`;
  }

  private getGameImage(game: Game): string {
    if (game.cardImage) return game.cardImage;
    if (game.image) return game.image;
    return "checkpoint_game_default";
  }

  setEnabled(enabled: boolean): void {
    const nextEnabled = enabled && this.isConnected;
    if (this.config.enabled !== nextEnabled) {
      this.config.enabled = nextEnabled;
      if (!this.config.enabled) {
        void this.clearActivity();
      }
      this.notifyListeners();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && this.isConnected;
  }

  getCurrentActivity(): DiscordActivity | null {
    return this.currentActivity;
  }
}

export const discordRichPresence = new DiscordRichPresenceService();

export const useDiscordRichPresence = () => {
  const [enabled, setEnabledState] = useState(() => discordRichPresence.isEnabled());

  useEffect(() => {
    const unsubscribe = discordRichPresence.subscribe(() => {
      setEnabledState(discordRichPresence.isEnabled());
    });
    return unsubscribe;
  }, []);

  return {
    setGameActivity: useCallback((game: Game, status: "menu" | "playing" | "paused" = "playing") => discordRichPresence.setGameActivity(game, status), []),
    setBrowsingActivity: useCallback(() => discordRichPresence.setBrowsingActivity(), []),
    clearActivity: useCallback(() => discordRichPresence.clearActivity(), []),
    setEnabled: useCallback((enabled: boolean) => discordRichPresence.setEnabled(enabled), []),
    isEnabled: enabled,
    getCurrentActivity: useCallback(() => discordRichPresence.getCurrentActivity(), []),
  };
};
