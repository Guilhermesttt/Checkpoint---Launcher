import { auth } from "../../Firebase";
import type { UserProfile } from "../types/domain";
import { apiUrl } from "./api";

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
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
    throw new Error(payload.error || "Erro ao buscar usuários.");
  }
  const payload = (await response.json()) as { users?: UserProfile[] };
  return payload.users ?? [];
};

export const addCheckpointFriend = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/add"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao adicionar amigo.");
  }
};

export const removeCheckpointFriend = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/remove"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao remover amigo.");
  }
};
