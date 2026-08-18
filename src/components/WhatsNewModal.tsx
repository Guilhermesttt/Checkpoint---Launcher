import React from "react";
import { ArrowRight, ExternalLink, Gamepad2, Music2, Sparkles, X, Search, Layers, Wrench, Mic } from "lucide-react";
import ModalShell from "./ui/ModalShell";
import type { ReleaseHighlight, ReleaseHighlights } from "../releases/releaseHighlights";

interface WhatsNewModalProps {
  release: ReleaseHighlights;
  onClose: () => void;
}

const highlightIcons: Record<ReleaseHighlight["id"], React.ComponentType<{ className?: string }>> = {
  spotify: Music2,
  controller: Gamepad2,
  stability: Sparkles,
  platforms: Layers,
  search: Search,
  mods: Wrench,
  voice: Mic,
};

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ release, onClose }) => {
  const openReleaseNotes = async () => {
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(release.releaseUrl);
      return;
    }
    window.open(release.releaseUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      zIndexClassName="z-[260]"
      backdropClassName="bg-black/85 backdrop-blur-xl"
      ariaLabel={`Novidades da versão ${release.version}`}
      gamepadPriority={260}
    >
      <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[#08090c]/98 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.1),transparent_34%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:auto,34px_34px,34px_34px]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar novidades"
          className="absolute right-5 top-5 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/35 text-white/45 transition hover:border-white/25 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative px-6 pb-6 pt-10 sm:px-9 sm:pb-9 lg:px-12 lg:pb-11 lg:pt-12">
          <header className="max-w-3xl pr-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              VERSÃO {release.version}
            </span>
            <h2 className="mt-5 font-[var(--font-display)] text-3xl font-black leading-[1.05] tracking-[-0.045em] text-white sm:text-4xl lg:text-5xl">
              {release.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-white/48 sm:text-[15px]">
              {release.description}
            </p>
          </header>

          <section className="mt-8 grid gap-3 md:grid-cols-3" aria-label="Destaques da atualização">
            {release.highlights.map((highlight, index) => {
              const Icon = highlightIcons[highlight.id];
              return (
                <article
                  key={highlight.id}
                  data-testid="release-highlight"
                  className="group min-h-44 rounded-[22px] border border-white/[0.085] bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/18 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-white/10 bg-white/[0.065] text-white/72">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-black tracking-[0.22em] text-white/18">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-base font-black tracking-[-0.025em] text-white">
                    {highlight.title}
                  </h3>
                  <p className="mt-2 text-xs font-medium leading-5 text-white/38">
                    {highlight.description}
                  </p>
                </article>
              );
            })}
          </section>

          <footer className="mt-7 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void openReleaseNotes()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white/42 transition hover:bg-white/[0.045] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Ver notas completas
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-[14px] bg-white px-7 text-xs font-black text-black transition hover:bg-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            >
              Começar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </footer>
        </div>
      </div>
    </ModalShell>
  );
};

export default WhatsNewModal;
