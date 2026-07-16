import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../../Firebase";
import type { SocialActivity, UserProfile } from "../types/domain";
import { apiUrl } from "./api";

type ActivityInput = Omit<SocialActivity, "id" | "userId" | "userName" | "userAvatar" | "audienceIds" | "createdAt"> & {
  dedupeKey?: string;
};

const activityCollection = () => collection(db, "activities");

export const publishSocialActivity = async (
  uid: string,
  _profile: UserProfile | null | undefined,
  input: ActivityInput,
) => {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error("Sessão expirada. Entre novamente para publicar no feed.");
  }

  const token = await currentUser.getIdToken();
  const activity = { ...input };
  delete activity.dedupeKey;
  const response = await fetch(apiUrl("/api/social/activity"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    let message = "Não foi possível publicar a atividade.";
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Mantém a mensagem genérica quando o backend não retorna JSON.
    }
    throw new Error(message);
  }
};

export const subscribeSocialFeed = (
  viewerId: string,
  onChange: (activities: SocialActivity[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!viewerId) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(activityCollection(), where("audienceIds", "array-contains", viewerId), orderBy("createdAt", "desc"), limit(60)),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      } as SocialActivity)));
    },
    (error) => onError?.(error),
  );
};
