import { useEffect, useRef, useState } from "react";
import { Monitor, HardDrive, Cpu, Wifi } from "lucide-react";

const pillars = [
  {
    icon: Monitor,
    title: "Interface Nativa",
    description: "Roda no browser com performance de app nativo. WebView opcional para desktop.",
  },
  {
    icon: HardDrive,
    title: "Armazenamento Local",
    description: "ConfiguraÃ§Ãµes e cache mantidos localmente para acesso offline rÃ¡pido.",
  },
  {
    icon: Cpu,
    title: "Leve & RÃ¡pido",
    description: "Zero dependÃªncias pesadas. Carrega em menos de 2 segundos, sempre.",
  },
  {
    icon: Wifi,
    title: "Sync em Tempo Real",
    description: "Firestore garante que sua biblioteca esteja atualizada em todos os dispositivos.",
  },
];

export function InfrastructureSection() {
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
    <section id="infra" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-12 h-px bg-foreground/30" />
              Arquitetura
            </span>
            <h2 className={`text-5xl md:text-6xl lg:text-7xl font-display tracking-tight leading-[0.9] mb-8 transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              ConstruÃ­do para<br />
              <span className="text-muted-foreground">durar.</span>
            </h2>
            <p className={`text-lg text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}>
              Tecnologia moderna com foco em performance e confiabilidade. React + Vite + Firebase â€” stack battle-tested por milhÃµes.
            </p>

            <div className={`flex flex-wrap gap-3 mt-8 transition-all duration-1000 delay-300 ${isVisible ? "opacity-100" : "opacity-0"}`}>
              {["React", "TypeScript", "Firebase", "Vite", "Tailwind", "Framer Motion"].map((tech) => (
                <span key={tech} className="px-3 py-1.5 border border-foreground/20 text-xs font-mono text-muted-foreground rounded-full hover:border-foreground/50 transition-colors cursor-default">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pillars.map((pillar, i) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className={`p-8 border border-foreground/10 hover:border-foreground/30 transition-all duration-700 group ${
                      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5 text-foreground/60" />
                    </div>
                    <h3 className="font-display text-xl mb-3">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`mt-20 border border-foreground/10 p-8 lg:p-12 transition-all duration-1000 delay-400 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl border border-foreground/20 bg-foreground/5 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">ðŸ‘¤</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">VocÃª</span>
            </div>

            <div className="flex-1 h-px border-t border-dashed border-foreground/20 hidden lg:block" />

            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl border border-foreground bg-foreground/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-display">CP</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">Checkpoint</span>
            </div>

            <div className="flex-1 h-px border-t border-dashed border-foreground/20 hidden lg:block" />

            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: "ðŸŽ®", label: "Steam" },
                { emoji: "ðŸ”¥", label: "Firebase" },
                { emoji: "ðŸ–¥ï¸", label: "Local Games" },
                { emoji: "â˜ï¸", label: "Cloud Sync" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="w-12 h-12 rounded-xl border border-foreground/20 bg-foreground/5 flex items-center justify-center mx-auto mb-1">
                    <span className="text-xl">{s.emoji}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
