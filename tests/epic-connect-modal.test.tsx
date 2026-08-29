// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EpicConnectModal } from "../src/components/settings/EpicConnectModal";

describe("EpicConnectModal", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders correctly and allows entering code directly", async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const playSound = vi.fn();

    render(
      <EpicConnectModal
        isOpen={true}
        onClose={onClose}
        onConnect={onConnect}
        playSound={playSound}
      />,
    );

    const input = screen.getByPlaceholderText(/cole o código aqui/i);
    fireEvent.change(input, { target: { value: "test-auth-code-12345" } });

    const submitBtn = screen.getByRole("button", { name: /conectar conta/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onConnect).toHaveBeenCalledWith("test-auth-code-12345");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("triggers openEpicLoginWindow when clicking automatic login button", async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const playSound = vi.fn();

    const mockOpenEpicLoginWindow = vi.fn().mockResolvedValue("auto-code-xyz");
    Object.defineProperty(window, "electronAPI", {
      value: {
        openEpicLoginWindow: mockOpenEpicLoginWindow,
      },
      configurable: true,
      writable: true,
    });

    render(
      <EpicConnectModal
        isOpen={true}
        onClose={onClose}
        onConnect={onConnect}
        playSound={playSound}
      />,
    );

    const autoBtn = screen.getByText(/abrir login da epic/i);
    fireEvent.click(autoBtn);

    await waitFor(() => {
      expect(mockOpenEpicLoginWindow).toHaveBeenCalled();
      expect(onConnect).toHaveBeenCalledWith("auto-code-xyz");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("displays phase label during connecting operationState", () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const playSound = vi.fn();

    render(
      <EpicConnectModal
        isOpen={true}
        onClose={onClose}
        onConnect={onConnect}
        playSound={playSound}
        operationState={{
          status: "connecting",
          operationId: "op-1",
          phase: "authenticating",
        }}
      />,
    );

    expect(screen.getByText(/autenticando.../i)).toBeDefined();
  });
});
