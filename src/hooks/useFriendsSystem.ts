import { useState, useEffect, useRef } from 'react';
import type { User } from "firebase/auth";
import type {
  CheckpointFriendRequest,
  Game,
  SocialFriend,
  UserProfile,
} from "../types/domain";
import type { SoundEffectType } from './useSoundEffects';
import { subscribeToUnreadMessages } from '../services/chat';
import {
  acceptCheckpointFriendRequest,
  rejectCheckpointFriendRequest,
  removeCheckpointFriend,
  sendCheckpointFriendRequest,
  getCheckpointFriendStatuses,
} from '../services/checkpointFriends';

export type { CheckpointFriendRequest, SocialFriend } from "../types/domain";

export function buildLocalFriendProfile(friend: SocialFriend): { profile: UserProfile; games: Game[] } {
  return {
    profile: {
      uid: friend.id,
      displayName: friend.name,
      photoURL: friend.avatar || null,
      discordAvatar: friend.source === "discord_friend" ? friend.avatar : undefined,
      discordUsername: friend.source === "discord_friend" ? friend.name : undefined,
      status: friend.status,
      playing: friend.playing || null,
    },
    games: [],
  };
}

interface UseFriendsSystemProps {
  user: User | null;
  userProfile: UserProfile | null;
  playSound: (t: SoundEffectType) => void;
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
  refreshProfile: () => Promise<void>;
  localSocialStateLoaded: boolean;
  setLocalSocialStateLoaded: (loaded: boolean) => void;
  setIsAddFriendModalOpen: (open: boolean) => void;
}

export function useFriendsSystem({
  user,
  userProfile,
  playSound,
  notify,
  refreshProfile,
  localSocialStateLoaded,
  setLocalSocialStateLoaded,
  setIsAddFriendModalOpen,
}: UseFriendsSystemProps) {
  const [socialFriends, setSocialFriends] = useState<SocialFriend[]>([]);
  const [unreadMessagesByFriend, setUnreadMessagesByFriend] = useState<Record<string, number>>({});
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<CheckpointFriendRequest[]>([]);
  const [activeChatFriend, setActiveChatFriend] = useState<SocialFriend | null>(null);

  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());  
  const isFirstUnreadSnapshotRef = useRef(true);  
  const friendPresenceFingerprintRef = useRef<Map<string, string>>(new Map());

  const previousCheckpointFriendsRef = useRef<Set<string> | null>(null);
  const previousOutgoingRequestsRef = useRef<Set<string> | null>(null);
  const previousIncomingRequestsRef = useRef<Set<string> | null>(null);

  // Unread messages snapshot listener for overlay notifications
  useEffect(() => {
    if (!user?.uid) {
      isFirstUnreadSnapshotRef.current = true;
      notifiedMessageIdsRef.current.clear();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadMessagesByFriend({});
      return;
    }

    const unsubscribe = subscribeToUnreadMessages((unreadMsgs) => {
      const counts = unreadMsgs.reduce<Record<string, number>>((acc, msg) => {
        acc[msg.senderId] = (acc[msg.senderId] || 0) + 1;
        return acc;
      }, {});
      setUnreadMessagesByFriend(counts);

      if (isFirstUnreadSnapshotRef.current) {
        unreadMsgs.forEach((msg) => {
          const messageId = msg.id || `${msg.senderId}:${msg.createdAt}:${msg.text}`;
          notifiedMessageIdsRef.current.add(messageId);
        });
        isFirstUnreadSnapshotRef.current = false;
        return;
      }

      unreadMsgs.forEach((msg) => {
        const messageId = msg.id || `${msg.senderId}:${msg.createdAt}:${msg.text}`;
        if (!notifiedMessageIdsRef.current.has(messageId)) {
          notifiedMessageIdsRef.current.add(messageId);

          const senderFriend = socialFriends.find((f) => f.id === `cp-friend:${msg.senderId}`);
          const senderName = senderFriend?.name || "Amigo";
          const avatarUrl = senderFriend?.avatar || "";

          if (activeChatFriend?.id !== `cp-friend:${msg.senderId}`) {
            void window.electronAPI?.showFriendMessageOverlay({
              senderName,
              messageText: msg.text,
              avatarUrl,
            });
            playSound("friendRequest");
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid, socialFriends, activeChatFriend, playSound]);

  useEffect(() => {
    if (!user?.uid || (userProfile?.checkpointFriends ?? []).length === 0) return;

    const syncFriendStatuses = async () => {
      try {
        const statuses = await getCheckpointFriendStatuses();
        if (statuses.length === 0) return;
        setSocialFriends((current) => {
          const statusById = new Map(statuses.map((friend) => [friend.uid, friend]));
          let hasChanges = false;

          const updatedFriends = current.map((friend) => {
            if (!friend.id.startsWith("cp-friend:")) return friend;
            const uid = friend.id.split(":")[1];
            const status = statusById.get(uid);
            if (!status) return friend;

            const newFriend = {
              ...friend,
              name: status.displayName || friend.name,
              avatar: status.photoURL || friend.avatar,
              status: status.status || "offline",
              playing: status.playing || undefined,
            };
            const nextFingerprint = `${newFriend.status}:${newFriend.playing || ""}`;
            const previousFingerprint = friendPresenceFingerprintRef.current.get(friend.id);

            // Verificar mudanças relevantes e notificar
            if (friend.status !== newFriend.status || friend.playing !== newFriend.playing) {
              hasChanges = true;

              // Notificar quando amigo fica online
              if (
                friend.status === "offline" &&
                newFriend.status === "online" &&
                previousFingerprint !== nextFingerprint
              ) {
                notify(`${newFriend.name} ficou online`, "success");
              }

              // Notificar quando amigo começa a jogar
              if (
                friend.status !== "playing" &&
                newFriend.status === "playing" &&
                newFriend.playing &&
                previousFingerprint !== nextFingerprint
              ) {
                notify(`${newFriend.name} começou a jogar ${newFriend.playing}`, "success");
                void window.electronAPI?.showFriendPlayingOverlay({
                  playerName: newFriend.name,
                  gameTitle: newFriend.playing,
                  avatarUrl: newFriend.avatar || null,
                });
              }
            }

            friendPresenceFingerprintRef.current.set(friend.id, nextFingerprint);
            return newFriend;
          });

          // Só atualizar se houver mudanças reais
          return hasChanges ? updatedFriends : current;
        });
      } catch {
        // Presence is opportunistic; the friend list still works without it.
      }
    };

    // Sincronização inicial (sem notificações)
    let isInitialSync = true;
    const initialSync = async () => {
      try {
        const statuses = await getCheckpointFriendStatuses();
        if (statuses.length === 0) return;
        setSocialFriends((current) => {
          const statusById = new Map(statuses.map((friend) => [friend.uid, friend]));

          const updatedFriends = current.map((friend) => {
            if (!friend.id.startsWith("cp-friend:")) return friend;
            const uid = friend.id.split(":")[1];
            const status = statusById.get(uid);
            if (!status) return friend;

            const nextFriend = {
              ...friend,
              name: status.displayName || friend.name,
              avatar: status.photoURL || friend.avatar,
              status: status.status || "offline",
              playing: status.playing || undefined,
            };

            friendPresenceFingerprintRef.current.set(
              friend.id,
              `${nextFriend.status}:${nextFriend.playing || ""}`,
            );

            return nextFriend;
          });

          return updatedFriends;
        });
      } catch {
        // Presence is opportunistic; the friend list still works without it.
      }
      isInitialSync = false;
    };

    initialSync();

    // Intervalo mais frequente para updates em tempo real (com notificações)
    const interval = window.setInterval(() => {
      if (!isInitialSync) {
        syncFriendStatuses();
      }
    }, 15_000);

    // Sincronizar quando a aba volta ao foco
    const handleFocus = () => {
      if (!isInitialSync) {
        syncFriendStatuses();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, userProfile?.checkpointFriends, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncomingFriendRequests(userProfile?.checkpointFriendRequestsIncoming ?? []);
  }, [userProfile?.checkpointFriendRequestsIncoming]);

  useEffect(() => {
    const currentIncoming = userProfile?.checkpointFriendRequestsIncoming ?? [];
    const currentIncomingIds = new Set(currentIncoming.map((request) => request.uid));

    if (!previousIncomingRequestsRef.current) {
      previousIncomingRequestsRef.current = currentIncomingIds;
      return;
    }

    const previousIncomingIds = previousIncomingRequestsRef.current;
    const freshRequest = currentIncoming.find((request) => !previousIncomingIds.has(request.uid));

    if (freshRequest) {
      notify(`${freshRequest.displayName} enviou um pedido de amizade.`, "info");
      playSound("friendRequest");
      void window.electronAPI?.showFriendRequestOverlay({
        playerName: freshRequest.displayName,
        avatarUrl: freshRequest.photoURL || null,
      });
    }

    previousIncomingRequestsRef.current = currentIncomingIds;
  }, [notify, playSound, userProfile?.checkpointFriendRequestsIncoming]);

  useEffect(() => {
    const currentFriends = new Set((userProfile?.checkpointFriends ?? []).map((friend) => friend.uid));
    const currentOutgoing = new Set(
      (userProfile?.checkpointFriendRequestsOutgoing ?? []).map((request) => request.uid),
    );
    const previousFriends = previousCheckpointFriendsRef.current;
    const previousOutgoing = previousOutgoingRequestsRef.current;

    if (previousFriends && previousOutgoing) {
      const acceptedFriend = (userProfile?.checkpointFriends ?? []).find(
        (friend) => !previousFriends.has(friend.uid) && previousOutgoing.has(friend.uid),
      );
      if (acceptedFriend) {
        notify(
          `${acceptedFriend.displayName} aceitou seu pedido. Agora voces sao amigos.`,
          "success",
        );
        void window.electronAPI?.showFriendAcceptedOverlay({
          playerName: acceptedFriend.displayName,
          avatarUrl: acceptedFriend.photoURL || null,
        });
      }
    }

    previousCheckpointFriendsRef.current = currentFriends;
    previousOutgoingRequestsRef.current = currentOutgoing;
  }, [notify, userProfile?.checkpointFriendRequestsOutgoing, userProfile?.checkpointFriends]);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSocialFriends([]);
       
      setLocalSocialStateLoaded(false);
      return;
    }
    const stored: SocialFriend[] = JSON.parse(
      localStorage.getItem(`checkpoint_social_friends_${user.uid}`) || "[]",
    );
     
    setSocialFriends(stored.filter((f) => f.source?.startsWith("discord") || f.source === "checkpoint"));
     
    setLocalSocialStateLoaded(true);
  }, [user?.uid, setLocalSocialStateLoaded]);

  useEffect(() => {
    if (!localSocialStateLoaded) return;
    const resolvedDiscordId = userProfile?.discordId;
    
    if (!resolvedDiscordId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSocialFriends((current) =>
        current.filter((friend) => !friend.source?.startsWith("discord")),
      );
      return;
    }

     
    setSocialFriends((current) => {
      const remoteFriends: SocialFriend[] = (userProfile?.discordFriends ?? [])
        .filter((friend) => friend.id && friend.id !== resolvedDiscordId)
        .map((friend) => ({
          id: `discord-friend:${friend.id}`,
          name: friend.username || "Discord",
          status: "offline",
          avatar: friend.avatar || undefined,
          source: "discord_friend",
        }));
      const cpFriends: SocialFriend[] = (userProfile?.checkpointFriends ?? []).map(f => ({
        id: `cp-friend:${f.uid}`,
        name: f.displayName,
        status: "offline",
        playing: undefined,
        avatar: f.photoURL || undefined,
        source: "checkpoint",
      }));
      const remoteIds = new Set([...remoteFriends.map((friend) => friend.id), ...cpFriends.map(f => f.id)]);
      const localFriends = current.filter(
        (friend) => !friend.source?.startsWith("discord") && friend.source !== "checkpoint" && !remoteIds.has(friend.id),
      );
      return [...remoteFriends, ...cpFriends, ...localFriends];
    });
  }, [
    localSocialStateLoaded,
    userProfile?.discordId,
    userProfile?.discordAvatar,
    userProfile?.discordFriends,
    userProfile?.checkpointFriends,
    userProfile?.discordUsername,
  ]);

  useEffect(() => {
    if (!user?.uid || !localSocialStateLoaded) return;
    localStorage.setItem(`checkpoint_social_friends_${user.uid}`, JSON.stringify(socialFriends));
  }, [localSocialStateLoaded, socialFriends, user?.uid]);

  const removeFriend = async (friend: SocialFriend) => {
    const id = friend.id;
    if (id.startsWith("cp-friend:") && user?.uid) {
      const friendUid = id.split(":")[1];
      try {
        await removeCheckpointFriend(friendUid);
        await refreshProfile();
        notify(`${friend.name} foi removido da sua lista de amigos.`, "success");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Erro ao remover amigo do Checkpoint.", "error");
      }
    } else {
      setSocialFriends((current) => current.filter((friend) => friend.id !== id));
    }
  };

  const handleAddCheckpointFriend = async (friendProfile: UserProfile) => {
    if (!user?.uid) return;
    try {
      await sendCheckpointFriendRequest(friendProfile.uid);
      notify("Solicitação enviada.", "success");
      await refreshProfile();
      setIsAddFriendModalOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erro ao enviar solicitação.", "error");
      throw e;
    }
  };

  const acceptFriendRequest = async (uid: string) => {
    const request = incomingFriendRequests.find((item) => item.uid === uid);
    try {
      const acceptedFriend = await acceptCheckpointFriendRequest(uid);
      const friendName = acceptedFriend?.displayName || request?.displayName || "Usuario";
      const nextFriend: SocialFriend = {
        id: `cp-friend:${acceptedFriend?.uid || uid}`,
        name: friendName,
        status: acceptedFriend?.status || "offline",
        playing: acceptedFriend?.playing || undefined,
        avatar: acceptedFriend?.photoURL || request?.photoURL || undefined,
        source: "checkpoint",
      };

      setIncomingFriendRequests((current) => current.filter((item) => item.uid !== uid));
      setSocialFriends((current) => [
        nextFriend,
        ...current.filter((friend) => friend.id !== nextFriend.id),
      ]);
      notify(`${friendName} agora e seu amigo no Checkpoint.`, "success");
      await refreshProfile();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao aceitar solicitacao.", "error");
    }
  };

  const rejectFriendRequest = async (uid: string) => {
    try {
      await rejectCheckpointFriendRequest(uid);
      setIncomingFriendRequests((current) => current.filter((item) => item.uid !== uid));
      notify("Solicitacao rejeitada.", "success");
      await refreshProfile();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao rejeitar solicitacao.", "error");
    }
  };

  return {
    socialFriends,
    setSocialFriends,
    unreadMessagesByFriend,
    setUnreadMessagesByFriend,
    incomingFriendRequests,
    setIncomingFriendRequests,
    activeChatFriend,
    setActiveChatFriend,
    removeFriend,
    handleAddCheckpointFriend,
    acceptFriendRequest,
    rejectFriendRequest,
    friendPresenceFingerprintRef,
  };
}
