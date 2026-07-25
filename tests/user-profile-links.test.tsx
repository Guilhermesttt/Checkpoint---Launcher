// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UserProfilePage from "../src/components/UserProfilePage";

vi.mock("../src/hooks/useGamepadNavigation", () => ({
  useGamepadNavigation: () => undefined,
}));

describe("links externos do perfil", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: undefined,
    });
  });

  it("abre a Steam e copia o nickname do Discord no perfil do amigo", async () => {
    const openExternalUrl = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { openExternalUrl },
    });

    render(
      <UserProfilePage
        userProfile={{
          uid: "friend-1",
          displayName: "Amigo",
          steamId: "76561198000000000",
          discordId: "123456789012345678",
          discordUsername: "AmigoDiscord",
        }}
        user={null}
        games={[]}
        editable={false}
        copyFriendDiscord
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Steam" }));
    fireEvent.click(screen.getByRole("button", { name: "AmigoDiscord" }));

    expect(openExternalUrl).toHaveBeenNthCalledWith(
      1,
      "https://steamcommunity.com/profiles/76561198000000000",
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("AmigoDiscord"));
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
  });
});
