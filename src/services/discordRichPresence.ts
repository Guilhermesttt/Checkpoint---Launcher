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
    applicationId: "1234567890123456789", // TODO: Registrar app no Discord Developer Portal
    enabled: false
  };
  
  private currentActivity: DiscordActivity | null = null;
  private gameStartTime: number | null = null;
  private isConnected = false;

  async initialize(): Promise<boolean> {
    try {
      // Verificar se Discord está disponível (via RPC ou SDK web)
      if (typeof window !== 'undefined' && (window as any).DiscordSDK) {
        this.isConnected = true;
        this.config.enabled = true;
        console.log('Discord Rich Presence inicializado');
        return true;
      }
      
      // Fallback: tentar conectar via WebRPC se disponível
      await this.tryWebRPCConnection();
      return this.isConnected;
    } catch (error) {
      console.log('Discord Rich Presence não disponível:', error);
      return false;
    }
  }

  private async tryWebRPCConnection(): Promise<void> {
    // Implementação futura para WebRPC
    // Por enquanto, simular conexão para desenvolvimento
    this.isConnected = true;
    this.config.enabled = true;
  }

  async setGameActivity(game: Game, status: 'menu' | 'playing' | 'paused' = 'playing'): Promise<void> {
    if (!this.config.enabled || !this.isConnected) {
      console.log('Discord Rich Presence não habilitado');
      return;
    }

    // Iniciar timer se for nova sessão de jogo
    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }

    const activity: DiscordActivity = {
      details: this.getGameDetails(game, status),
      state: this.getGameState(game, status),
      timestamps: {
        start: this.gameStartTime
      },
      assets: {
        large_image: this.getGameImage(game),
        large_text: game.title,
        small_image: 'checkpoint_logo',
        small_text: 'Checkpoint Launcher'
      },
      buttons: [
        {
          label: 'Ver no Checkpoint',
          url: `https://checkpoint-launcher.com/games/${game.id}`
        }
      ],
      instance: false
    };

    await this.updateActivity(activity);
  }

  async setBrowsingActivity(): Promise<void> {
    if (!this.config.enabled || !this.isConnected) return;

    const activity: DiscordActivity = {
      details: 'Navegando na biblioteca',
      state: 'Escolhendo o próximo jogo',
      assets: {
        large_image: 'checkpoint_logo_large',
        large_text: 'Checkpoint Launcher',
        small_image: 'checkpoint_logo',
        small_text: 'Organizando jogos'
      },
      buttons: [
        {
          label: 'Baixar Checkpoint',
          url: 'https://checkpoint-launcher.com'
        }
      ]
    };

    // Reset game timer
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
      console.log('Erro ao limpar atividade Discord:', error);
    }
  }

  private async updateActivity(activity: DiscordActivity): Promise<void> {
    this.currentActivity = activity;
    
    try {
      // Simular chamada para desenvolvimento
      console.log('🎮 Discord Rich Presence Update:', {
        details: activity.details,
        state: activity.state,
        image: activity.assets?.large_image,
        startTime: activity.timestamps?.start
      });

      // TODO: Implementar chamada real para Discord SDK
      // if ((window as any).DiscordSDK) {
      //   await (window as any).DiscordSDK.commands.setActivity({ activity });
      // }
    } catch (error) {
      console.error('Erro ao atualizar Discord Rich Presence:', error);
    }
  }

  private getGameDetails(game: Game, status: string): string {
    switch (status) {
      case 'menu':
        return `No menu de ${game.title}`;
      case 'paused':
        return `${game.title} (Pausado)`;
      case 'playing':
      default:
        return `Jogando ${game.title}`;
    }
  }

  private getGameState(game: Game, status: string): string {
    const category = game.category || 'Jogo';
    const platform = game.launcherType === 'steam' ? 'Steam' : 
                     game.launcherType === 'epic' ? 'Epic Games' : 'Local';
    
    if (status === 'paused') {
      return 'Em pausa';
    }
    
    return `${category} • ${platform}`;
  }

  private getGameImage(game: Game): string {
    // Usar imagem do jogo se disponível, senão logo do Checkpoint
    if (game.cardImage) {
      return game.cardImage;
    }
    if (game.image) {
      return game.image;
    }
    return 'checkpoint_game_default';
  }

  // Configurações do usuário
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clearActivity();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && this.isConnected;
  }

  getCurrentActivity(): DiscordActivity | null {
    return this.currentActivity;
  }
}

// Singleton instance
export const discordRichPresence = new DiscordRichPresenceService();

// Hook para usar no React
export const useDiscordRichPresence = () => {
  return {
    setGameActivity: discordRichPresence.setGameActivity.bind(discordRichPresence),
    setBrowsingActivity: discordRichPresence.setBrowsingActivity.bind(discordRichPresence),
    clearActivity: discordRichPresence.clearActivity.bind(discordRichPresence),
    setEnabled: discordRichPresence.setEnabled.bind(discordRichPresence),
    isEnabled: discordRichPresence.isEnabled.bind(discordRichPresence),
    getCurrentActivity: discordRichPresence.getCurrentActivity.bind(discordRichPresence)
  };
};