import { useState, useEffect, useRef } from 'react';
import type { AuthUser } from "../auth/AuthProvider";
import type {
  CheckpointFriendRequest,
  Game,
  SocialFriend,
  UserProfile,
} from "../types/domain";
import type { SoundEffectType } from './useSoundEffects';
import { subscribeToUnreadMessages } from '../services/chat';
import {
  subscribeToGlobalEventBus,
  sendFastFriendRequestNotification,
  sendFastFriendRemovedNotification,
} from '../services/realtimeEventBus';
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
  user: AuthUser | null;
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

  const socialFriendsRef = useRef(socialFriends);
  socialFriendsRef.current = socialFriends;
  const activeChatFriendRef = useRef(activeChatFriend);
  activeChatFriendRef.current = activeChatFriend;

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

          const currentFriends = socialFriendsRef.current;
          const currentActiveChat = activeChatFriendRef.current;

          const senderFriend = currentFriends.find(
            (f) =>
              f.id === `cp-friend:${msg.senderId}` ||
              f.id === msg.senderId ||
              f.id.endsWith(`:${msg.senderId}`),
          );
          const senderName = senderFriend?.name || "Amigo";
          const avatarUrl = senderFriend?.avatar || "";
          const isImage = Boolean(
            msg.attachmentType?.toLowerCase().startsWith("image/")
            || msg.attachmentUrl
            || msg.attachmentPath,
          );

          const cleanSenderId = String(msg.senderId || "").replace(/^cp-friend:/, "").trim();
          const cleanActiveId = String(currentActiveChat?.id || "").replace(/^cp-friend:/, "").trim();
          const isActiveChat = Boolean(cleanActiveId && cleanSenderId && cleanActiveId === cleanSenderId);

          if (!isActiveChat) {
            const displayContent = isImage ? "📷 Enviou uma imagem" : msg.text;

            // In-game overlay notification
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`Mensagem de ${senderName}`, {
                  body: displayContent,
                  icon: avatarUrl || "/Pherielium_logo.png",
                });
              } catch {
                // Ignore notification permission / Electron background errors
              }
            } else if ("Notification" in window && Notification.permission === "default") {
              void Notification.requestPermission();
            }

            // In-game overlay notification
            void window.electronAPI?.showFriendMessageOverlay({
              senderName,
              messageText: msg.text,
              avatarUrl,
              friendId: `cp-friend:${msg.senderId}`,
              contentKind: isImage ? "image" : "text",
            });
            playSound("friendRequest");
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid, notify, playSound]);

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

            const cleanName =
              (friend.name && friend.name !== "Amigo" && friend.name !== "Jogador")
                ? friend.name
                : (status.displayName || friend.name || "Amigo");

            const newFriend = {
              ...friend,
              name: cleanName,
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

            const cleanName =
              (friend.name && friend.name !== "Amigo" && friend.name !== "Jogador")
                ? friend.name
                : (status.displayName || friend.name || "Amigo");

            const nextFriend = {
              ...friend,
              name: cleanName,
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

    // Intervalo de polling secundário (mantém sincronizado em background caso WebSocket oscile)
    const interval = window.setInterval(() => {
      if (!isInitialSync && document.hasFocus()) {
        syncFriendStatuses();
      }
    }, 60_000);

    // Sincronizar imediatamente quando a janela volta ao foco
    const handleFocus = () => {
      if (!isInitialSync) {
        syncFriendStatuses();
      }
    };

    // Subscrição instantânea via WebSocket Event Bus (Sub-50ms)
    const unsubPresenceBus = subscribeToGlobalEventBus(user.uid, {
      onStatusUpdate: (presence) => {
        if (!presence?.uid) return;
        setSocialFriends((current) => {
          let hasChanges = false;
          const updated = current.map((friend) => {
            if (!friend.id.includes(presence.uid)) return friend;

            const cleanName =
              (friend.name && friend.name !== "Amigo" && friend.name !== "Jogador")
                ? friend.name
                : (presence.displayName || friend.name || "Amigo");

            const newFriend = {
              ...friend,
              name: cleanName,
              avatar: presence.photoURL || friend.avatar,
              status: presence.status || "offline",
              playing: presence.playing || undefined,
            };

            const nextFingerprint = `${newFriend.status}:${newFriend.playing || ""}`;
            const previousFingerprint = friendPresenceFingerprintRef.current.get(friend.id);

            if (friend.status !== newFriend.status || friend.playing !== newFriend.playing) {
              hasChanges = true;

              if (friend.status === "offline" && newFriend.status === "online" && previousFingerprint !== nextFingerprint) {
                notify(`${newFriend.name} ficou online`, "success");
              }

              if (friend.status !== "playing" && newFriend.status === "playing" && newFriend.playing && previousFingerprint !== nextFingerprint) {
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

          return hasChanges ? updated : current;
        });
      },
      onFriendRequest: (req) => {
        playSound("friendRequest");
        void window.electronAPI?.showFriendRequestOverlay({
          playerName: req.fromName,
          avatarUrl: req.fromAvatar || null,
          friendId: `cp-friend:${req.fromUid}`,
        });
        void refreshProfile();
      },
      onFriendAccepted: (friend) => {
        void window.electronAPI?.showFriendAcceptedOverlay({
          playerName: friend.friendName,
          avatarUrl: friend.friendAvatar || null,
        });
        void refreshProfile();
      },
      onFriendRemoved: (data) => {
        if (!data?.fromUid) return;
        setSocialFriends((current) => current.filter((friend) => !friend.id.includes(data.fromUid)));
        void refreshProfile();
      },
    });

    return () => {
      unsubPresenceBus();
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, userProfile?.checkpointFriends, notify, playSound, refreshProfile]);

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
      playSound("friendRequest");
      void window.electronAPI?.showFriendRequestOverlay({
        playerName: freshRequest.displayName,
        avatarUrl: freshRequest.photoURL || null,
        friendId: `cp-friend:${freshRequest.uid}`,
      });
    }

    previousIncomingRequestsRef.current = currentIncomingIds;
  }, [playSound, userProfile?.checkpointFriendRequestsIncoming]);

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
    // Remoção otimista imediata na UI local
    setSocialFriends((current) => current.filter((item) => item.id !== id));

    if (id.startsWith("cp-friend:") && user?.uid) {
      const friendUid = id.split(":")[1];
      try {
        await removeCheckpointFriend(friendUid);
        void sendFastFriendRemovedNotification(friendUid, user.uid);
        await refreshProfile();
        notify(`${friend.name} foi removido da sua lista de amigos.`, "success");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Erro ao remover amigo do Checkpoint.", "error");
        await refreshProfile();
      }
    }
  };

  const handleAddCheckpointFriend = async (friendProfile: UserProfile) => {
    if (!user?.uid) return;
    try {
      await sendCheckpointFriendRequest(friendProfile.uid);
      void sendFastFriendRequestNotification(friendProfile.uid, {
        uid: user.uid,
        displayName: userProfile?.displayName || user.displayName || user.email?.split("@")[0] || "Jogador",
        photoURL: userProfile?.photoURL || user.photoURL || null,
      });
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
      setIncomingFriendRequests((current) => current.filter((item) => item.uid !== uid));
      await rejectCheckpointFriendRequest(uid);
      if (user?.uid) {
        void sendFastFriendRemovedNotification(uid, user.uid);
      }
      notify("Solicitação cancelada/rejeitada.", "success");
      await refreshProfile();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao cancelar solicitação.", "error");
      await refreshProfile();
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
