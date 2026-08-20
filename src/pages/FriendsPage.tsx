import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, MessageSquare, Phone, Search, Trash2, User, UserCheck, Users, Video, X } from "lucide-react";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import ModalShell from "../components/ui/ModalShell";
import { usePreferences, type LauncherLanguage } from "../context/PreferencesContext";
import { searchCheckpointFriends } from "../services/checkpointFriends";
import type { CheckpointFriendRequest, SocialFriend, UserProfile } from "../types/domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { FriendsSubTabs, type SocialSubTab } from "../components/social/FriendsSubTabs";
import { VoiceRoomsTab } from "../components/voice/VoiceRoomsTab";
import { useVoiceCallContext } from "../context/VoiceCallContext";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationCenter";

import { ContactCard } from "../components/ui/ContactCard";
import { MetricMiniCard } from "../components/ui/MetricMiniCard";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const FRIENDS_COPY = {
  "pt-BR": { playing: "Jogando", online: "Online", offline: "Offline", connected: "Perfil conectado ao Discord", connectHint: "Conecte sua conta do Discord para sincronizar avatar e status", connect: "Conectar Discord", total: "Total de Conexões", requests: "Solicitações recebidas", requestHint: "Aceite ou rejeite quem quer adicionar você no Checkpoint.", user: "Usuário", wantsFriend: "Quer ser seu amigo", reject: "Rejeitar", accept: "Aceitar", search: "Pesquisar amigos...", connectEmpty: "Nenhum amigo encontrado na lista.", noFriends: "Nenhum amigo adicionado ainda.", noSearch: "Nenhum amigo corresponde à busca.", discordConnected: "Discord conectado", oneGame: "um jogo", now: "agora", openChat: "Abrir chat", chat: "Chat", openingProfile: "Abrindo perfil", viewProfile: "Ver perfil", profile: "Perfil", remove: "Remover amigo" },
  "en-US": { playing: "Playing", online: "Online", offline: "Offline", connected: "Profile connected to Discord", connectHint: "Connect your Discord account to sync avatar and status", connect: "Connect Discord", total: "Total Connections", requests: "Received requests", requestHint: "Accept or reject people who want to add you on Checkpoint.", user: "User", wantsFriend: "Wants to be your friend", reject: "Reject", accept: "Accept", search: "Search friends...", connectEmpty: "No friends found in the list.", noFriends: "No friends added yet.", noSearch: "No friends match your search.", discordConnected: "Discord connected", oneGame: "a game", now: "now", openChat: "Open chat", chat: "Chat", openingProfile: "Opening profile", viewProfile: "View profile", profile: "Profile", remove: "Remove friend" },
  "es-ES": { playing: "Jugando", online: "En línea", offline: "Desconectado", connected: "Perfil conectado a Discord", connectHint: "Conecta tu cuenta de Discord para sincronizar avatar y estado", connect: "Conectar Discord", total: "Total de Conexiones", requests: "Solicitudes recibidas", requestHint: "Acepta o rechaza a quienes quieran añadirte en Checkpoint.", user: "Usuario", wantsFriend: "Quiere ser tu amigo", reject: "Rechazar", accept: "Aceptar", search: "Buscar amigos...", connectEmpty: "No se encontraron amigos en la lista.", noFriends: "Aún no tienes amigos añadidos.", noSearch: "Ningún amigo coincide con la búsqueda.", discordConnected: "Discord conectado", oneGame: "un juego", now: "ahora", openChat: "Abrir chat", chat: "Chat", openingProfile: "Abriendo perfil", viewProfile: "Ver perfil", profile: "Perfil", remove: "Eliminar amigo" },
  "fr-FR": { playing: "Joue à", online: "En ligne", offline: "Hors ligne", connected: "Profil connecté à Discord", connectHint: "Connectez votre compte Discord pour synchroniser votre avatar et votre statut", connect: "Connecter Discord", total: "Total des connexions", requests: "Demandes reçues", requestHint: "Acceptez ou refusez les personnes qui souhaitent vous ajouter sur Checkpoint.", user: "Utilisateur", wantsFriend: "Veut devenir votre ami", reject: "Refuser", accept: "Accepter", search: "Rechercher des amis...", connectEmpty: "Aucun ami trouvé dans la liste.", noFriends: "Aucun ami ajouté pour le moment.", noSearch: "Aucun ami ne correspond à la recherche.", discordConnected: "Discord connecté", oneGame: "un jeu", now: "maintenant", openChat: "Ouvrir le chat", chat: "Chat", openingProfile: "Ouverture du profil", viewProfile: "Voir le profil", profile: "Profil", remove: "Supprimer l’ami" },
  "de-DE": { playing: "Spielt", online: "Online", offline: "Offline", connected: "Profil mit Discord verbunden", connectHint: "Verbinde dein Discord-Konto, um Avatar und Status zu synchronisieren", connect: "Discord verbinden", total: "Gesamtverbindungen", requests: "Erhaltene Anfragen", requestHint: "Akzeptiere oder lehne Personen ab, die dich auf Checkpoint hinzufügen möchten.", user: "Benutzer", wantsFriend: "Möchte dein Freund sein", reject: "Ablehnen", accept: "Annehmen", search: "Freunde suchen...", connectEmpty: "Keine Freunde in der Liste gefunden.", noFriends: "Noch keine Freunde hinzugefügt.", noSearch: "Keine Freunde entsprechen der Suche.", discordConnected: "Discord verbunden", oneGame: "ein Spiel", now: "jetzt", openChat: "Chat öffnen", chat: "Chat", openingProfile: "Profil wird geöffnet", viewProfile: "Profil anzeigen", profile: "Profil", remove: "Freund entfernen" },
  "it-IT": { playing: "Gioca a", online: "Online", offline: "Offline", connected: "Profilo collegato a Discord", connectHint: "Collega il tuo account Discord per sincronizzare avatar e stato", connect: "Collega Discord", total: "Totale connessioni", requests: "Richieste ricevute", requestHint: "Accetta o rifiuta chi vuole aggiungerti su Checkpoint.", user: "Utente", wantsFriend: "Vuole essere tuo amico", reject: "Rifiuta", accept: "Accetta", search: "Cerca amici...", connectEmpty: "Nessun amico trovato nell'elenco.", noFriends: "Nessun amico ancora aggiunto.", noSearch: "Nessun amico corrisponde alla ricerca.", discordConnected: "Discord collegato", oneGame: "un gioco", now: "ora", openChat: "Apri chat", chat: "Chat", openingProfile: "Apertura profilo", viewProfile: "Vedi profilo", profile: "Profilo", remove: "Rimuovi amico" },
} as const;

export interface FriendsPageProps {
  t: TranslationFn;
  language: LauncherLanguage;
  discordConnected: boolean;
  userDisplay: string;
  discordUsername?: string;
  discordAvatar?: string;
  DiscordIcon: BrandIcon;
  friends: SocialFriend[];
  unreadMessagesByFriend: Record<string, number>;
  incomingRequests: CheckpointFriendRequest[];
  currentPresenceGame?: string | null;
  onConnectDiscord: () => void;
  onRemoveFriend: (friend: SocialFriend) => void;
  onViewFriendProfile: (friend: SocialFriend) => void;
  friendProfileLoadingId?: string | null;
  onAcceptRequest: (uid: string) => void;
  onRejectRequest: (uid: string) => void;
  onAddFriendClick: () => void;
  onOpenChat: (friend: SocialFriend) => void;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
  onStartTestCall?: () => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = React.memo(({
  t,
  language,
  discordConnected,
  userDisplay,
  discordUsername,
  discordAvatar,
  DiscordIcon,
  friends,
  unreadMessagesByFriend,
  incomingRequests,
  currentPresenceGame,
  onConnectDiscord,
  onRemoveFriend,
  onViewFriendProfile,
  friendProfileLoadingId,
  onAcceptRequest,
  onRejectRequest,
  onAddFriendClick,
  onOpenChat,
  onStartVoiceCall,
  onStartTestCall,
}) => {
  const copy = FRIENDS_COPY[language] || FRIENDS_COPY["pt-BR"];
  const [friendSearch, setFriendSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<SocialSubTab>("AMIGOS");
  const voiceCall = useVoiceCallContext();
  const { userProfile } = useAuth();
  const { notify } = useNotification();
  const presenceFriends = friends.filter((friend) => friend.source === "checkpoint");
  const onlineCount = presenceFriends.filter((friend) => friend.status !== "offline").length;
  const playingCount = presenceFriends.filter((friend) => friend.status === "playing").length;
  const normalizedSearch = friendSearch.trim().toLowerCase();
  const visibleFriends = normalizedSearch
    ? friends.filter(
        (friend) =>
          friend.name.toLowerCase().includes(normalizedSearch) ||
          friend.playing?.toLowerCase().includes(normalizedSearch),
      )
    : friends;
  const totalUnreadCount = Object.values(unreadMessagesByFriend).reduce((acc, count) => acc + (count || 0), 0);
  const checkpointFriends = friends.filter((f) => f.source === "checkpoint");

  return (
    <SystemPageShell eyebrow="Social" title={t("friends")}>
      <FriendsSubTabs
        activeTab={activeSubTab}
        onTabChange={setActiveSubTab}
        incomingRequestsCount={incomingRequests.length}
        totalFriendsCount={friends.length}
        unreadCount={totalUnreadCount}
      />

      {/* Profile Header & Controls */}
      <section className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#171717] shadow-lg">
              {discordAvatar ? (
                <img src={discordAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <DiscordIcon className="h-6 w-6 text-white/50" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base md:text-lg font-black text-white tracking-tight">
                  {discordConnected ? discordUsername || userDisplay : userDisplay}
                </p>
                {discordConnected && (
                  <span className="flex h-5 items-center gap-1 rounded border border-white/10 bg-white/[0.05] px-1.5 font-mono text-[9px] font-bold text-white/70">
                    <DiscordIcon className="h-2.5 w-2.5" />
                    LINKED
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    currentPresenceGame
                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                      : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  }`}
                />
                <p className="truncate text-xs font-bold uppercase tracking-wider text-white/60 font-body">
                  {currentPresenceGame ? `${copy.playing} ${currentPresenceGame}` : copy.online}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onAddFriendClick}
              className="cursor-pointer flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black shadow-md transition-all hover:bg-white/90 active:scale-95"
            >
              <span>+ {t("addFriendTitle")}</span>
            </button>
            {onStartTestCall && (
              <button
                type="button"
                onClick={onStartTestCall}
                title="Testar microfone, áudio e compartilhamento de tela"
                className="cursor-pointer flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-xs font-bold uppercase tracking-wider text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-95"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Auto-Teste</span>
              </button>
            )}
          </div>
        </div>

        {/* Consolidated Discord Banner (single occurrence) */}
        {!discordConnected && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border border-white/[0.08] bg-[#121212] p-3.5 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">
                <DiscordIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-white/60">
                {copy.connectHint}
              </p>
            </div>
            <button
              type="button"
              onClick={onConnectDiscord}
              className="cursor-pointer shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:border-white/30 hover:bg-white/[0.12] active:scale-95"
            >
              {copy.connect}
            </button>
          </div>
        )}

        {/* 3 Metric Mini Cards with clear visual hierarchy */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <MetricMiniCard
            label={copy.online}
            value={onlineCount}
            icon={<UserCheck className="h-4 w-4" />}
            hint="Amigos conectados agora"
          />
          <MetricMiniCard
            label={copy.playing}
            value={playingCount}
            icon={<Gamepad2 className="h-4 w-4" />}
            hint="Em uma sessão de jogo"
          />
          <MetricMiniCard
            label={copy.total}
            value={friends.length}
            icon={<Users className="h-4 w-4" />}
            hint="Total de conexões"
          />
        </div>
      </section>

      {/* ABA SOLICITAÇÕES */}
      {activeSubTab === "SOLICITAÇÕES" && (
        <section className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div>
              <p className="text-base font-black text-white uppercase tracking-tight">{copy.requests}</p>
              <p className="mt-0.5 text-xs font-medium text-white/40">{copy.requestHint}</p>
            </div>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-2.5 font-mono text-xs font-bold text-white">
              {incomingRequests.length}
            </span>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-[#0E0E0E] p-8 text-center">
              <Users className="mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-bold text-white/50">Nenhuma solicitação de amizade pendente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {incomingRequests.map((request) => (
                <ContactCard
                  key={request.uid}
                  name={request.displayName || copy.user}
                  avatarUrl={request.photoURL}
                  status="busy"
                  statusText={copy.wantsFriend}
                  actions={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRejectRequest(request.uid)}
                        className="cursor-pointer h-8.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/[0.08] hover:text-white"
                      >
                        {copy.reject}
                      </button>
                      <button
                        type="button"
                        onClick={() => onAcceptRequest(request.uid)}
                        className="cursor-pointer h-8.5 rounded-lg bg-white px-3.5 text-xs font-black uppercase tracking-wider text-black hover:bg-white/90"
                      >
                        {copy.accept}
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ABA CHAT & CONVERSAS */}
      {activeSubTab === "CHAT" && (
        <section className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div>
              <p className="text-base font-black text-white uppercase tracking-tight">Chat & Conversas</p>
              <p className="mt-0.5 text-xs font-medium text-white/40">Selecione um amigo para abrir o chat em tempo real.</p>
            </div>
          </div>

          {checkpointFriends.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-[#0E0E0E] p-8 text-center">
              <MessageSquare className="mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-bold text-white/50">Nenhuma conversa recente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {checkpointFriends.map((friend) => {
                const unreadCount = unreadMessagesByFriend[friend.id.split(":")[1]] || 0;
                const statusState = friend.status === "playing" ? "playing" : friend.status === "online" ? "online" : "offline";
                const statusLabel = friend.status === "playing"
                  ? `${copy.playing} ${friend.playing || copy.oneGame}`
                  : friend.status === "online"
                    ? copy.online
                    : copy.offline;

                return (
                  <ContactCard
                    key={friend.id}
                    name={friend.name}
                    avatarUrl={friend.avatar}
                    status={statusState}
                    statusText={statusLabel}
                    badge={unreadCount > 0 ? unreadCount : undefined}
                    onCardClick={() => onOpenChat(friend)}
                    actions={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenChat(friend);
                        }}
                        className="cursor-pointer relative flex h-8.5 items-center gap-1.5 rounded-xl border border-white/10 bg-white px-3.5 text-xs font-black uppercase tracking-wider text-black transition-all hover:bg-white/90 shadow-md"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat</span>
                        {unreadCount > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black px-1 font-mono text-[9px] font-black text-white">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ABA AMIGOS */}
      {activeSubTab === "AMIGOS" && (
        <>
          {friends.length > 0 && (
            <div className="mb-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={friendSearch}
                  onChange={(event) => setFriendSearch(event.target.value)}
                  placeholder={copy.search}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0E0E0E] pl-11 pr-4 text-xs font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-white/25 shadow-inner"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
            {visibleFriends.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-8 text-center md:col-span-2 shadow-2xl">
                <Users className="mx-auto mb-3 h-8 w-8 text-white/25" />
                <p className="text-sm font-bold text-white/70">
                  {friends.length === 0 ? copy.noFriends : copy.noSearch}
                </p>
                {friends.length === 0 && (
                  <p className="mt-1.5 text-xs font-medium text-white/35">{t("addFriendEmptyHint")}</p>
                )}
              </div>
            ) : (
              visibleFriends.map((friend) => {
                const unreadCount = unreadMessagesByFriend[friend.id.split(":")[1]] || 0;
                const statusState = friend.status === "playing" ? "playing" : friend.status === "online" ? "online" : "offline";
                const statusLabel = friend.source === "discord_friend"
                  ? copy.discordConnected
                  : friend.status === "playing"
                    ? `${copy.playing} ${friend.playing || copy.oneGame}`
                    : friend.status === "online"
                      ? copy.online
                      : copy.offline;

                const rawFriendUid = friend.id.replace(/^cp-friend:/, "");
                const isCallActiveWithFriend = voiceCall.callState === "active" && (
                  voiceCall.session?.friendUid === friend.id ||
                  voiceCall.session?.friendUid === rawFriendUid ||
                  (voiceCall.session?.participants || []).some((p) => p.uid === friend.id || p.uid === rawFriendUid)
                );

                return (
                  <ContactCard
                    key={friend.id}
                    name={friend.name}
                    avatarUrl={friend.avatar}
                    customIcon={friend.source === "discord_friend" ? <DiscordIcon className="h-4 w-4 text-white/60" /> : undefined}
                    status={statusState}
                    statusText={isCallActiveWithFriend ? "Em chamada com você" : statusLabel}
                    badge={unreadCount > 0 ? unreadCount : undefined}
                    onCardClick={() => onOpenChat(friend)}
                    actions={
                      <div className="flex items-center gap-1.5">
                        {friend.source === "checkpoint" && onStartVoiceCall && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (isCallActiveWithFriend) {
                                  voiceCall.setIsVoiceWindowOpen(true);
                                } else {
                                  onStartVoiceCall(friend, false);
                                }
                              }}
                              title={isCallActiveWithFriend ? "Chamada ativa — Clique para voltar à chamada" : "Ligar (Voz)"}
                              aria-label="Ligar por voz"
                              className={`cursor-pointer flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition-all ${
                                isCallActiveWithFriend
                                  ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse hover:bg-emerald-600"
                                  : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                              }`}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onStartVoiceCall(friend, true)}
                              title="Compartilhar Tela / Vídeo"
                              aria-label="Compartilhar tela ou vídeo"
                              className="cursor-pointer flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                            >
                              <Video className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}

                        {friend.source === "checkpoint" && (
                          <button
                            type="button"
                            disabled={friendProfileLoadingId === friend.id}
                            onClick={() => onViewFriendProfile(friend)}
                            title={copy.viewProfile}
                            className="cursor-pointer flex h-8.5 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10.5px] font-bold uppercase tracking-wider text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                          >
                            <User className="h-3.5 w-3.5" />
                            <span>
                              {friendProfileLoadingId === friend.id
                                ? copy.openingProfile
                                : copy.profile}
                            </span>
                          </button>
                        )}

                        {friend.source === "checkpoint" && (
                          <button
                            type="button"
                            onClick={() => onRemoveFriend(friend)}
                            title={copy.remove}
                            className="cursor-pointer flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/35 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    }
                  />
                );
              })
            )}
          </div>
        </>
      )}

      {/* ABA CANAIS DE VOZ (SALAS) */}
      {activeSubTab === "SALAS" && (
        <VoiceRoomsTab
          userProfile={userProfile}
          currentRoomId={voiceCall.session?.chatId}
          onJoinRoom={async (roomId, password) => {
            await voiceCall.joinRoom(roomId, password);
          }}
          onCreateRoom={async (config) => {
            await voiceCall.createAndJoinRoom(config);
          }}
          onOpenActiveWindow={() => {
            voiceCall.setIsVoiceWindowOpen(true);
          }}
          onSimulateIncomingCall={() => {
            voiceCall.simulateIncomingCall(true);
          }}
          notify={notify}
        />
      )}
    </SystemPageShell>
  );
});

FriendsPage.displayName = "FriendsPage";

export interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFriend: (profile: UserProfile) => void;
  onViewProfile: (profile: UserProfile) => void;
  currentUserUid: string;
  friendIds: Set<string>;
  outgoingRequestIds: Set<string>;
  incomingRequestIds: Set<string>;
  playSound: (type: SoundEffectType) => void;
  t: TranslationFn;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = React.memo(({
  isOpen,
  onClose,
  onAddFriend,
  onViewProfile,
  currentUserUid,
  friendIds,
  outgoingRequestIds,
  incomingRequestIds,
  playSound,
  t,
}) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sendingUid, setSendingUid] = useState<string | null>(null);

  const getProfileAction = (profile: UserProfile) => {
    if (profile.uid === currentUserUid) return { label: t("addFriendYou"), disabled: true };
    if (friendIds.has(profile.uid)) return { label: t("addFriendAlreadyFriend"), disabled: true };
    if (outgoingRequestIds.has(profile.uid)) return { label: t("addFriendPending"), disabled: true };
    if (incomingRequestIds.has(profile.uid)) return { label: t("addFriendRespond"), disabled: true };
    if (sendingUid === profile.uid) return { label: "...", disabled: true };
    return { label: t("addFriendSend"), disabled: false };
  };

  const handleSendRequest = async (profile: UserProfile) => {
    const action = getProfileAction(profile);
    if (action.disabled) return;
    playSound("select");
    setSendingUid(profile.uid);
    try {
      await onAddFriend(profile);
      setResults((current) => current.filter((item) => item.uid !== profile.uid));
      setSelectedIndex(0);
    } finally {
      setSendingUid(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const stored = localStorage.getItem("checkpoint_recent_friend_searches");
    if (!stored) {
      setRecentSearches([]);
      return;
    }

    try {
      setRecentSearches(JSON.parse(stored).slice(0, 5));
    } catch {
      setRecentSearches([]);
    }
  }, [isOpen]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!search.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentSignal = abortControllerRef.current.signal;

    playSound("search");
    setSearching(true);
    setResults([]);
    setSelectedIndex(0);

    try {
      const searchResults = await searchCheckpointFriends(search.trim(), currentSignal);
      if (currentSignal.aborted) return;
      const uniqueResults = searchResults
        .filter((profile) => profile.uid && profile.uid !== currentUserUid)
        .filter(
          (profile, index, profiles) =>
            profiles.findIndex((item) => item.uid === profile.uid) === index,
        );
      setResults(uniqueResults);

      const newRecent = [
        search.trim(),
        ...recentSearches.filter((item) => item !== search.trim()),
      ].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem("checkpoint_recent_friend_searches", JSON.stringify(newRecent));
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      playSound("navigate");
      setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      playSound("navigate");
      setSelectedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && results[selectedIndex]) {
      event.preventDefault();
      void handleSendRequest(results[selectedIndex]);
    }
  };

  const clearRecentSearches = () => {
    playSound("back");
    setRecentSearches([]);
    localStorage.removeItem("checkpoint_recent_friend_searches");
  };

  const handleClose = () => {
    playSound("back");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-md"
      className="rounded-[28px] border border-white/10 bg-[#0A0A0C] shadow-2xl"
      ariaLabel={t("addFriendTitle")}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full overflow-hidden rounded-[28px] p-6"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />
        <div className="relative mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">{t("addFriendTitle")}</h2>
            <p className="mt-1 text-xs text-white/40">{t("addFriendHint")}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            onMouseEnter={() => playSound("hover")}
            className="rounded-xl p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("addFriendSearchPlaceholder")}
            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-12 pr-24 text-sm font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-white/25 focus:bg-white/[0.05]"
          />
          <button
            type="submit"
            disabled={searching || !search.trim()}
            onMouseEnter={() => playSound("hover")}
            className="absolute bottom-2 right-2 top-2 rounded-xl bg-white px-4 text-[10px] font-black uppercase tracking-wider text-black transition-all hover:bg-white/90 disabled:opacity-50 disabled:hover:bg-white"
          >
            {searching ? "..." : t("addFriendSearchButton")}
          </button>
        </form>

        {recentSearches.length > 0 && !search && !results.length && (
          <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/70">{t("addFriendRecentSearches")}</h3>
              <button
                type="button"
                onClick={clearRecentSearches}
                onMouseEnter={() => playSound("hover")}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/60"
              >
                {t("addFriendClear")}
              </button>
            </div>
            <div className="space-y-2">
              {recentSearches.map((recentSearch, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    playSound("navigate");
                    setSearch(recentSearch);
                  }}
                  onMouseEnter={() => playSound("hover")}
                  className="w-full rounded-lg p-2 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Search className="mr-2 inline h-3 w-3 text-white/30" />
                  {recentSearch}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="custom-scrollbar min-h-[100px] max-h-[300px] space-y-3 overflow-y-auto pr-2">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                <div className="text-sm text-white/40">{t("addFriendSearching")}</div>
              </div>
            </div>
          ) : results.length > 0 ? (
            results.map((profile, index) => {
              const action = getProfileAction(profile);
              return (
                <div
                  key={profile.uid}
                  onMouseEnter={() => playSound("hover")}
                  className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                    index === selectedIndex
                      ? "border-white/20 bg-white/[0.08]"
                      : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
                      {profile.photoURL ? (
                        <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Users className="h-6 w-6 text-white/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {profile.displayName || "Usuario"}
                      </div>
                      {profile.status && (
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-white/30">
                          {profile.status === "online"
                            ? t("addFriendOnline")
                            : profile.status === "playing"
                              ? `${t("addFriendPlaying")} ${profile.playing || ""}`
                              : t("addFriendOffline")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewProfile(profile)}
                      onMouseEnter={() => playSound("hover")}
                      className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-wider text-white/70 transition-all hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95"
                    >
                      {t("addFriendViewProfile")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendRequest(profile)}
                      onMouseEnter={() => playSound("hover")}
                      disabled={action.disabled}
                      className="h-10 min-w-[94px] rounded-xl bg-white/10 px-5 text-[11px] font-black uppercase tracking-wider text-white transition-all enabled:hover:scale-105 enabled:hover:bg-white/20 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {action.label}
                    </button>
                  </div>
                </div>
              );
            })
          ) : search.trim() ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-white/20" />
              <div className="mb-2 text-sm text-white/40">{t("addFriendNoResults")}</div>
              <div className="text-xs text-white/30">{t("addFriendNoResultsHint")}</div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-white/20" />
              <div className="mb-2 text-sm text-white/40">{t("addFriendEmpty")}</div>
              <div className="text-xs text-white/30">{t("addFriendEmptyHint")}</div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="text-center text-[10px] text-white/30">
              {t("addFriendKeyboardHint")}
            </div>
          </div>
        )}
      </motion.div>
    </ModalShell>
  );
});

AddFriendModal.displayName = "AddFriendModal";
