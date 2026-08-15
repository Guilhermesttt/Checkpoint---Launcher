/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({
    userProfile: { retroAchievementsUlid: null, retroAchievementsUsername: undefined },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("../../../context/PreferencesContext", () => ({
  usePreferences: () => ({
    retroMusicEnabled: true,
    setRetroMusicEnabled: vi.fn(),
    retroCrtEnabled: true,
    setRetroCrtEnabled: vi.fn(),
    retroReducedMotion: false,
    setRetroReducedMotion: vi.fn(),
    musicVolume: 40,
    setMusicVolume: vi.fn(),
    effectsVolume: 30,
    setEffectsVolume: vi.fn(),
  }),
}));

describe("RetroSettingsPanel", () => {
  it("renders retro configuration sections", async () => {
    const { RetroSettingsPanel } = await import(
      "../src/features/retro/components/RetroSettingsPanel"
    );

    render(<RetroSettingsPanel />);

    expect(screen.getByText("configurações")).toBeInTheDocument();
    expect(screen.getByText("trilha emotion engine")).toBeInTheDocument();
    expect(screen.getByText("retroachievements")).toBeInTheDocument();
    expect(screen.getByText("filtro crt")).toBeInTheDocument();
  });

  it("shows volume sliders", async () => {
    const { RetroSettingsPanel } = await import(
      "../src/features/retro/components/RetroSettingsPanel"
    );

    render(<RetroSettingsPanel />);
    expect(screen.getByLabelText("volume da música")).toBeInTheDocument();
    expect(screen.getByLabelText("volume dos efeitos")).toBeInTheDocument();
  });
});
