// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("abre os perfis Steam e Discord usando os IDs públicos", () => {
    const openExternalUrl = vi.fn().mockResolvedValue(undefined);
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
        }}
        user={null}
        games={[]}
        editable={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Steam" }));
    fireEvent.click(screen.getByRole("button", { name: "Discord" }));

    expect(openExternalUrl).toHaveBeenNthCalledWith(
      1,
      "https://steamcommunity.com/profiles/76561198000000000",
    );
    expect(openExternalUrl).toHaveBeenNthCalledWith(
      2,
      "https://discord.com/users/123456789012345678",
    );
  });
});
