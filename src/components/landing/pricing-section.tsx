import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Grátis",
    description: "Para quem quer começar agora",
    price: "R$ 0",
    period: "para sempre",
    features: [
      "Biblioteca ilimitada",
      "Integração Steam",
      "Jogos locais",
      "Interface premium",
      "Sync na nuvem",
      "Suporte da comunidade",
    ],
    cta: "Baixar Agora",
    href: "/download",
    highlight: false,
  },
  {
    name: "Pro",
    description: "Para jogadores sérios",
    price: "Em breve",
    period: "",
    features: [
      "Tudo do Grátis",
      "Estatísticas avançadas",
      "Backup automático",
      "Temas personalizados",
      "Suporte prioritário",
      "Acesso antecipado a novidades",
    ],
    cta: "Entrar na lista de espera",
    href: "#",
    highlight: true,
  },
];

export function PricingSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pricing" ref={sectionRef} className="relative py-32 lg:py-40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-8 mb-20">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-8">
              <span className="w-12 h-px bg-foreground/30" />
              Planos
            </span>
            <h2 className={`text-6xl md:text-7xl lg:text-[100px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              Simples &<br />
              <span style={{ WebkitTextStroke: "1.5px currentColor", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                transparente.
              </span>
            </h2>
          </div>
          <div className="lg:col-span-5 flex items-end">
            <p className={`text-lg text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}>
              O Checkpoint é e sempre será gratuito para uso básico. Funcionalidades avançadas chegam em breve.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 max-w-3xl">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative border transition-all duration-700 p-10 ${
                plan.highlight
                  ? "border-foreground"
                  : "border-foreground/10"
              } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-8">
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-mono uppercase tracking-widest">
                    Em breve
                  </span>
                </div>
              )}

              <div className="mb-8 pb-8 border-b border-foreground/10">
                <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-2xl lg:text-3xl font-display mt-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-4xl lg:text-5xl font-display">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground text-sm ml-2">{plan.period}</span>}
              </div>

              <ul className="space-y-3 mb-10">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  plan.highlight
                    ? "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
