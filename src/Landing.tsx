import { Navigation } from "./components/landing/navigation";
import { HeroSection } from "./components/landing/hero-section";
import { FeaturesSection } from "./components/landing/features-section";
import { HowItWorksSection } from "./components/landing/how-it-works-section";
import { IntegrationsSection } from "./components/landing/integrations-section";
import { SecuritySection } from "./components/landing/security-section";
import { CtaSection } from "./components/landing/cta-section";
import { FooterSection } from "./components/landing/footer-section";

export default function Landing() {
  return (
    <main className="relative bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <IntegrationsSection />
      <SecuritySection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
