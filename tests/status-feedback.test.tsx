// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  categorizeError,
  ErrorBanner,
  EmptyState,
  GameCardSkeleton,
  ListRowSkeleton,
} from "../src/components/ui/StatusFeedback";

describe("StatusFeedback - Error Categorization", () => {
  it("categoriza erros de rede corretamente", () => {
    const error = new Error("Failed to fetch games list");
    const result = categorizeError(error);
    expect(result.kind).toBe("network");
    expect(result.title).toBe("Falha de Conexão");
  });

  it("categoriza erros de autorização e sessão expirada", () => {
    const error = { message: "JWT token expired" };
    const result = categorizeError(error);
    expect(result.kind).toBe("auth");
    expect(result.title).toBe("Sessão Expirada");
  });

  it("categoriza timeouts", () => {
    const error = { message: "Request timed out after 10000ms" };
    const result = categorizeError(error);
    expect(result.kind).toBe("timeout");
    expect(result.title).toBe("Tempo Limite Excedido");
  });

  it("classifica outros erros como regra de negócio", () => {
    const error = { message: "Nome do jogo já cadastrado." };
    const result = categorizeError(error);
    expect(result.kind).toBe("business");
    expect(result.message).toBe("Nome do jogo já cadastrado.");
  });

  it("trata valores nulos ou vazios de forma segura", () => {
    const result = categorizeError(null);
    expect(result.kind).toBe("unknown");
  });
});

describe("StatusFeedback - ErrorBanner Component", () => {
  it("renderiza a mensagem de erro no formato banner", () => {
    render(<ErrorBanner error="Falha ao sincronizar Steam" />);
    expect(screen.getByText(/Falha ao sincronizar Steam/i)).toBeDefined();
  });

  it("executa callback de retry ao clicar no botão", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner error="Erro no download" onRetry={onRetry} />);
    const retryBtn = screen.getByRole("button", { name: /tentar/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("permite dispensar o aviso com onDismiss", () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner error="Aviso simples" onDismiss={onDismiss} />);
    const closeBtn = screen.getByLabelText("Fechar aviso");
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("StatusFeedback - EmptyState Component", () => {
  it("renderiza título, descrição e ações", () => {
    const onPrimary = vi.fn();
    render(
      <EmptyState
        title="Nenhum troféu conquistado"
        description="Jogue títulos compatíveis para desbloquear conquistas."
        primaryAction={{ label: "Explorar Jogos", onClick: onPrimary }}
      />
    );

    expect(screen.getByText("Nenhum troféu conquistado")).toBeDefined();
    expect(screen.getByText("Jogue títulos compatíveis para desbloquear conquistas.")).toBeDefined();

    const actionBtn = screen.getByText("Explorar Jogos");
    fireEvent.click(actionBtn);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("StatusFeedback - Skeletons", () => {
  it("renderiza número correto de cards no skeleton", () => {
    const { container } = render(<GameCardSkeleton count={3} />);
    // Deve renderizar 3 blocos de cards
    expect(container.querySelectorAll(".aspect-\\[16\\/10\\]").length).toBe(3);
  });

  it("renderiza número correto de linhas no ListRowSkeleton", () => {
    const { container } = render(<ListRowSkeleton count={4} />);
    expect(container.querySelectorAll(".backdrop-blur-lg").length).toBe(4);
  });
});
