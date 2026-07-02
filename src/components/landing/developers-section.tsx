import { useEffect, useRef, useState } from "react";
import { Code2, Terminal, BookOpen, GitBranch } from "lucide-react";

const devFeatures = [
  {
    icon: Code2,
    title: "Open Source",
    description: "Código aberto no GitHub. Contribua, faça fork, adapte para suas necessidades.",
    href: "https://github.com",
  },
  {
    icon: Terminal,
    title: "Backend Cloudflare",
    description: "Workers na edge para integração Steam. Deploy global em menos de 500ms.",
    href: "#",
  },
  {
    icon: BookOpen,
    title: "Documentado",
    description: "Código com TypeScript estrito, comentado e pronto para extensão.",
    href: "#",
  },
  {
    icon: GitBranch,
    title: "Contribua",
    description: "PRs são bem-vindos! Ajude a construir o melhor launcher de jogos open source.",
    href: "https://github.com",
  },
];

export function DevelopersSection() {
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
    <section id="developers" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-12 h-px bg-foreground/30" />
              Para Devs
            </span>
            <h2 className={`text-5xl md:text-6xl font-display tracking-tight leading-[0.9] mb-8 transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              Construído por<br />
              <span className="text-muted-foreground">devs, para devs.</span>
            </h2>
            <p className={`text-lg text-muted-foreground leading-relaxed mb-8 transition-all duration-1000 delay-200 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}>
              Stack moderna, código limpo e bem estruturado. Explore, contribua ou use como base para seus próprios projetos.
            </p>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-3 px-6 py-3 border border-foreground/30 hover:border-foreground/60 hover:bg-foreground/5 rounded-full text-sm font-mono transition-all duration-700 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Ver no GitHub
            </a>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className={`border border-foreground/10 bg-black/50 rounded-xl overflow-hidden transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/10">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">src/services/steam.ts</span>
              </div>
              <pre className="p-6 text-sm font-mono text-green-400/80 leading-relaxed overflow-x-auto">
{`export async function syncSteamLibrary(
  uid: string, 
  steamId: string
): Promise<number> {
  const games = await fetchSteamGames(steamId);
  const batch = writeBatch(db);
  
  games.forEach(game => {
    const ref = userGameDocRef(uid, game.appid);
    batch.set(ref, mapSteamGame(game), { merge: true });
  });
  
  await batch.commit();
  return games.length; // 247 jogos sincronizados
}`}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {devFeatures.slice(0, 2).map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <a
                    key={feature.title}
                    href={feature.href}
                    className={`p-6 border border-foreground/10 hover:border-foreground/30 transition-all duration-700 group block ${
                      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: `${(i + 1) * 100}ms` }}
                  >
                    <Icon className="w-5 h-5 text-muted-foreground mb-4 group-hover:text-foreground transition-colors" />
                    <h3 className="font-display text-lg mb-2">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
