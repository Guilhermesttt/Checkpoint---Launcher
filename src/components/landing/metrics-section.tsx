import { useEffect, useRef, useState } from "react";

const metrics = [
  { value: "10k+", label: "Jogadores ativos", sublabel: "e crescendo todo mês" },
  { value: "50k+", label: "Jogos catalogados", sublabel: "via Steam + locais" },
  { value: "99.9%", label: "Uptime Firebase", sublabel: "disponibilidade garantida" },
  { value: "4.9★", label: "Avaliação média", sublabel: "dos usuários" },
];

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 2000;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export function MetricsSection() {
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
    <section ref={sectionRef} className="relative py-24 lg:py-32 bg-foreground text-background overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-background/50 mb-6">
            <span className="w-12 h-px bg-background/30" />
            Números Reais
            <span className="w-12 h-px bg-background/30" />
          </span>
          <h2 className={`text-5xl md:text-6xl font-display tracking-tight transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            A plataforma que jogadores escolhem
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-background/20">
          {metrics.map((metric, i) => (
            <div
              key={metric.label}
              className={`bg-foreground p-10 lg:p-14 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="text-4xl lg:text-6xl font-display mb-4 text-background">
                {metric.value}
              </div>
              <div className="text-sm font-medium text-background/80 mb-1">{metric.label}</div>
              <div className="text-xs text-background/40 font-mono">{metric.sublabel}</div>
            </div>
          ))}
        </div>

        <div className={`mt-16 text-center transition-all duration-1000 delay-500 ${isVisible ? "opacity-100" : "opacity-0"}`}>
          <blockquote className="text-2xl lg:text-3xl font-display text-background/60 max-w-3xl mx-auto leading-relaxed">
            "O Checkpoint mudou completamente como gerencio minha biblioteca. Nunca mais vou usar outro launcher."
          </blockquote>
          <cite className="mt-6 block text-sm font-mono text-background/40 not-italic">
            - Guilherme S., jogador há 12 anos
          </cite>
        </div>
      </div>
    </section>
  );
}
