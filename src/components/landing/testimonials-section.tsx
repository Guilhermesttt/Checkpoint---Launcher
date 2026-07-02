import { useEffect, useRef, useState } from "react";

const testimonials = [
  {
    name: "Rafael M.",
    role: "Gamer há 15 anos",
    avatar: "RM",
    text: "Finalmente um launcher que não parece uma planilha. A interface do Checkpoint é linda e tudo funciona perfeitamente.",
    games: "340 jogos",
  },
  {
    name: "Ana C.",
    role: "Streamer",
    avatar: "AC",
    text: "A integração com Steam é perfeita. Sincronizei minha biblioteca de 500+ jogos em segundos. Impressionante!",
    games: "520 jogos",
  },
  {
    name: "Lucas P.",
    role: "Dev & Gamer",
    avatar: "LP",
    text: "Como dev, aprecio o código limpo e bem estruturado. Já até contribuí com algumas melhorias no GitHub.",
    games: "180 jogos",
  },
  {
    name: "Marina F.",
    role: "RPG Enthusiast",
    avatar: "MF",
    text: "O visual PS5 me conquistou. Navegar pela biblioteca com o teclado é uma experiência de console de verdade.",
    games: "95 jogos",
  },
  {
    name: "Pedro H.",
    role: "Colecionador",
    avatar: "PH",
    text: "Nunca perdi mais tempo procurando onde instalei um jogo. O Checkpoint centralizou tudo que eu precisava.",
    games: "1200 jogos",
  },
  {
    name: "Julia R.",
    role: "Casual Gamer",
    avatar: "JR",
    text: "Nem sabia que precisava de um launcher assim até usar. Simples, rápido e bonito. Recomendo muito!",
    games: "45 jogos",
  },
];

export function TestimonialsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-[oklch(0.09_0.01_260)] text-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-white/40 mb-6">
            <span className="w-12 h-px bg-white/20" />
            Depoimentos
            <span className="w-12 h-px bg-white/20" />
          </span>
          <h2 className={`text-5xl md:text-6xl font-display tracking-tight transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            O que os jogadores dizem
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`p-8 border border-white/10 hover:border-white/20 transition-all duration-700 group ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="text-white/70 leading-relaxed mb-8 text-sm">"{t.text}"</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{t.name}</div>
                  <div className="text-xs text-white/40">{t.role} · {t.games}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
