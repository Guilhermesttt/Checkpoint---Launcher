import { apiUrl } from "./api";
import { supabase } from "./supabase";

export type RetroAchievementsErrorCode =
  | "RA_NOT_CONFIGURED"
  | "RA_INVALID_USERNAME"
  | "RA_NOT_LINKED"
  | "RA_UNSUPPORTED_CONSOLE"
  | "RA_UPSTREAM_UNAVAILABLE"
  | "RA_INVALID_RESPONSE";

export interface RetroAchievementsIdentity {
  ulid: string;
  username: string;
  avatarUrl?: string;
  totalPoints: number;
}

export interface RetroAchievementsGameMatch {
  id: number;
  title: string;
  consoleId: number;
  consoleName: string;
  imageUrl?: string;
  achievementCount: number;
  points: number;
}

export interface RetroAchievement {
  id: number;
  title: string;
  description: string;
  points: number;
  badgeUrl?: string;
  badgeLockedUrl?: string;
  displayOrder: number;
  unlocked: boolean;
  unlockedHardcore: boolean;
  dateEarned?: string;
  dateEarnedHardcore?: string;
}

export interface RetroAchievementsProgress {
  game: {
    id: number;
    title: string;
    consoleName: string;
    imageUrl?: string;
  };
  summary: {
    total: number;
    normalUnlocked: number;
    hardcoreUnlocked: number;
    normalPercent: number;
    hardcorePercent: number;
    userTotalPlaytime: number;
    highestAwardKind?: string;
    highestAwardDate?: string;
  };
  achievements: RetroAchievement[];
  source: "fresh" | "cached" | "stale";
}

export class RetroAchievementsRequestError extends Error {
  code?: RetroAchievementsErrorCode;

  constructor(message: string, code?: RetroAchievementsErrorCode) {
    super(message);
    this.name = "RetroAchievementsRequestError";
    this.code = code;
  }
}

const getAuthHeaders = async (withJson = false) => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    throw new RetroAchievementsRequestError(
      "Sessão expirada. Entre novamente para usar a RetroAchievements.",
    );
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(withJson ? { "Content-Type": "application/json" } : {}),
  };
};

const readPayload = async <T>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    code?: RetroAchievementsErrorCode;
  } & T;
  if (!response.ok) {
    throw new RetroAchievementsRequestError(
      payload.error || "Não foi possível consultar a RetroAchievements.",
      payload.code,
    );
  }
  return payload;
};

export const linkRetroAchievements = async (
  username: string,
): Promise<RetroAchievementsIdentity> => {
  const response = await fetch(apiUrl("/api/retroachievements/link"), {
    method: "POST",
    headers: await getAuthHeaders(true),
    body: JSON.stringify({ username: username.trim() }),
  });
  const payload = await readPayload<{ identity?: RetroAchievementsIdentity }>(response);
  if (!payload.identity?.ulid || !payload.identity.username) {
    throw new RetroAchievementsRequestError(
      "A RetroAchievements retornou uma identidade inválida.",
      "RA_INVALID_RESPONSE",
    );
  }
  return payload.identity;
};

export const disconnectRetroAchievements = async (): Promise<void> => {
  const response = await fetch(apiUrl("/api/retroachievements/link"), {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  await readPayload<{ ok?: boolean }>(response);
};

export const searchRetroAchievementGames = async (
  title: string,
  consoleName: string,
): Promise<RetroAchievementsGameMatch[]> => {
  const query = new URLSearchParams({
    title: title.trim(),
    console: consoleName.trim(),
  });
  const response = await fetch(
    apiUrl(`/api/retroachievements/games/search?${query.toString()}`),
    { headers: await getAuthHeaders() },
  );
  const payload = await readPayload<{ results?: RetroAchievementsGameMatch[] }>(response);
  return Array.isArray(payload.results) ? payload.results : [];
};

export const getRetroAchievementProgress = async (
  gameId: number,
): Promise<RetroAchievementsProgress> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new RetroAchievementsRequestError(
      "ID de jogo RetroAchievements inválido.",
      "RA_INVALID_RESPONSE",
    );
  }
  const response = await fetch(
    apiUrl(`/api/retroachievements/games/${gameId}/progress`),
    { headers: await getAuthHeaders() },
  );
  return readPayload<RetroAchievementsProgress>(response);
};
