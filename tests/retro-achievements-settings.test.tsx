// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("RetroAchievementsSettingsCard", () => {
  it("submits the typed username and exposes its connected state", async () => {
    const { RetroAchievementsSettingsCard } = await import(
      "../src/features/retro/components/RetroAchievementsSettingsCard"
    );
    const onConnect = vi.fn().mockResolvedValue(undefined);

    const view = render(
      <RetroAchievementsSettingsCard
        connected={false}
        busy={false}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Usuário RetroAchievements"), {
      target: { value: " MaxMilyin " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Conectar RetroAchievements" }));

    await waitFor(() => expect(onConnect).toHaveBeenCalledWith("MaxMilyin"));

    view.rerender(
      <RetroAchievementsSettingsCard
        username="MaxMilyin"
        connected
        busy={false}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />,
    );
    expect(screen.getByText("MaxMilyin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desconectar RetroAchievements" }))
      .toBeInTheDocument();
  });
});
