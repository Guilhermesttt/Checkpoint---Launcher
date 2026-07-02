import { useEffect, useRef, useState } from "react";
import { Shield, Lock, Eye, Database } from "lucide-react";

const securityPoints = [
  {
    icon: Lock,
    title: "Autenticacao Firebase",
    description:
      "Login com Firebase Auth usando Google ou e-mail/senha. Cada usuario acessa apenas os proprios dados.",
  },
  {
    icon: Eye,
    title: "Importacao com Consentimento",
    description:
      "Sua biblioteca Steam so e importada quando voce conecta a conta e inicia a sincronizacao.",
  },
  {
    icon: Database,
    title: "Chaves no Backend",
    description:
      "A chave da Steam fica no servidor. O usuario nao precisa criar, informar ou salvar uma API key.",
  },
  {
    icon: Shield,
    title: "Open Source Friendly",
    description:
      "Codigo auditavel e transparencia sobre como seus dados sao usados.",
  },
];

export function SecuritySection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="security"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[oklch(0.09_0.01_260)] text-white overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-green-500/[0.03] blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-white/40 mb-6">
              <span className="w-12 h-px bg-white/20" />
              Seguranca
            </span>
            <h2
              className={`text-5xl md:text-6xl lg:text-7xl font-display tracking-tight leading-[0.9] mb-8 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              Seus dados,<br />
              <span className="text-white/30">suas regras.</span>
            </h2>
            <p
              className={`text-lg text-white/50 leading-relaxed transition-all duration-1000 delay-200 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              Privacidade nao e um recurso adicional. E o padrao. Construimos
              o Checkpoint com seguranca em mente desde o primeiro dia.
            </p>

            <div
              className={`mt-8 inline-flex items-center gap-3 px-5 py-3 border border-green-500/30 bg-green-500/10 rounded-full transition-all duration-1000 delay-400 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-mono text-green-400">
                Chave Steam protegida no backend
              </span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {securityPoints.map((point, i) => {
                const Icon = point.icon;
                return (
                  <div
                    key={point.title}
                    className={`p-8 border border-white/10 hover:border-white/20 transition-all duration-700 group ${
                      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5 text-green-400/70" />
                    </div>
                    <h3 className="font-display text-lg mb-3 text-white">
                      {point.title}
                    </h3>
                    <p className="text-sm text-white/40 leading-relaxed">
                      {point.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
