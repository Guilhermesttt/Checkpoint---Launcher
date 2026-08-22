import React, { useEffect } from "react";
import { PherieliumCosmicBackground } from "./components/landing/PherieliumCosmicBackground";
import { PherieliumNavbar } from "./components/landing/PherieliumNavbar";
import { PherieliumHero } from "./components/landing/PherieliumHero";
import { GamingHubSection } from "./components/landing/GamingHubSection";
import { ConsoleExperienceSection } from "./components/landing/ConsoleExperienceSection";
import { ModsSection } from "./components/landing/ModsSection";
import { AchievementsSection } from "./components/landing/AchievementsSection";
import { SocialSection } from "./components/landing/SocialSection";
import { OverlaySection } from "./components/landing/OverlaySection";
import { CustomizationSection } from "./components/landing/CustomizationSection";
import { PhilosophySection } from "./components/landing/PhilosophySection";
import { CinematicSection } from "./components/landing/CinematicSection";
import { RoadmapSection } from "./components/landing/RoadmapSection";
import { FinalCTASection } from "./components/landing/FinalCTASection";
import { PherieliumFooter } from "./components/landing/PherieliumFooter";

export default function Landing() {
  useEffect(() => {
    // Smooth document title for Pherielium
    document.title = "PHERIELIUM // Personal Gaming Hub";
  }, []);

  return (
    <main className="relative min-h-screen bg-[#030408] text-white selection:bg-[#7DFFB2] selection:text-black font-sans antialiased overflow-x-hidden">
      {/* 1. Deep Space Interactive Canvas Background */}
      <PherieliumCosmicBackground />

      {/* 2. Sleek Minimalist Floating Sci-Fi Navbar */}
      <PherieliumNavbar />

      {/* 3. Monumental Hero Section with 3D Console Mockup */}
      <PherieliumHero />

      {/* 4. Module 01: Universal Gaming Hub */}
      <GamingHubSection />

      {/* 5. Module 02: Console Experience on PC */}
      <ConsoleExperienceSection />

      {/* 6. Module 03: Nexus Mods & Direct Injection */}
      <ModsSection />

      {/* 7. Module 04: Global Trophies & RetroAchievements */}
      <AchievementsSection />

      {/* 8. Module 05: Discord-like Voice & Social Party */}
      <SocialSection />

      {/* 9. Module 06: In-Game Translucent HUD Overlay */}
      <OverlaySection />

      {/* 10. Module 07: Theme Engine & Personalization */}
      <CustomizationSection />

      {/* 11. Module 08: Philosophy (Discover, Play, Connect) */}
      <PhilosophySection />

      {/* 12. Cinematic Universe Space Moment */}
      <CinematicSection />

      {/* 13. System Roadmap (Now, Next, Future) */}
      <RoadmapSection />

      {/* 14. Final Boot Sequence CTA */}
      <FinalCTASection />

      {/* 15. Minimalist High-Tech Footer */}
      <PherieliumFooter />
    </main>
  );
}
