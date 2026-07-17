// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../src/components/Sidebar";

afterEach(cleanup);

describe("notificacoes da sidebar", () => {
  it("mostra a quantidade pendente no item Amigos", () => {
    render(
      <Sidebar
        activeCategory="ALL"
        onCategory={vi.fn()}
        settingsLabel="Configuracoes"
        playSound={vi.fn()}
        notificationCount={4}
      />,
    );

    const friends = screen.getByRole("button", {
      name: "Amigos, 4 notificacoes",
    });
    expect(friends).toHaveAttribute("data-notification-count", "4");
    expect(friends).toHaveTextContent("4");
  });

  it("limita o texto do badge sem perder a contagem acessivel", () => {
    render(
      <Sidebar
        activeCategory="FRIENDS"
        onCategory={vi.fn()}
        settingsLabel="Configuracoes"
        playSound={vi.fn()}
        notificationCount={120}
      />,
    );

    expect(screen.getByRole("button", {
      name: "Amigos, 120 notificacoes",
    })).toHaveTextContent("99+");
  });
});
