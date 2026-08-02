import * as React from "react";
import {
  ExternalLink,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Search,
  Send,
  SkipBack,
  SkipForward,
  Users,
  Volume2,
} from "lucide-react";
import type { SpotifyPlayerController } from "../../hooks/useSpotifyPlayer";
import { sendChatMessage } from "../../services/chat";
import type { SpotifyTrack } from "../../services/spotify";
import type { SocialFriend } from "../../types/domain";
import type { LauncherLanguage } from "../../context/PreferencesContext";

interface SpotifyPageProps {
  player: SpotifyPlayerController;
  friends: SocialFriend[];
  language: LauncherLanguage;
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
}

const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const SPOTIFY_COPY = {
  "pt-BR": { connectTitle: "Spotify no Checkpoint", connectHint: "Conecte sua conta para ouvir, controlar músicas e criar uma Jam com seus amigos sem sair do launcher.", connect: "Conectar Spotify", preparing: "Preparando o player...", headline: "Sua música, no seu ritmo.", remoteDevice: "Dispositivo ativo", checkpointDevice: "Checkpoint ativo", nowPlaying: "Tocando agora", chooseTrack: "Escolha uma música", searchCatalog: "Busque no catálogo do Spotify", openSpotify: "Abrir no Spotify", position: "Posição da música", previous: "Faixa anterior", play: "Reproduzir", pause: "Pausar", next: "Próxima faixa", volume: "Volume Spotify", searchPlaceholder: "Buscar música ou artista", search: "Buscar no Spotify", jamHint: "Convide amigos para ouvir e sugerir", shared: "Faixa compartilhada", noTrack: "Nenhuma música tocando", startJam: "Inicie uma faixa para criar a Jam", inviteFriends: "Convidar amigos", noFriends: "Adicione amigos Checkpoint para criar uma Jam.", sending: "Enviando...", invite: "Convidar para a Jam", seekError: "Não foi possível alterar o tempo da música.", searchError: "Falha ao buscar no Spotify.", playError: "Não foi possível iniciar a música.", inviteSuccess: "Convites da Jam enviados.", inviteError: "Não foi possível enviar os convites.", inviteTitle: "🎧 Convite para uma Checkpoint Jam", inviteNext: "Entre na conversa para sugerir a próxima faixa." },
  "en-US": { connectTitle: "Spotify on Checkpoint", connectHint: "Connect your account to listen, control music, and create a Jam with friends without leaving the launcher.", connect: "Connect Spotify", preparing: "Preparing player...", headline: "Your music, your pace.", remoteDevice: "Active device", checkpointDevice: "Checkpoint active", nowPlaying: "Now playing", chooseTrack: "Choose a track", searchCatalog: "Search the Spotify catalog", openSpotify: "Open in Spotify", position: "Track position", previous: "Previous track", play: "Play", pause: "Pause", next: "Next track", volume: "Spotify volume", searchPlaceholder: "Search track or artist", search: "Search Spotify", jamHint: "Invite friends to listen and suggest", shared: "Shared track", noTrack: "No track playing", startJam: "Start a track to create the Jam", inviteFriends: "Invite friends", noFriends: "Add Checkpoint friends to create a Jam.", sending: "Sending...", invite: "Invite to Jam", seekError: "Could not change the track position.", searchError: "Spotify search failed.", playError: "Could not start the track.", inviteSuccess: "Jam invitations sent.", inviteError: "Could not send the invitations.", inviteTitle: "🎧 Checkpoint Jam invitation", inviteNext: "Join the conversation to suggest the next track." },
  "es-ES": { connectTitle: "Spotify en Checkpoint", connectHint: "Conecta tu cuenta para escuchar, controlar música y crear una Jam con amigos sin salir del launcher.", connect: "Conectar Spotify", preparing: "Preparando el reproductor...", headline: "Tu música, a tu ritmo.", remoteDevice: "Dispositivo activo", checkpointDevice: "Checkpoint activo", nowPlaying: "Reproduciendo ahora", chooseTrack: "Elige una canción", searchCatalog: "Busca en el catálogo de Spotify", openSpotify: "Abrir en Spotify", position: "Posición de la canción", previous: "Canción anterior", play: "Reproducir", pause: "Pausar", next: "Siguiente canción", volume: "Volumen de Spotify", searchPlaceholder: "Buscar canción o artista", search: "Buscar en Spotify", jamHint: "Invita amigos a escuchar y sugerir", shared: "Canción compartida", noTrack: "No hay música reproduciéndose", startJam: "Inicia una canción para crear la Jam", inviteFriends: "Invitar amigos", noFriends: "Añade amigos de Checkpoint para crear una Jam.", sending: "Enviando...", invite: "Invitar a la Jam", seekError: "No se pudo cambiar la posición de la canción.", searchError: "Error al buscar en Spotify.", playError: "No se pudo iniciar la canción.", inviteSuccess: "Invitaciones de Jam enviadas.", inviteError: "No se pudieron enviar las invitaciones.", inviteTitle: "🎧 Invitación a una Checkpoint Jam", inviteNext: "Entra en la conversación para sugerir la próxima canción." },
  "fr-FR": { connectTitle: "Spotify sur Checkpoint", connectHint: "Connectez votre compte pour écouter, contrôler la musique et créer une Jam avec vos amis sans quitter le launcher.", connect: "Connecter Spotify", preparing: "Préparation du lecteur...", headline: "Votre musique, à votre rythme.", remoteDevice: "Appareil actif", checkpointDevice: "Checkpoint actif", nowPlaying: "En cours de lecture", chooseTrack: "Choisissez un titre", searchCatalog: "Recherchez dans le catalogue Spotify", openSpotify: "Ouvrir dans Spotify", position: "Position du titre", previous: "Titre précédent", play: "Lire", pause: "Pause", next: "Titre suivant", volume: "Volume Spotify", searchPlaceholder: "Rechercher un titre ou un artiste", search: "Rechercher sur Spotify", jamHint: "Invitez des amis à écouter et suggérer", shared: "Titre partagé", noTrack: "Aucun titre en lecture", startJam: "Lancez un titre pour créer la Jam", inviteFriends: "Inviter des amis", noFriends: "Ajoutez des amis Checkpoint pour créer une Jam.", sending: "Envoi...", invite: "Inviter à la Jam", seekError: "Impossible de changer la position du titre.", searchError: "La recherche Spotify a échoué.", playError: "Impossible de lancer le titre.", inviteSuccess: "Invitations à la Jam envoyées.", inviteError: "Impossible d'envoyer les invitations.", inviteTitle: "🎧 Invitation à une Checkpoint Jam", inviteNext: "Rejoignez la conversation pour suggérer le prochain titre." },
  "de-DE": { connectTitle: "Spotify in Checkpoint", connectHint: "Verbinde dein Konto, höre und steuere Musik und erstelle eine Jam mit Freunden, ohne den Launcher zu verlassen.", connect: "Spotify verbinden", preparing: "Player wird vorbereitet...", headline: "Deine Musik, dein Rhythmus.", remoteDevice: "Aktives Gerät", checkpointDevice: "Checkpoint aktiv", nowPlaying: "Aktuelle Wiedergabe", chooseTrack: "Titel auswählen", searchCatalog: "Spotify-Katalog durchsuchen", openSpotify: "In Spotify öffnen", position: "Titelposition", previous: "Vorheriger Titel", play: "Wiedergeben", pause: "Pause", next: "Nächster Titel", volume: "Spotify-Lautstärke", searchPlaceholder: "Titel oder Künstler suchen", search: "Spotify durchsuchen", jamHint: "Freunde zum Hören und Vorschlagen einladen", shared: "Geteilter Titel", noTrack: "Kein Titel wird abgespielt", startJam: "Starte einen Titel, um die Jam zu erstellen", inviteFriends: "Freunde einladen", noFriends: "Füge Checkpoint-Freunde hinzu, um eine Jam zu erstellen.", sending: "Wird gesendet...", invite: "Zur Jam einladen", seekError: "Die Titelposition konnte nicht geändert werden.", searchError: "Spotify-Suche fehlgeschlagen.", playError: "Der Titel konnte nicht gestartet werden.", inviteSuccess: "Jam-Einladungen gesendet.", inviteError: "Einladungen konnten nicht gesendet werden.", inviteTitle: "🎧 Einladung zu einer Checkpoint Jam", inviteNext: "Tritt der Unterhaltung bei und schlage den nächsten Titel vor." },
  "it-IT": { connectTitle: "Spotify su Checkpoint", connectHint: "Collega il tuo account per ascoltare, controllare la musica e creare una Jam con gli amici senza uscire dal launcher.", connect: "Collega Spotify", preparing: "Preparazione del player...", headline: "La tua musica, al tuo ritmo.", remoteDevice: "Dispositivo attivo", checkpointDevice: "Checkpoint attivo", nowPlaying: "In riproduzione", chooseTrack: "Scegli un brano", searchCatalog: "Cerca nel catalogo Spotify", openSpotify: "Apri in Spotify", position: "Posizione del brano", previous: "Brano precedente", play: "Riproduci", pause: "Pausa", next: "Brano successivo", volume: "Volume Spotify", searchPlaceholder: "Cerca brano o artista", search: "Cerca su Spotify", jamHint: "Invita amici ad ascoltare e suggerire", shared: "Brano condiviso", noTrack: "Nessun brano in riproduzione", startJam: "Avvia un brano per creare la Jam", inviteFriends: "Invita amici", noFriends: "Aggiungi amici Checkpoint per creare una Jam.", sending: "Invio...", invite: "Invita alla Jam", seekError: "Impossibile cambiare la posizione del brano.", searchError: "Ricerca Spotify non riuscita.", playError: "Impossibile avviare il brano.", inviteSuccess: "Inviti alla Jam inviati.", inviteError: "Impossibile inviare gli inviti.", inviteTitle: "🎧 Invito a una Checkpoint Jam", inviteNext: "Entra nella conversazione per suggerire il prossimo brano." },
} as const;

const SpotifyPage: React.FC<SpotifyPageProps> = ({ player, friends, language, onNotify }) => {
  const copy = SPOTIFY_COPY[language] || SPOTIFY_COPY["pt-BR"];
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedFriends, setSelectedFriends] = React.useState<Set<string>>(new Set());
  const [inviting, setInviting] = React.useState(false);
  const [volume, setVolume] = React.useState(55);
  const [seekPosition, setSeekPosition] = React.useState(0);
  const [isSeeking, setIsSeeking] = React.useState(false);
  const track = player.playback.track;
  const checkpointFriends = friends.filter((friend) => friend.id.startsWith("cp-friend:"));

  const displayedPosition = isSeeking ? seekPosition : player.playback.positionMs;

  const reportError = (reason: unknown, fallback: string) => {
    onNotify?.(reason instanceof Error ? reason.message : fallback, "error");
  };

  const commitSeek = async () => {
    setIsSeeking(false);
    try {
      await player.seek(seekPosition);
    } catch (reason) {
      reportError(reason, copy.seekError);
    }
  };

  const submitSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      setResults(await player.search(query));
    } catch (reason) {
      reportError(reason, copy.searchError);
    } finally {
      setSearching(false);
    }
  };

  const startTrack = async (selectedTrack: SpotifyTrack) => {
    try {
      await player.playTrack(selectedTrack);
      setResults([]);
    } catch (reason) {
      reportError(reason, copy.playError);
    }
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((current) => {
      const next = new Set(current);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const inviteFriends = async () => {
    if (!track || selectedFriends.size === 0 || inviting) return;
    setInviting(true);
    const message = [
      copy.inviteTitle,
      `${track.title} — ${track.artist}`,
      track.spotifyUrl,
      copy.inviteNext,
    ].join("\n");
    try {
      await Promise.all(Array.from(selectedFriends, (friendId) =>
        sendChatMessage(friendId.replace(/^cp-friend:/, ""), message)));
      onNotify?.(copy.inviteSuccess, "success");
      setSelectedFriends(new Set());
    } catch (reason) {
      reportError(reason, copy.inviteError);
    } finally {
      setInviting(false);
    }
  };

  if (player.status === "unconfigured" || player.status === "unsupported" || player.status === "disconnected" || player.status === "error") {
    return (
      <section className="flex h-full items-center justify-center px-10 pb-10 font-body">
        <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-black/40 p-8 text-center backdrop-blur-2xl">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1ed760]/10"><Music2 className="h-7 w-7 text-[#1ed760]" /></span>
          <h2 className="mt-5 text-2xl font-black text-white">{copy.connectTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">{copy.connectHint}</p>
          {player.error && <p className="mt-3 text-xs text-red-300/80">{player.error}</p>}
          {(player.status === "disconnected" || player.status === "error") && <button type="button" onClick={() => void player.connect()} className="mt-6 rounded-xl bg-[#1ed760] px-6 py-3 text-xs font-black text-black transition hover:brightness-110">{copy.connect}</button>}
        </div>
      </section>
    );
  }

  if (player.status === "loading" || player.status === "connecting") {
    return <div className="flex h-full items-center justify-center gap-3 text-sm text-white/50"><LoaderCircle className="h-5 w-5 animate-spin text-[#1ed760]" /> {copy.preparing}</div>;
  }

  return (
    <section className="spotify-scrollbar h-full overflow-y-auto px-10 pb-10 pt-4 font-body">
      <div className="mx-auto grid min-h-full max-w-[1180px] grid-cols-[minmax(0,1.55fr)_minmax(300px,.8fr)] gap-6">
        <div className="rounded-[30px] border border-white/10 bg-black/45 p-7 shadow-2xl backdrop-blur-2xl">
          <header className="flex items-center justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-[#1ed760]">Checkpoint Player</p><h2 className="mt-1 text-2xl font-black text-white">{copy.headline}</h2></div>
            <span className="flex items-center gap-2 rounded-full border border-[#1ed760]/20 bg-[#1ed760]/[.07] px-3 py-2 text-[10px] font-bold text-white/60"><i className="h-2 w-2 rounded-full bg-[#1ed760] shadow-[0_0_12px_#1ed760]" />{player.remoteMode ? copy.remoteDevice : copy.checkpointDevice}</span>
          </header>

          <div className="mt-8 grid grid-cols-[220px_minmax(0,1fr)] items-center gap-8">
            <div className="aspect-square overflow-hidden rounded-[28px] bg-white/[.05] shadow-[0_24px_60px_rgba(0,0,0,.55)]">{track?.coverUrl ? <img src={track.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Music2 className="h-14 w-14 text-white/15" /></span>}</div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#1ed760]">{copy.nowPlaying}</p>
              <h3 className="mt-3 truncate text-3xl font-black text-white">{track?.title || copy.chooseTrack}</h3>
              <p className="mt-1 truncate text-base text-white/45">{track?.artist || copy.searchCatalog}</p>
              {track?.spotifyUrl && <button type="button" onClick={() => void window.electronAPI?.openExternalUrl(track.spotifyUrl)} className="mt-3 flex items-center gap-1.5 text-[10px] text-white/35 hover:text-white">{copy.openSpotify} <ExternalLink className="h-3 w-3" /></button>}

              <input aria-label={copy.position} type="range" min={0} max={Math.max(1, player.playback.durationMs)} value={Math.min(displayedPosition, Math.max(1, player.playback.durationMs))} onPointerDown={() => { setSeekPosition(player.playback.positionMs); setIsSeeking(true); }} onChange={(event) => { setIsSeeking(true); setSeekPosition(Number(event.target.value)); }} onPointerUp={() => void commitSeek()} onKeyUp={() => void commitSeek()} className="mt-7 w-full accent-[#1ed760]" />
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-white/30"><span>{formatTime(displayedPosition)}</span><span>{formatTime(player.playback.durationMs)}</span></div>
              <div className="mt-4 flex items-center justify-center gap-8">
                <button type="button" aria-label={copy.previous} onClick={() => void player.previousTrack()} className="text-white/45 transition hover:text-white"><SkipBack className="h-5 w-5" /></button>
                <button type="button" aria-label={player.playback.paused ? copy.play : copy.pause} disabled={!track} onClick={() => void player.togglePlay()} className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-30">{player.playback.paused ? <Play className="ml-1 h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}</button>
                <button type="button" aria-label={copy.next} onClick={() => void player.nextTrack()} className="text-white/45 transition hover:text-white"><SkipForward className="h-5 w-5" /></button>
              </div>
              <div className="mt-6 flex items-center gap-3"><Volume2 className="h-4 w-4 text-white/30" /><input aria-label={copy.volume} type="range" min={0} max={100} value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); void player.setVolume(next / 100); }} className="w-full accent-[#1ed760]" /></div>
            </div>
          </div>

          <form onSubmit={(event) => void submitSearch(event)} className="relative mt-8"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="h-12 w-full rounded-2xl border border-white/[.08] bg-white/[.04] pl-11 pr-14 text-sm text-white outline-none focus:border-[#1ed760]/40" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-white/[.07] p-2.5 text-white/55 hover:text-white" aria-label={copy.search}>{searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></form>
          {results.length > 0 && <div className="spotify-scrollbar mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">{results.map((result) => <button key={result.id} type="button" onClick={() => void startTrack(result)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white/[.06]"><img src={result.coverUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /><span className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{result.title}</b><span className="block truncate text-[10px] text-white/35">{result.artist}</span></span><Play className="h-4 w-4 text-[#1ed760]" /></button>)}</div>}
        </div>

        <aside className="rounded-[30px] border border-white/10 bg-black/45 p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1ed760]/10"><Users className="h-5 w-5 text-[#1ed760]" /></span><div><h3 className="text-base font-black text-white">Checkpoint Jam</h3><p className="text-[10px] text-white/35">{copy.jamHint}</p></div></div>
          <div className="mt-6 rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/30">{copy.shared}</p><p className="mt-2 truncate text-sm font-bold text-white">{track?.title || copy.noTrack}</p><p className="truncate text-[10px] text-white/35">{track?.artist || copy.startJam}</p></div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.2em] text-white/30">{copy.inviteFriends}</p>
          <div className="spotify-scrollbar mt-3 max-h-[330px] space-y-1 overflow-y-auto pr-1">{checkpointFriends.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/30">{copy.noFriends}</p>}{checkpointFriends.map((friend) => <label key={friend.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[.05]"><input aria-label={friend.name} type="checkbox" checked={selectedFriends.has(friend.id)} onChange={() => toggleFriend(friend.id)} className="accent-[#1ed760]" />{friend.avatar ? <img src={friend.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs text-white">{friend.name.slice(0, 1)}</span>}<span className="min-w-0 flex-1 truncate text-xs text-white/70">{friend.name}</span></label>)}</div>
          <button type="button" onClick={() => void inviteFriends()} disabled={!track || selectedFriends.size === 0 || inviting} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ed760] px-4 py-3 text-xs font-black text-black transition hover:brightness-110 disabled:opacity-30"><Send className="h-4 w-4" />{inviting ? copy.sending : copy.invite}</button>
        </aside>
      </div>
    </section>
  );
};

export default SpotifyPage;
