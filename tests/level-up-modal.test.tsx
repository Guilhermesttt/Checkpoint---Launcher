// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

afterEach(() => {
  cleanup();
});

import { LevelUpModal } from "../src/components/LevelUpModal";

describe("LevelUpModal", () => {
  it("não renderiza nada se nenhum evento de level-up for disparado", () => {
    const { container } = render(<LevelUpModal />);
    expect(container.firstChild).toBeNull();
  });

  it("exibe o modal ao receber o evento checkpoint:level-up e fecha no botão continuar", () => {
    render(<LevelUpModal />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("checkpoint:level-up", {
          detail: {
            oldLevel: 4,
            newLevel: 5,
            levelInfo: {
              level: 5,
              xp: 600,
              progress: 25,
              tierName: "Bronze 2",
              rankColor: "#ca8a04",
            },
          },
        })
      );
    });

    expect(screen.getAllByText(/Subiu de Nível/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nv\.\s*4/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nv\.\s*5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bronze 2").length).toBeGreaterThan(0);

    // Clica em Continuar
    act(() => {
      const continueBtn = screen.getAllByRole("button", { name: /continuar/i })[0];
      fireEvent.click(continueBtn);
    });

    expect(screen.queryAllByText(/Subiu de Nível/i)).toHaveLength(0);
  });

  it("fecha ao pressionar a tecla Escape", () => {
    render(<LevelUpModal />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("checkpoint:level-up", {
          detail: {
            oldLevel: 9,
            newLevel: 10,
            levelInfo: {
              level: 10,
              xp: 1500,
              progress: 0,
              tierName: "Prata 1",
              rankColor: "#94a3b8",
            },
          },
        })
      );
    });

    expect(screen.getAllByText(/Subiu de Nível/i).length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryAllByText(/Subiu de Nível/i)).toHaveLength(0);
  });
});
