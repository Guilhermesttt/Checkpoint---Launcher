// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../src/components/Sidebar";

afterEach(cleanup);

describe("notificacoes da sidebar", () => {
  it("separa filtros, plataformas, comunidade, mods e conta em grupos distintos", () => {
    render(
      <Sidebar
        activeCategory="ALL"
        onCategory={vi.fn()}
        settingsLabel="Ajustes"
        playSound={vi.fn()}
      />,
    );

    const filters = screen.getByRole("group", { name: "Filtros" });
    expect(within(filters).getByRole("button", { name: "Todos" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Favoritos" })).toBeInTheDocument();

    const platforms = screen.getByRole("group", { name: "Plataformas" });
    expect(within(platforms).getByRole("button", { name: "Steam" })).toBeInTheDocument();
    expect(within(platforms).getByRole("button", { name: "Epic" })).toBeInTheDocument();
    expect(within(platforms).getByRole("button", { name: "Local" })).toBeInTheDocument();
    expect(within(platforms).queryByRole("button", { name: "Amigos" })).not.toBeInTheDocument();

    const community = screen.getByRole("group", { name: "Comunidade" });
    expect(within(community).getByRole("button", { name: "Amigos" })).toBeInTheDocument();
    expect(within(community).getByRole("button", { name: "Radar" })).toBeInTheDocument();

    expect(within(screen.getByRole("group", { name: "Mods" }))
      .getByRole("button", { name: "Mods" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Conta" }))
      .getByRole("button", { name: "Perfil" })).toBeInTheDocument();
  });

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

  it("mostra o nome em um tooltip fora da sidebar e indica os botoes clicaveis", async () => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const user = userEvent.setup();
    render(
      <Sidebar
        activeCategory="ALL"
        onCategory={vi.fn()}
        settingsLabel="Ajustes"
        playSound={vi.fn()}
      />,
    );

    const settings = screen.getByRole("button", { name: "Ajustes" });
    expect(settings).toHaveClass("cursor-pointer");

    await user.hover(settings);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Ajustes");
    expect(tooltip.closest("aside")).toBeNull();
  });
});
