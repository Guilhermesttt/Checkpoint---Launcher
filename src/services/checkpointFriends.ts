import { supabase } from "./supabase";
import type { Game, UserProfile } from "../types/domain";
import { apiUrl } from "./api";
import { broadcastPresenceStatus } from "./realtimeEventBus";

const getAuthHeaders = async () => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error("Sessao expirada. Entre novamente.");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
};

export const searchCheckpointFriends = async (query: string, signal?: AbortSignal): Promise<UserProfile[]> => {
  const response = await fetch(apiUrl(`/api/friends/search?q=${encodeURIComponent(query)}`), {
    headers: await getAuthHeaders(),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    users?: UserProfile[];
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao buscar usuarios.");
  }
  return payload.users ?? [];
};

export const sendCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/request"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao enviar solicitacao.");
  }
};

export const acceptCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/accept"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    friend?: UserProfile;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao aceitar solicitacao.");
  }
  return payload.friend;
};

export const rejectCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/reject"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao rejeitar solicitacao.");
  }
};

export const removeCheckpointFriend = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/unfriend"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao remover amigo.");
  }
};

export const updateCheckpointPresence = async (
  status: "online" | "playing" | "offline",
  currentGameTitle?: string,
) => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) {
    throw new Error("Sessao expirada. Entre novamente.");
  }

  // Fast-path via WebSocket Realtime Broadcast
  void broadcastPresenceStatus({
    uid: session.user.id,
    displayName: session.user.user_metadata?.displayName || session.user.email?.split("@")[0] || "Gamer",
    photoURL: session.user.user_metadata?.photoURL || null,
    status,
    playing: currentGameTitle || null,
    updatedAt: Date.now(),
  }).catch(() => {});

  const response = await fetch(apiUrl("/api/presence"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status, currentGameTitle }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao atualizar presenca.");
  }
};

export const getCheckpointFriendStatuses = async (): Promise<UserProfile[]> => {
  const response = await fetch(apiUrl("/api/friends/status"), {
    headers: await getAuthHeaders(),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    friends?: UserProfile[];
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao consultar presenca dos amigos.");
  }
  return payload.friends ?? [];
};

export const getCheckpointFriendProfile = async (
  uid: string,
): Promise<{ profile: UserProfile; games: Game[] }> => {
  const response = await fetch(apiUrl(`/api/friends/${encodeURIComponent(uid)}/profile`), {
    headers: await getAuthHeaders(),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    profile?: UserProfile;
    games?: Game[];
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao carregar perfil do amigo.");
  }
  if (!payload.profile) {
    throw new Error("Perfil do amigo nao encontrado.");
  }
  return {
    profile: payload.profile,
    games: payload.games ?? [],
  };
};
