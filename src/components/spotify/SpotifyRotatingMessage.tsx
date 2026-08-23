import * as React from "react";
import { ArrowUpRight, Sparkles, Star } from "lucide-react";

const GITHUB_URL = "https://github.com/Guilhermesttt/Checkpoint---Launcher";

interface SpotifyHeroMessage {
  eyebrow: string;
  text: string;
  href?: string;
}

const MESSAGES: readonly SpotifyHeroMessage[] = [
  { eyebrow: "Curte o Phelierium?", text: "Dê uma estrela no GitHub", href: GITHUB_URL },
  { eyebrow: "Seu jogo, seu som", text: "Jogue e crie sua própria vibe" },
  { eyebrow: "Cada partida merece uma trilha", text: "Sua música. Seu universo." },
  { eyebrow: "Phelierium Jam", text: "Convide os amigos e aumente o volume" },
];

interface SpotifyRotatingMessageProps {
  intervalMs?: number;
}

const SpotifyRotatingMessage: React.FC<SpotifyRotatingMessageProps> = ({ intervalMs = 5_000 }) => {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const message = MESSAGES[index];
  const href = message.href;

  React.useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, paused]);

  const content = (
    <span key={index} className="flex animate-in items-center gap-2.5 fade-in slide-in-from-left-1 duration-200">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[.08] bg-black/35 text-white/45 backdrop-blur-xl">
        {href ? <Star className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </span>
      <span className="text-left"><span className="block text-[7px] font-black uppercase tracking-[.2em] text-white/25">{message.eyebrow}</span><b className="mt-0.5 flex items-center gap-1 text-[9px] text-white/65">{message.text}{href && <ArrowUpRight className="h-3 w-3" />}</b></span>
    </span>
  );

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="min-h-9">
      {href
        ? <button type="button" onClick={() => void window.electronAPI?.openExternalUrl(href)} className="rounded-xl outline-none transition hover:bg-white/[.035] focus-visible:ring-2 focus-visible:ring-[#1ed760]/50">{content}</button>
        : content}
    </div>
  );
};

export default SpotifyRotatingMessage;
