import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
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
  X,
} from "lucide-react";
import { useSpotifyPlayer } from "../../hooks/useSpotifyPlayer";
import { sendChatMessage } from "../../services/chat";
import type { SocialFriend } from "../../types/domain";
import type { SpotifyTrack } from "../../services/spotify";

interface SpotifyDockProps {
  friends: SocialFriend[];
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
}

const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const SpotifyDock: React.FC<SpotifyDockProps> = ({ friends, onNotify }) => {
  const player = useSpotifyPlayer();
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [selectedFriends, setSelectedFriends] = React.useState<Set<string>>(new Set());
  const [inviting, setInviting] = React.useState(false);
  const [volume, setVolume] = React.useState(55);
  const playbackRef = React.useRef(player.playback);
  const musicSuggestionSentRef = React.useRef(false);
  const track = player.playback.track;
  const checkpointFriends = friends.filter((friend) => friend.id.startsWith("cp-friend:"));
  const progress = player.playback.durationMs > 0
    ? Math.min(100, (player.playback.positionMs / player.playback.durationMs) * 100)
    : 0;

  React.useEffect(() => {
    playbackRef.current = player.playback;
  }, [player.playback]);

  React.useEffect(() => {
    if (!onNotify) return;
    const delay = 120_000 + Math.floor(Math.random() * 120_000);
    const timer = window.setTimeout(() => {
      const currentPlayback = playbackRef.current;
      if (musicSuggestionSentRef.current || (currentPlayback.track && !currentPlayback.paused)) return;
      musicSuggestionSentRef.current = true;
      onNotify("Ei, você! Que tal uma musiquinha para elevar o teu game?", "info");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [onNotify]);

  const submitSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      setResults(await player.search(query));
    } catch (reason) {
      onNotify?.(reason instanceof Error ? reason.message : "Falha ao buscar no Spotify.", "error");
    } finally {
      setSearching(false);
    }
  };

  const startTrack = async (selectedTrack: SpotifyTrack) => {
    try {
      await player.playTrack(selectedTrack);
      setResults([]);
    } catch (reason) {
      onNotify?.(
        reason instanceof Error ? reason.message : "Nao foi possivel iniciar a musica.",
        "error",
      );
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
      "🎧 Convite para uma Checkpoint Session",
      `${track.title} — ${track.artist}`,
      track.spotifyUrl,
      "Entre na conversa para sugerir a proxima faixa.",
    ].join("\n");
    try {
      await Promise.all(Array.from(selectedFriends, (friendId) =>
        sendChatMessage(friendId.replace(/^cp-friend:/, ""), message)));
      onNotify?.("Convites da Session enviados.", "success");
      setSelectedFriends(new Set());
      setSessionOpen(false);
    } catch (reason) {
      onNotify?.(reason instanceof Error ? reason.message : "Nao foi possivel enviar os convites.", "error");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div
      data-testid="spotify-dock"
      className="fixed right-7 top-24 z-[85] flex flex-col-reverse items-end font-body"
    >
      <AnimatePresence>
        {expanded && (
          <motion.section
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 max-h-[calc(100dvh-11rem)] w-[390px] overflow-y-auto rounded-[24px] border border-white/10 bg-[#09090c]/95 shadow-[0_26px_80px_rgba(0,0,0,.62)] backdrop-blur-3xl"
          >
            <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1ed760] shadow-[0_0_14px_rgba(30,215,96,.55)]" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white">Spotify</p>
                  <p className="text-[9px] text-white/35">Checkpoint Player</p>
                </div>
              </div>
              <button type="button" aria-label="Fechar Spotify" onClick={() => setExpanded(false)} className="rounded-full p-2 text-white/35 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </header>

            {player.status === "unconfigured" && (
              <div className="p-5">
                <p className="text-sm font-bold text-white">Spotify ainda não configurado</p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/45">Adicione o Client ID em <code className="text-[#1ed760]">VITE_SPOTIFY_CLIENT_ID</code> e cadastre <code className="text-white/70">http://127.0.0.1:43821/callback</code> no painel Spotify.</p>
              </div>
            )}

            {player.status === "unsupported" && (
              <div className="p-5">
                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
                  <p className="text-sm font-bold text-white">Spotify indisponível nesta versão</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/45">{player.error}</p>
                </div>
              </div>
            )}

            {(player.status === "disconnected" || player.status === "error") && (
              <div className="p-5">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                  <p className="text-sm font-bold text-white">Sua música, dentro do jogo.</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">Conecte uma conta Premium para transformar o Checkpoint em um dispositivo Spotify Connect.</p>
                  {player.error && <p className="mt-2 text-[10px] text-red-300/80">{player.error}</p>}
                  <button type="button" onClick={() => void player.connect()} className="mt-4 w-full rounded-xl bg-[#1ed760] px-4 py-2.5 text-[11px] font-black text-black transition hover:brightness-110">
                    Conectar Spotify
                  </button>
                </div>
              </div>
            )}

            {player.status === "connecting" && (
              <div className="flex items-center justify-center gap-2 p-8 text-xs text-white/50">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Preparando o player...
              </div>
            )}

            {player.status === "ready" && (
              <>
                <div className="p-5">
                  {player.remoteMode && (
                    <div className="mb-4 rounded-xl border border-[#1ed760]/15 bg-[#1ed760]/[0.06] px-3 py-2 text-[9px] leading-relaxed text-white/50">
                      Áudio no dispositivo Spotify ativo; controles e fila permanecem no Checkpoint.
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06]">
                      {track?.coverUrl ? <img src={track.coverUrl} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-7 w-7 text-white/25" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#1ed760]">Tocando agora</p>
                      <h3 className="mt-1 truncate text-base font-bold text-white">{track?.title || "Escolha uma música"}</h3>
                      <p className="truncate text-[11px] text-white/42">{track?.artist || "Busque no catálogo do Spotify"}</p>
                      {track?.spotifyUrl && (
                        <button type="button" onClick={() => void window.electronAPI?.openExternalUrl(track.spotifyUrl)} className="mt-2 flex items-center gap-1 text-[9px] text-white/35 hover:text-white">
                          Abrir no Spotify <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#1ed760] transition-[width]" style={{ width: `${progress}%` }} /></div>
                    <div className="mt-1.5 flex justify-between text-[9px] tabular-nums text-white/30"><span>{formatTime(player.playback.positionMs)}</span><span>{formatTime(player.playback.durationMs)}</span></div>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-5">
                    <button type="button" aria-label="Faixa anterior" onClick={() => void player.previousTrack()} className="text-white/45 hover:text-white"><SkipBack className="h-4 w-4" /></button>
                    <button type="button" aria-label={player.playback.paused ? "Reproduzir" : "Pausar"} disabled={!track} onClick={() => void player.togglePlay()} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black disabled:opacity-30">
                      {player.playback.paused ? <Play className="ml-0.5 h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
                    </button>
                    <button type="button" aria-label="Próxima faixa" onClick={() => void player.nextTrack()} className="text-white/45 hover:text-white"><SkipForward className="h-4 w-4" /></button>
                  </div>

                  <div className="mt-4 flex items-center gap-3"><Volume2 className="h-3.5 w-3.5 text-white/30" /><input aria-label="Volume Spotify" type="range" min={0} max={100} value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); void player.setVolume(next / 100); }} className="w-full accent-[#1ed760]" /></div>

                  <form onSubmit={(event) => void submitSearch(event)} className="relative mt-5">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar música ou artista" className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.04] pl-9 pr-10 text-[11px] text-white outline-none focus:border-[#1ed760]/40" />
                    <button type="submit" aria-label="Buscar no Spotify" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/35 hover:bg-white/10 hover:text-white">{searching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5 -rotate-90" />}</button>
                  </form>

                  {results.length > 0 && <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">{results.map((result) => (
                    <button key={result.id} type="button" onClick={() => void startTrack(result)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06]">
                      <img src={result.coverUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /><span className="min-w-0 flex-1"><b className="block truncate text-[11px] text-white">{result.title}</b><span className="block truncate text-[9px] text-white/35">{result.artist}</span></span><Play className="h-3 w-3 text-[#1ed760]" />
                    </button>
                  ))}</div>}
                </div>

                <div className="border-t border-white/[0.07] p-4">
                  <button type="button" onClick={() => setSessionOpen((open) => !open)} disabled={!track} className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-left disabled:opacity-35">
                    <span className="flex items-center gap-3"><Users className="h-4 w-4 text-[#1ed760]" /><span><b className="block text-[11px] text-white">Criar Session</b><span className="block text-[9px] text-white/35">Convide amigos para sugerir faixas</span></span></span><ChevronDown className={`h-3.5 w-3.5 text-white/30 transition ${sessionOpen ? "rotate-180" : ""}`} />
                  </button>
                  {sessionOpen && (
                    <div className="mt-2 rounded-xl border border-white/[0.06] bg-black/30 p-3">
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/35">Convidar amigos</p>
                      <div className="max-h-28 space-y-1 overflow-y-auto">
                        {checkpointFriends.length === 0 && <p className="py-2 text-[10px] text-white/35">Adicione amigos Checkpoint para criar uma Session.</p>}
                        {checkpointFriends.map((friend) => <label key={friend.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05]"><input aria-label={friend.name} type="checkbox" checked={selectedFriends.has(friend.id)} onChange={() => toggleFriend(friend.id)} className="accent-[#1ed760]" />{friend.avatar ? <img src={friend.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[9px]">{friend.name.slice(0, 1)}</span>}<span className="text-[10px] text-white/70">{friend.name}</span></label>)}
                      </div>
                      <button type="button" onClick={() => void inviteFriends()} disabled={selectedFriends.size === 0 || inviting} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-[10px] font-black text-black disabled:opacity-35"><Send className="h-3 w-3" />{inviting ? "Enviando..." : "Enviar convite"}</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label="Abrir Spotify"
        onClick={() => setExpanded((open) => !open)}
        className="group flex max-w-[300px] items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0b0e]/92 p-2.5 pr-4 shadow-[0_16px_50px_rgba(0,0,0,.5)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-white/20"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1ed760]/12">{track?.coverUrl ? <img src={track.coverUrl} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-4 w-4 text-[#1ed760]" />}</span>
        <span className="min-w-0 text-left"><b className="block truncate text-[10px] text-white">{track?.title || "Spotify"}</b><span className="block truncate text-[9px] text-white/35">{track?.artist || (player.status === "ready" ? "Escolha uma música" : "Conectar player")}</span></span>
        {track && !player.playback.paused && <span className="ml-1 flex h-4 items-end gap-[2px]">{[8, 14, 10].map((height, index) => <i key={index} className="w-[2px] animate-pulse rounded-full bg-[#1ed760]" style={{ height, animationDelay: `${index * 120}ms` }} />)}</span>}
      </button>
    </div>
  );
};

export default SpotifyDock;
