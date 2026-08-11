// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { searchRetroAchievementGames } = vi.hoisted(() => ({
  searchRetroAchievementGames: vi.fn(),
}));
const { searchTheGamesDbGames } = vi.hoisted(() => ({
  searchTheGamesDbGames: vi.fn(),
}));

vi.mock("../src/services/retroAchievements", () => ({
  searchRetroAchievementGames,
}));
vi.mock("../src/services/theGamesDb", () => ({
  searchTheGamesDbGames,
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../src/components/ui/ModalShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { RetroAddGameModal } from "../src/features/retro/components/RetroAddGameModal";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(window, "electronAPI");
});

describe("RetroAddGameModal RetroAchievements matching", () => {
  it("stores a game ID only after the user confirms a search result", async () => {
    searchRetroAchievementGames.mockResolvedValueOnce([
      {
        id: 2782,
        title: "God of War",
        consoleId: 21,
        consoleName: "PlayStation 2",
        imageUrl: "https://media.retroachievements.org/Images/000001.png",
        achievementCount: 43,
        points: 317,
      },
    ]);
    const onSaveGame = vi.fn();

    render(
      <RetroAddGameModal
        isOpen
        onClose={vi.fn()}
        playSound={vi.fn()}
        onSaveGame={onSaveGame}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: God of War II"), {
      target: { value: "God of War" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar na RetroAchievements" }));

    expect(await screen.findByText(/43 conquistas/)).toBeInTheDocument();
    expect(onSaveGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {
      name: "Usar God of War da RetroAchievements",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar jogo" }));

    await waitFor(() => {
      expect(onSaveGame).toHaveBeenCalledWith(expect.objectContaining({
        title: "God of War",
        console: "PS2",
        retroAchievementsGameId: 2782,
      }));
    });
  });

  it("loads a complete cover image from the PC and saves it with the game", async () => {
    const onSaveGame = vi.fn();
    const imageFile = new File(["cover-bytes"], "god-of-war-wrap.png", {
      type: "image/png",
    });

    render(
      <RetroAddGameModal
        isOpen
        onClose={vi.fn()}
        playSound={vi.fn()}
        onSaveGame={onSaveGame}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: God of War II"), {
      target: { value: "God of War" },
    });
    fireEvent.change(screen.getByLabelText("Escolher capa completa do PC"), {
      target: { files: [imageFile] },
    });

    await waitFor(() => {
      expect(screen.getByAltText("Prévia da capa completa")).toHaveAttribute(
        "src",
        expect.stringMatching(/^data:image\/png;base64,/),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar jogo" }));

    await waitFor(() => expect(onSaveGame).toHaveBeenCalledWith(expect.objectContaining({
      title: "God of War",
      wrapImage: expect.stringMatching(/^data:image\/png;base64,/),
    })));
  });

  it("requires confirmation before deleting the game being edited", () => {
    const onDeleteGame = vi.fn();
    const game = {
      id: "gow",
      title: "God of War",
      subtitle: "EDIÇÃO CLÁSSICA",
      year: 2005,
      console: "PS2",
      publisher: "SONY",
      accent: "#b52322",
    };

    render(
      <RetroAddGameModal
        isOpen
        onClose={vi.fn()}
        playSound={vi.fn()}
        gameToEdit={game}
        onSaveGame={vi.fn()}
        onDeleteGame={onDeleteGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir jogo" }));
    expect(onDeleteGame).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir God of War?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(onDeleteGame).toHaveBeenCalledWith(game);
  });

  it("imports a pasted image URL before saving", async () => {
    const onSaveGame = vi.fn();
    const importRetroArtwork = vi.fn().mockResolvedValue("data:image/jpeg;base64,AQID");
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { importRetroArtwork },
    });
    render(<RetroAddGameModal isOpen onClose={vi.fn()} playSound={vi.fn()} onSaveGame={onSaveGame} />);
    fireEvent.change(screen.getByPlaceholderText("Ex: God of War II"), { target: { value: "Crash Bandicoot" } });
    fireEvent.change(screen.getByPlaceholderText("URL da imagem frontal"), { target: { value: "https://images.example/cover.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar jogo" }));

    await waitFor(() => expect(onSaveGame).toHaveBeenCalledWith(expect.objectContaining({
      coverImage: "data:image/jpeg;base64,AQID",
    })));
    expect(importRetroArtwork).toHaveBeenCalledWith("https://images.example/cover.jpg");
  });

  it("searches TheGamesDB while typing and loads RetroAchievements after selection", async () => {
    searchTheGamesDbGames.mockImplementation(async () => [{
      id: 10,
      title: "Metal Gear Solid",
      year: 1998,
      description: "Tactical espionage action.",
      publisher: "Konami",
      developer: "Konami Computer Entertainment Japan",
      platform: "Sony Playstation",
      frontImage: "https://cdn.example/front.jpg",
      backImage: "https://cdn.example/back.jpg",
      images: ["https://cdn.example/front.jpg", "https://cdn.example/back.jpg"],
    }]);
    searchRetroAchievementGames.mockResolvedValueOnce([{
      id: 11245,
      title: "Metal Gear Solid",
      consoleId: 12,
      consoleName: "PlayStation",
      imageUrl: "https://media.retroachievements.org/Images/000010.png",
      achievementCount: 48,
      points: 400,
    }]);
    const onSaveGame = vi.fn();
    const importRetroArtwork = vi.fn(async (url: string) => `data:image/jpeg;base64,${url.includes("front") ? "FRONT" : "BACK"}`);
    Object.defineProperty(window, "electronAPI", { configurable: true, value: { importRetroArtwork } });
    render(<RetroAddGameModal isOpen onClose={vi.fn()} playSound={vi.fn()} onSaveGame={onSaveGame} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.change(screen.getByPlaceholderText("Ex: God of War II"), { target: { value: "Metal Gear Solid" } });
    await waitFor(() => expect(searchTheGamesDbGames).toHaveBeenCalledWith("Metal Gear Solid"));
    fireEvent.click(await screen.findByRole("button", { name: "Usar dados de Metal Gear Solid do TheGamesDB" }));
    expect(screen.getByDisplayValue("Tactical espionage action.")).toBeInTheDocument();
    await waitFor(() => expect(searchRetroAchievementGames).toHaveBeenCalledWith("Metal Gear Solid", "PS2"));
    expect(await screen.findByText(/48 conquistas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar jogo" }));

    await waitFor(() => expect(onSaveGame).toHaveBeenCalledWith(expect.objectContaining({
      title: "Metal Gear Solid",
      year: 1998,
      publisher: "Konami",
      description: "Tactical espionage action.",
      coverImage: "data:image/jpeg;base64,FRONT",
      backImage: "data:image/jpeg;base64,BACK",
      retroAchievementsGameId: 11245,
    })));
  });

});
