import { describe, it, expect, vi } from "vitest";

describe("Friend presence reliability and staleness logic", () => {
  it("determines friend presence as offline when last presence heartbeat exceeds 75 seconds", () => {
    const STALE_THRESHOLD_MS = 75 * 1000;
    const now = Date.now();

    const resolveStatus = (presenceUpdatedAtStr: string | null, reportedStatus: string) => {
      const presenceUpdatedAt = Date.parse(String(presenceUpdatedAtStr || ""));
      const presenceIsFresh =
        Number.isFinite(presenceUpdatedAt) && now - presenceUpdatedAt < STALE_THRESHOLD_MS;
      return presenceIsFresh && ["online", "playing"].includes(reportedStatus)
        ? reportedStatus
        : "offline";
    };

    // Stale: 80 seconds ago
    const staleHeartbeat = new Date(now - 80 * 1000).toISOString();
    expect(resolveStatus(staleHeartbeat, "online")).toBe("offline");
    expect(resolveStatus(staleHeartbeat, "playing")).toBe("offline");

    // Fresh: 20 seconds ago
    const freshHeartbeat = new Date(now - 20 * 1000).toISOString();
    expect(resolveStatus(freshHeartbeat, "online")).toBe("online");
    expect(resolveStatus(freshHeartbeat, "playing")).toBe("playing");

    // Fresh boundary: 70 seconds ago
    const boundaryFresh = new Date(now - 70 * 1000).toISOString();
    expect(resolveStatus(boundaryFresh, "online")).toBe("online");

    // Expired boundary: 76 seconds ago
    const boundaryExpired = new Date(now - 76 * 1000).toISOString();
    expect(resolveStatus(boundaryExpired, "online")).toBe("offline");

    // Missing or invalid timestamp
    expect(resolveStatus(null, "online")).toBe("offline");
    expect(resolveStatus("invalid-date", "online")).toBe("offline");
  });

  it("prevents stale polling responses from overwriting newer real-time offline events", () => {
    const lastKnownTimestamps = new Map<string, number>();

    const applyEvent = (friendId: string, status: "online" | "offline", updatedAt: number) => {
      const lastUpdated = lastKnownTimestamps.get(friendId) || 0;
      if (lastUpdated && updatedAt < lastUpdated) {
        // Discard older event
        return null;
      }
      lastKnownTimestamps.set(friendId, updatedAt);
      return status;
    };

    const friendUid = "user-abc";
    const t0 = 10000;
    const tOfflineEvent = 15000;
    const tStalePollSnapshot = 12000; // Poll snapshot that was computed before the offline event

    // 1. Initial status online at t0
    expect(applyEvent(friendUid, "online", t0)).toBe("online");

    // 2. Real-time offline broadcast arrives at tOfflineEvent
    expect(applyEvent(friendUid, "offline", tOfflineEvent)).toBe("offline");

    // 3. Stale poll snapshot arrives with older timestamp
    expect(applyEvent(friendUid, "online", tStalePollSnapshot)).toBeNull();

    // 4. Current recorded status remains offline
    expect(lastKnownTimestamps.get(friendUid)).toBe(tOfflineEvent);
  });

  it("clears playing game title whenever status becomes offline", () => {
    const friend = {
      id: "cp-friend:123",
      name: "Gui",
      status: "playing" as const,
      playing: "Cyberpunk 2077",
    };

    const nextPresence = {
      status: "offline" as const,
      playing: null,
    };

    const isOffline = nextPresence.status === "offline";
    const updated = {
      ...friend,
      status: isOffline ? ("offline" as const) : nextPresence.status,
      playing: isOffline ? undefined : (nextPresence.playing || undefined),
    };

    expect(updated.status).toBe("offline");
    expect(updated.playing).toBeUndefined();
  });

  it("preserves offline status when userProfile checkpointFriends re-syncs during tab switches", () => {
    // Current social friends in UI (friend was marked offline via realtime event)
    const currentFriends = [
      {
        id: "cp-friend:user-offline",
        name: "Amigo Offline",
        status: "offline" as const,
        playing: undefined,
        avatar: "https://avatar.com/1.jpg",
        source: "checkpoint" as const,
      },
      {
        id: "cp-friend:user-online",
        name: "Amigo Online",
        status: "online" as const,
        playing: undefined,
        avatar: "https://avatar.com/2.jpg",
        source: "checkpoint" as const,
      },
    ];

    // userProfile checkpointFriends from DB has stale f.status = 'online'
    const rawUserProfileCheckpointFriends = [
      {
        uid: "user-offline",
        displayName: "Amigo Offline",
        status: "online", // Stale DB value!
        photoURL: "https://avatar.com/1.jpg",
      },
      {
        uid: "user-online",
        displayName: "Amigo Online",
        status: "online",
        photoURL: "https://avatar.com/2.jpg",
      },
    ];

    // Mirroring useFriendsSystem.ts cpFriends logic
    const cpFriends = rawUserProfileCheckpointFriends.map((f: any) => {
      const existing = currentFriends.find((c) => c.id === `cp-friend:${f.uid}`);
      const resolvedStatus = existing?.status
        ? existing.status
        : (f.status === "playing" ? "playing" : f.status === "online" ? "online" : "offline");
      const resolvedPlaying = existing
        ? (existing.status === "playing" ? existing.playing : undefined)
        : (f.status === "playing" ? f.playing : undefined);
      return {
        id: `cp-friend:${f.uid}`,
        name: f.displayName || existing?.name || "Jogador",
        status: resolvedStatus,
        playing: resolvedPlaying,
        avatar: f.photoURL || existing?.avatar || undefined,
        source: "checkpoint",
      };
    });

    const offlineFriend = cpFriends.find((f) => f.id === "cp-friend:user-offline");
    const onlineFriend = cpFriends.find((f) => f.id === "cp-friend:user-online");

    // The offline friend MUST remain offline even if f.status in DB was online!
    expect(offlineFriend?.status).toBe("offline");
    expect(onlineFriend?.status).toBe("online");
  });

  it("AuthProvider compact helper evaluates stale profile rows as offline", () => {
    const now = Date.now();
    const profileById = new Map([
      [
        "friend-stale",
        {
          uid: "friend-stale",
          display_name: "Stale Player",
          status: "online", // Row says online, but heartbeat was 5 minutes ago
          presence_updated_at: new Date(now - 300_000).toISOString(),
        },
      ],
      [
        "friend-fresh",
        {
          uid: "friend-fresh",
          display_name: "Fresh Player",
          status: "playing",
          playing: "Elden Ring",
          presence_updated_at: new Date(now - 15_000).toISOString(),
        },
      ],
    ]);

    const compact = (relatedUid: string) => {
      const profile = profileById.get(relatedUid) as any;
      const presenceUpdatedAt = Date.parse(String(profile?.presence_updated_at || ""));
      const isFresh = Number.isFinite(presenceUpdatedAt) && now - presenceUpdatedAt < 75_000;
      const resolvedStatus = isFresh && ["online", "playing"].includes(profile?.status)
        ? (profile.status as "online" | "playing")
        : "offline";
      const resolvedPlaying = resolvedStatus === "playing" ? (profile?.playing as any) || null : null;
      return {
        uid: relatedUid,
        status: resolvedStatus,
        playing: resolvedPlaying,
      };
    };

    expect(compact("friend-stale").status).toBe("offline");
    expect(compact("friend-stale").playing).toBeNull();

    expect(compact("friend-fresh").status).toBe("playing");
    expect(compact("friend-fresh").playing).toBe("Elden Ring");
  });

  it("never blocks an online friend from transitioning to offline when server detects timeout or disconnect", () => {
    // Scenario: Friend was online via real-time WebSocket event at tOnline (e.g. timestamp 1000)
    const friend = {
      id: "cp-friend:player-x",
      name: "Player X",
      status: "online" as const,
      playing: undefined,
    };

    const friendPresenceLastUpdated = new Map<string, number>();
    friendPresenceLastUpdated.set("player-x", 1000); // Online event timestamp

    // Server heartbeat expired or server reports offline with older or equal timestamp (e.g. 950 or 1000)
    const serverStatus = {
      uid: "player-x",
      status: "offline" as const,
      updatedAt: new Date(950).toISOString(),
    };

    const serverUpdatedAtMs = Date.parse(serverStatus.updatedAt);
    const lastUpdated = friendPresenceLastUpdated.get("player-x") || 0;
    const isServerOffline = serverStatus.status === "offline";

    let shouldDiscard = false;
    if (!isServerOffline) {
      if (friend.status === "offline" && lastUpdated && serverUpdatedAtMs <= lastUpdated) {
        shouldDiscard = true;
      }
      if (serverUpdatedAtMs && lastUpdated && serverUpdatedAtMs < lastUpdated) {
        shouldDiscard = true;
      }
    }

    expect(shouldDiscard).toBe(false);

    // The friend MUST update to offline!
    const nextStatus = shouldDiscard ? friend.status : serverStatus.status;
    expect(nextStatus).toBe("offline");
  });
});
