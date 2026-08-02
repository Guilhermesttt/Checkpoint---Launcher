import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ListMusic,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Users,
  Volume2,
} from "lucide-react";
import type { LauncherLanguage } from "../../context/PreferencesContext";
import { useSpotifyPlaylists } from "../../hooks/useSpotifyPlaylists";
import type { SpotifyPlayerController } from "../../hooks/useSpotifyPlayer";
import { useSpotifySearch } from "../../hooks/useSpotifySearch";
import { sendChatMessage } from "../../services/chat";
import type { SpotifyTrack } from "../../services/spotify";
import type { SocialFriend } from "../../types/domain";
import { getSpotifyCarouselOffset } from "../../services/spotifyPlayback";
import SpotifyRotatingMessage from "./SpotifyRotatingMessage";

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
  "pt-BR": { connectTitle: "Spotify no Checkpoint", connectHint: "Conecte sua conta para ouvir, controlar músicas e criar uma Jam com seus amigos sem sair do launcher.", connect: "Conectar Spotify", preparing: "Preparando o player..." },
  "en-US": { connectTitle: "Spotify on Checkpoint", connectHint: "Connect your account to listen, control music, and create a Jam with friends without leaving the launcher.", connect: "Connect Spotify", preparing: "Preparing player..." },
  "es-ES": { connectTitle: "Spotify en Checkpoint", connectHint: "Conecta tu cuenta para escuchar, controlar música y crear una Jam con amigos sin salir del launcher.", connect: "Conectar Spotify", preparing: "Preparando el reproductor..." },
  "fr-FR": { connectTitle: "Spotify sur Checkpoint", connectHint: "Connectez votre compte pour écouter, contrôler la musique et créer une Jam avec vos amis sans quitter le launcher.", connect: "Connecter Spotify", preparing: "Préparation du lecteur..." },
  "de-DE": { connectTitle: "Spotify in Checkpoint", connectHint: "Verbinde dein Konto, höre und steuere Musik und erstelle eine Jam mit Freunden, ohne den Launcher zu verlassen.", connect: "Spotify verbinden", preparing: "Player wird vorbereitet..." },
  "it-IT": { connectTitle: "Spotify su Checkpoint", connectHint: "Collega il tuo account per ascoltare, controllare la musica e creare una Jam con gli amici senza uscire dal launcher.", connect: "Collega Spotify", preparing: "Preparazione del player..." },
} as const;

const controlClass = "flex h-9 w-9 items-center justify-center rounded-xl text-white/45 transition duration-200 hover:bg-white/[.07] hover:text-white disabled:pointer-events-none disabled:opacity-25";
const panelClass = "border border-white/[.08] bg-black/45 backdrop-blur-2xl";

const SpotifyTrackArtwork = ({ track, className, style }: { track: SpotifyTrack | null; className: string; style?: React.CSSProperties }) => (
  <span className={`${className} shrink-0 overflow-hidden bg-white/[.06]`} style={style}>
    {track?.coverUrl
      ? <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
      : <Music2 className="m-auto h-1/3 w-1/3 text-white/15" />}
  </span>
);

const SpotifyReadyDashboard: React.FC<Omit<SpotifyPageProps, "language">> = ({ player, friends, onNotify }) => {
  const search = useSpotifySearch(player.search);
  const playlists = useSpotifyPlaylists(player.getAccessToken);
  const [creatingPlaylist, setCreatingPlaylist] = React.useState(false);
  const [playlistName, setPlaylistName] = React.useState("");
  const [playlistPublic, setPlaylistPublic] = React.useState(false);
  const [selectedFriends, setSelectedFriends] = React.useState<Set<string>>(new Set());
  const [inviting, setInviting] = React.useState(false);
  const [volume, setVolume] = React.useState(55);
  const [seekPosition, setSeekPosition] = React.useState(0);
  const [isSeeking, setIsSeeking] = React.useState(false);
  const track = player.playback.track;
  const checkpointFriends = friends.filter((friend) => friend.id.startsWith("cp-friend:"));
  const displayedPosition = isSeeking ? seekPosition : player.playback.positionMs;
  const carouselTracks = [track, ...player.queue.upcoming].filter((item): item is SpotifyTrack => Boolean(item)).slice(0, 5);

  const notifyError = React.useCallback((reason: unknown, fallback: string) => {
    onNotify?.(reason instanceof Error ? reason.message : fallback, "error");
  }, [onNotify]);

  const perform = React.useCallback(async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
    } catch (reason) {
      notifyError(reason, fallback);
    }
  }, [notifyError]);

  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!playlistName.trim()) return;
    await perform(async () => {
      const created = await playlists.createPlaylist({
        name: playlistName,
        description: "Criada no Checkpoint Launcher",
        isPublic: playlistPublic,
      });
      setPlaylistName("");
      setCreatingPlaylist(false);
      await playlists.openPlaylist(created.id);
      onNotify?.("Playlist criada no Spotify.", "success");
    }, "Não foi possível criar a playlist.");
  };

  const inviteFriends = async () => {
    if (!track || selectedFriends.size === 0 || inviting) return;
    setInviting(true);
    const message = ["🎧 Convite para uma Checkpoint Jam", `${track.title} — ${track.artist}`, track.spotifyUrl, "Entre na conversa para sugerir a próxima faixa."].join("\n");
    try {
      await Promise.all(Array.from(selectedFriends, (friendId) =>
        sendChatMessage(friendId.replace(/^cp-friend:/, ""), message)));
      setSelectedFriends(new Set());
      onNotify?.("Convites da Jam enviados.", "success");
    } catch (reason) {
      notifyError(reason, "Não foi possível enviar os convites.");
    } finally {
      setInviting(false);
    }
  };

  const commitSeek = () => {
    setIsSeeking(false);
    void perform(() => player.seek(seekPosition), "Não foi possível alterar o tempo da música.");
  };

  return (
    <section className="flex h-full min-h-0 flex-col px-6 pb-5 pt-2 font-body">
      <div className="mx-auto grid min-h-0 w-full max-w-[1380px] flex-1 grid-cols-[190px_minmax(420px,1fr)_260px] overflow-hidden rounded-[28px] border border-white/10 bg-[#060708]/75 shadow-[0_28px_80px_rgba(0,0,0,.5)]">
        <nav data-testid="spotify-navigation" className="flex min-h-0 flex-col border-r border-white/[.07] bg-white/[.018] p-4">
          <div className="flex items-center gap-2.5 px-2 py-3">
            <span className="h-3 w-3 rounded-full bg-[#1ed760] shadow-[0_0_14px_rgba(30,215,96,.55)]" />
            <span className="text-sm font-black tracking-tight text-white">Spotify</span>
          </div>
          <button type="button" onClick={() => playlists.setActivePlaylist(null)} className={`mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition duration-200 ${!playlists.activePlaylist ? "bg-white/[.09] text-white" : "text-white/40 hover:bg-white/[.05] hover:text-white/75"}`}>
            <Music2 className="h-4 w-4" /> Início
          </button>
          <div className="mt-6 flex items-center justify-between px-2">
            <p className="text-[9px] font-black uppercase tracking-[.2em] text-white/25">Suas playlists</p>
            <button type="button" aria-label="Criar playlist" onClick={() => setCreatingPlaylist(true)} className="text-white/30 transition hover:text-white"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="spotify-scrollbar mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {playlists.loading && <LoaderCircle className="mx-auto mt-5 h-4 w-4 animate-spin text-white/30" />}
            {playlists.playlists.map((playlist) => (
              <button key={playlist.id} type="button" onClick={() => void perform(() => playlists.openPlaylist(playlist.id), "Não foi possível abrir a playlist.")} className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition duration-200 ${playlists.activePlaylist?.id === playlist.id ? "bg-[#1ed760]/10 text-white" : "text-white/50 hover:bg-white/[.05] hover:text-white"}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[.06]">{playlist.coverUrl ? <img src={playlist.coverUrl} alt="" className="h-full w-full object-cover" /> : <ListMusic className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0"><b className="block truncate text-[10px]">{playlist.name}</b><span className="block truncate text-[8px] text-white/25">{playlist.totalItems} faixas</span></span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setCreatingPlaylist(true)} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/[.08] px-3 py-2.5 text-[10px] font-bold text-white/50 transition hover:bg-white/[.05] hover:text-white"><Plus className="h-3.5 w-3.5" /> Nova playlist</button>
        </nav>

        <main data-testid="spotify-content" className="spotify-scrollbar min-h-0 overflow-y-auto p-5">
          <header className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input value={search.query} onChange={(event) => search.setQuery(event.target.value)} placeholder="Buscar música ou artista" className="h-11 w-full rounded-2xl border border-white/[.08] bg-white/[.045] pl-11 pr-12 text-xs text-white outline-none transition duration-200 placeholder:text-white/25 focus:border-[#1ed760]/35 focus:bg-white/[.06]" />
              {search.status === "searching" && <LoaderCircle className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#1ed760]" />}
            </div>
            <span className="flex items-center gap-2 rounded-xl border border-[#1ed760]/15 bg-[#1ed760]/[.06] px-3 py-2.5 text-[9px] font-bold text-white/45"><i className="h-1.5 w-1.5 rounded-full bg-[#1ed760]" />{player.remoteMode ? "Dispositivo Spotify" : "Checkpoint ativo"}</span>
          </header>

          {creatingPlaylist && (
            <form onSubmit={(event) => void createPlaylist(event)} className="mt-4 flex items-center gap-3 rounded-2xl border border-[#1ed760]/20 bg-[#1ed760]/[.045] p-3">
              <input autoFocus value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Nome da playlist" className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-[#1ed760]/40" />
              <label className="flex items-center gap-2 text-[9px] font-bold text-white/45"><input type="checkbox" checked={playlistPublic} onChange={(event) => setPlaylistPublic(event.target.checked)} className="accent-[#1ed760]" /> Pública</label>
              <button type="submit" disabled={!playlistName.trim() || playlists.pendingAction === "create"} className="rounded-xl bg-[#1ed760] px-4 py-2.5 text-[9px] font-black text-black disabled:opacity-40">Criar</button>
              <button type="button" onClick={() => setCreatingPlaylist(false)} className="px-2 text-[9px] font-bold text-white/35 hover:text-white">Cancelar</button>
            </form>
          )}

          {search.query.trim().length >= 2 ? (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="mb-3 text-[9px] font-black uppercase tracking-[.22em] text-white/30">Resultados</p>
              <div className="space-y-1.5">
                {search.results.map((result) => (
                  <div key={result.id} className="group flex items-center gap-3 rounded-2xl border border-transparent p-2 transition duration-200 hover:border-white/[.07] hover:bg-white/[.04]">
                    <SpotifyTrackArtwork track={result} className="flex h-11 w-11 rounded-xl" />
                    <span className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{result.title}</b><span className="block truncate text-[9px] text-white/35">{result.artist}</span></span>
                    <button type="button" title="Tocar agora" onClick={() => void perform(() => player.playTrack(result, search.results), "Não foi possível tocar esta faixa.")} className={controlClass}><Play className="h-3.5 w-3.5 fill-current" /></button>
                    <button type="button" title="Adicionar à fila" onClick={() => void perform(() => player.addToQueue(result), "Não foi possível adicionar à fila.")} className={controlClass}><ListMusic className="h-3.5 w-3.5" /></button>
                    <select aria-label={`Adicionar ${result.title} à playlist`} defaultValue="" onChange={(event) => { const playlistId = event.target.value; if (playlistId) void perform(() => playlists.addTrack(playlistId, result), "Não foi possível adicionar à playlist."); event.target.value = ""; }} className="h-9 max-w-[130px] rounded-xl border border-white/[.08] bg-[#111214] px-2 text-[9px] text-white/45 outline-none">
                      <option value="">+ Playlist</option>
                      {playlists.playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
                    </select>
                  </div>
                ))}
                {search.status === "idle" && search.results.length === 0 && <p className="py-16 text-center text-xs text-white/25">Nenhuma faixa encontrada.</p>}
                {search.error && <p className="py-8 text-center text-xs text-red-300/70">{search.error}</p>}
              </div>
            </div>
          ) : playlists.activePlaylist ? (
            <div className="mt-6 animate-in fade-in duration-200">
              <div className="flex items-end gap-5 border-b border-white/[.07] pb-5">
                <span className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-white/[.06] shadow-2xl">{playlists.activePlaylist.coverUrl ? <img src={playlists.activePlaylist.coverUrl} alt="" className="h-full w-full object-cover" /> : <ListMusic className="h-8 w-8 text-white/15" />}</span>
                <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#1ed760]">Playlist Spotify</p><h2 className="mt-2 truncate text-3xl font-black text-white">{playlists.activePlaylist.name}</h2><p className="mt-1 line-clamp-2 text-[10px] text-white/35">{playlists.activePlaylist.description || `${playlists.activePlaylist.totalItems} faixas`}</p></div>
                <button type="button" onClick={() => void perform(() => player.playContext(playlists.activePlaylist!.uri), "Não foi possível tocar esta playlist.")} className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#1ed760] px-5 text-[9px] font-black text-black transition hover:brightness-110"><Play className="h-3.5 w-3.5 fill-current" /> Tocar playlist</button>
              </div>
              {playlists.activePlaylist.itemsRestricted && <p className="mt-4 rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3 text-[9px] leading-relaxed text-white/35">O Spotify não permite listar faixas de playlists de terceiros nesta integração. Você ainda pode tocar a playlist completa pelo botão acima.</p>}
              <div className="mt-4 space-y-1">
                {playlists.activePlaylist.items.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[.04]">
                    <span className="w-5 text-center text-[9px] tabular-nums text-white/20">{index + 1}</span><SpotifyTrackArtwork track={item} className="flex h-9 w-9 rounded-lg" /><span className="min-w-0 flex-1"><b className="block truncate text-[10px] text-white/75">{item.title}</b><span className="block truncate text-[8px] text-white/30">{item.artist}</span></span>
                    <button type="button" aria-label="Tocar faixa" onClick={() => void perform(() => player.playTrack(item, playlists.activePlaylist?.items ?? []), "Não foi possível tocar esta faixa.")} className={controlClass}><Play className="h-3 w-3 fill-current" /></button>
                    <button type="button" aria-label="Mover faixa para cima" onClick={() => void perform(() => playlists.moveTrack(index, index - 1), "Não foi possível reorganizar a playlist.")} className={controlClass}><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" aria-label="Mover faixa para baixo" onClick={() => void perform(() => playlists.moveTrack(index, index + 1), "Não foi possível reorganizar a playlist.")} className={controlClass}><ArrowDown className="h-3 w-3" /></button>
                    <button type="button" aria-label="Remover faixa" onClick={() => void perform(() => playlists.removeTrack(index), "Não foi possível remover a faixa.")} className={controlClass}><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 animate-in fade-in duration-200">
              <div className="relative flex min-h-[270px] items-center justify-center overflow-hidden rounded-[26px] border border-white/[.07] bg-white/[.025] px-10 py-8">
                {track?.coverUrl && <img src={track.coverUrl} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-[.08] blur-3xl" />}
                <div className="absolute left-5 top-5 z-30"><SpotifyRotatingMessage /></div>
                <div className="relative flex h-[190px] w-full max-w-[500px] items-center justify-center">
                  {(carouselTracks.length ? carouselTracks : [null]).map((item, index) => {
                    const offset = getSpotifyCarouselOffset(index);
                    return <SpotifyTrackArtwork key={`${item?.id || "empty"}-${index}`} track={item} style={{ transform: `translateX(${offset * 92}px) rotate(${offset * 3}deg)` }} className={`spotify-cover-card absolute flex aspect-square rounded-[22px] border border-white/10 shadow-[0_24px_55px_rgba(0,0,0,.65)] transition-all duration-200 ${offset === 0 ? "z-20 h-[190px]" : "h-[150px] opacity-55"}`} />;
                  })}
                  {track && <div className="absolute bottom-2 z-30 max-w-[190px] rounded-xl bg-black/75 px-4 py-2 text-center backdrop-blur-xl"><b className="block truncate text-[10px] text-white">{track.title}</b><span className="block truncate text-[8px] text-white/40">{track.artist}</span></div>}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-white/25">Sua biblioteca</p><h2 className="mt-1 text-xl font-black text-white">Playlists recentes</h2></div><button type="button" onClick={() => setCreatingPlaylist(true)} className="rounded-xl border border-white/[.08] px-4 py-2 text-[9px] font-bold text-white/50 hover:bg-white/[.05] hover:text-white">+ Criar playlist</button></div>
              <div className="mt-4 grid grid-cols-3 gap-3">{playlists.playlists.slice(0, 6).map((playlist) => <button key={playlist.id} type="button" onClick={() => void perform(() => playlists.openPlaylist(playlist.id), "Não foi possível abrir a playlist.")} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white/[.055]"><span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-white/[.05]">{playlist.coverUrl ? <img src={playlist.coverUrl} alt="" className="h-full w-full object-cover" /> : <ListMusic className="h-6 w-6 text-white/15" />}</span><b className="mt-3 block truncate text-[10px] text-white/80">{playlist.name}</b><span className="mt-0.5 block text-[8px] text-white/25">{playlist.totalItems} faixas</span></button>)}</div>
            </div>
          )}
        </main>

        <aside data-testid="spotify-queue" className="spotify-scrollbar min-h-0 overflow-y-auto border-l border-white/[.07] bg-white/[.012] p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-white/25">Próxima faixa</p><h3 className="mt-1 text-sm font-black text-white">Na fila</h3></div><ListMusic className="h-4 w-4 text-white/20" /></div>
          <div className="mt-4 space-y-1.5">
            {player.queue.upcoming.slice(0, 8).map((item, index) => <button key={`${item.id}-${index}`} type="button" onClick={() => void perform(() => player.playTrack(item, player.queue.upcoming), "Não foi possível tocar esta faixa.")} className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition duration-200 hover:bg-white/[.05]"><SpotifyTrackArtwork track={item} className="flex h-9 w-9 rounded-lg" /><span className="min-w-0"><b className="block truncate text-[9px] text-white/70">{item.title}</b><span className="block truncate text-[8px] text-white/25">{item.artist}</span></span></button>)}
            {player.queue.upcoming.length === 0 && <p className="rounded-xl border border-dashed border-white/[.08] px-3 py-8 text-center text-[9px] leading-relaxed text-white/25">Sua próxima faixa aparecerá aqui.</p>}
          </div>
          <div className="my-5 h-px bg-white/[.07]" />
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1ed760]/10"><Users className="h-4 w-4 text-[#1ed760]" /></span><div><h3 className="text-xs font-black text-white">Checkpoint Jam</h3><p className="text-[8px] text-white/30">Convide amigos para sugerir faixas</p></div></div>
          <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">{checkpointFriends.map((friend) => <label key={friend.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl p-2 hover:bg-white/[.04]"><input type="checkbox" aria-label={friend.name} checked={selectedFriends.has(friend.id)} onChange={() => setSelectedFriends((current) => { const next = new Set(current); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next; })} className="accent-[#1ed760]" />{friend.avatar ? <img src={friend.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">{friend.name.slice(0, 1)}</span>}<span className="truncate text-[9px] text-white/55">{friend.name}</span></label>)}</div>
          <button type="button" onClick={() => void inviteFriends()} disabled={!track || selectedFriends.size === 0 || inviting} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ed760] px-3 py-2.5 text-[9px] font-black text-black transition hover:brightness-110 disabled:opacity-30"><Send className="h-3.5 w-3.5" />{inviting ? "Enviando..." : "Enviar convite"}</button>
        </aside>
      </div>

      <div data-testid="spotify-transport" className={`mx-auto mt-3 grid h-[74px] w-full max-w-[1120px] shrink-0 grid-cols-[220px_minmax(320px,1fr)_220px] items-center rounded-[24px] px-5 shadow-[0_20px_60px_rgba(0,0,0,.45)] ${panelClass}`}>
        <div className="flex min-w-0 items-center gap-3"><SpotifyTrackArtwork track={track} className="flex h-11 w-11 rounded-xl" /><span className="min-w-0"><b className="block truncate text-[10px] text-white">{track?.title || "Nenhuma faixa"}</b><span className="block truncate text-[8px] text-white/30">{track?.artist || "Escolha uma música"}</span></span>{track?.spotifyUrl && <button type="button" aria-label="Abrir no Spotify" onClick={() => void window.electronAPI?.openExternalUrl(track.spotifyUrl)} className="text-white/20 hover:text-white"><ExternalLink className="h-3 w-3" /></button>}</div>
        <div className="px-6"><div className="flex items-center justify-center gap-3"><button type="button" aria-label="Embaralhar" onClick={() => void perform(player.toggleShuffle, "Não foi possível alterar o modo aleatório.")} className={`${controlClass} ${player.shuffle ? "bg-[#1ed760]/10 text-[#1ed760]" : ""}`}><Shuffle className="h-3.5 w-3.5" /></button><button type="button" aria-label="Faixa anterior" onClick={() => void perform(player.previousTrack, "Não foi possível voltar a faixa.")} className={controlClass}><SkipBack className="h-4 w-4" /></button><button type="button" aria-label={player.playback.paused ? "Reproduzir" : "Pausar"} disabled={!track} onClick={() => void perform(player.togglePlay, "Não foi possível controlar a reprodução.")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition duration-200 hover:scale-105 disabled:opacity-30">{player.playback.paused ? <Play className="ml-0.5 h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}</button><button type="button" aria-label="Próxima faixa" onClick={() => void perform(player.nextTrack, "Não foi possível avançar a faixa.")} className={controlClass}><SkipForward className="h-4 w-4" /></button></div><div className="mt-1 flex items-center gap-2 text-[8px] tabular-nums text-white/25"><span>{formatTime(displayedPosition)}</span><input aria-label="Posição da música" type="range" min={0} max={Math.max(1, player.playback.durationMs)} value={Math.min(displayedPosition, Math.max(1, player.playback.durationMs))} onPointerDown={() => { setSeekPosition(player.playback.positionMs); setIsSeeking(true); }} onChange={(event) => { setIsSeeking(true); setSeekPosition(Number(event.target.value)); }} onPointerUp={commitSeek} onKeyUp={commitSeek} className="h-1 min-w-0 flex-1 accent-[#1ed760]" /><span>{formatTime(player.playback.durationMs)}</span></div></div>
        <div className="flex items-center justify-end gap-3"><Volume2 className="h-3.5 w-3.5 text-white/25" /><input aria-label="Volume Spotify" type="range" min={0} max={100} value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); void player.setVolume(next / 100); }} className="w-28 accent-[#1ed760]" /></div>
      </div>
    </section>
  );
};

const SpotifyPage: React.FC<SpotifyPageProps> = ({ player, friends, language, onNotify }) => {
  const copy = SPOTIFY_COPY[language] || SPOTIFY_COPY["pt-BR"];

  if (player.status === "unconfigured" || player.status === "unsupported" || player.status === "disconnected" || player.status === "error") {
    return <section className="flex h-full items-center justify-center px-10 pb-10 font-body"><div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-black/40 p-8 text-center backdrop-blur-2xl"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1ed760]/10"><Music2 className="h-7 w-7 text-[#1ed760]" /></span><h2 className="mt-5 text-2xl font-black text-white">{copy.connectTitle}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">{copy.connectHint}</p>{player.error && <p className="mt-3 text-xs text-red-300/80">{player.error}</p>}{(player.status === "disconnected" || player.status === "error") && <button type="button" onClick={() => void player.connect()} className="mt-6 rounded-xl bg-[#1ed760] px-6 py-3 text-xs font-black text-black transition hover:brightness-110">{copy.connect}</button>}</div></section>;
  }

  if (player.status === "loading" || player.status === "connecting") return <div className="flex h-full items-center justify-center gap-3 text-sm text-white/50"><LoaderCircle className="h-5 w-5 animate-spin text-[#1ed760]" /> {copy.preparing}</div>;

  return <SpotifyReadyDashboard player={player} friends={friends} onNotify={onNotify} />;
};

export default SpotifyPage;
