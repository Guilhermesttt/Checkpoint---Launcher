import React from "react";
import { Compass, Play, Users, Sparkles, ArrowUpRight } from "lucide-react";

export const PhilosophySection: React.FC = () => {
  const pillars = [
    {
      num: "01",
      tag: "DISCOVER",
      title: "Descubra e Centralize",
      desc: "Localize seus jogos, bibliotecas, mods do Nexus e notícias do ecossistema sem abrir múltiplas abas e apps.",
      icon: Compass,
    },
    {
      num: "02",
      tag: "PLAY",
      title: "Jogue em 1 Clique",
      desc: "Inicie qualquer jogo nativo de PC ou emulado imediatamente, com suporte nativo a controle e HUD no jogo.",
      icon: Play,
    },
    {
      num: "03",
      tag: "CONNECT",
      title: "Conecte-se com Amigos",
      desc: "Entre em chamadas de voz com áudio HD, transmita gameplays e acompanhe o que seus amigos estão jogando.",
      icon: Users,
    },
  ];

  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5 bg-[#05070B]/70">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
            // 08. CORE PHILOSOPHY
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
            BUILT AROUND <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
              PLAYING.
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            O Pherielium foi desenhado em torno de como você realmente joga e se diverte —
            e não em torno de lojas corporativas, DRM invasivo ou plataformas isoladas.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.num}
                className="group relative rounded-3xl border border-white/10 bg-[#080B10] p-8 hover:border-[#7DFFB2]/50 hover:shadow-[0_0_30px_rgba(125,255,178,0.15)] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-2xl font-black font-mono text-white/20 group-hover:text-[#7DFFB2] transition-colors">
                      {p.num}
                    </span>
                    <div className="h-10 w-10 rounded-2xl bg-[#7DFFB2]/10 border border-[#7DFFB2]/20 flex items-center justify-center text-[#7DFFB2] group-hover:scale-110 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
                    // {p.tag}
                  </div>
                  <h3 className="text-lg font-bold text-white font-mono mb-3">{p.title}</h3>
                  <p className="text-sm text-[#98A3B3] font-light leading-relaxed font-sans">
                    {p.desc}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-white/40 group-hover:text-white transition-colors">
                  <span>SISTEMA ATIVO</span>
                  <ArrowUpRight className="h-4 w-4 text-[#7DFFB2]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
