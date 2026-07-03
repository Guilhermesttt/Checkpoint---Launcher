import { auth } from "../../Firebase";
import type { UserProfile } from "../types/domain";
import { apiUrl } from "./api";

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessao expirada. Entre novamente.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

export const searchCheckpointFriends = async (query: string): Promise<UserProfile[]> => {
  const response = await fetch(
    apiUrl(`/api/friends/search?q=${encodeURIComponent(query)}`),
    { headers: await getAuthHeaders() },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao buscar usuarios.");
  }
  const payload = (await response.json()) as { users?: UserProfile[] };
  return payload.users ?? [];
};

export const sendCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/request"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao enviar solicitacao.");
  }
};

export const acceptCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/accept"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao aceitar solicitacao.");
  }
  const payload = (await response.json()) as { friend?: UserProfile };
  return payload.friend;
};

export const rejectCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/reject"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao rejeitar solicitacao.");
  }
};

export const removeCheckpointFriend = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/unfriend"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao remover amigo.");
  }
};

export const updateCheckpointPresence = async (
  status: "online" | "playing",
  currentGameTitle?: string,
) => {
  const response = await fetch(apiUrl("/api/presence"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status, currentGameTitle }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao atualizar presenca.");
  }
};

export const getCheckpointFriendStatuses = async (): Promise<UserProfile[]> => {
  const response = await fetch(apiUrl("/api/friends/status"), {
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao consultar presenca dos amigos.");
  }
  const payload = (await response.json()) as { friends?: UserProfile[] };
  return payload.friends ?? [];
};
