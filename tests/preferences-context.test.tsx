// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

import { PreferencesProvider, usePreferences } from "../src/context/PreferencesContext";

const PreferenceProbe = () => {
  const preferences = usePreferences();
  return (
    <div>
      <output data-testid="behavior-state">
        {`${preferences.minimizeToTrayOnClose}:${preferences.restoreLastScreen}:${preferences.confirmBeforeExit}:${preferences.preferencesHydrated}`}
      </output>
      <button type="button" onClick={() => preferences.setRestoreLastScreen(true)}>
        Restaurar tela
      </button>
    </div>
  );
};

describe("preferencias de comportamento do aplicativo", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    Reflect.deleteProperty(window, "electronAPI");
  });

  it("hidrata as preferencias salvas para o usuario autenticado", async () => {
    localStorage.setItem("checkpoint_minimize_to_tray_user-1", "false");
    localStorage.setItem("checkpoint_restore_last_screen_user-1", "true");
    localStorage.setItem("checkpoint_confirm_before_exit_user-1", "false");

    render(
      <PreferencesProvider>
        <PreferenceProbe />
      </PreferencesProvider>,
    );

    expect(await screen.findByTestId("behavior-state")).toHaveTextContent("false:true:false:true");
  });

  it("persiste alteracoes usando uma chave isolada por usuario", async () => {
    render(
      <PreferencesProvider>
        <PreferenceProbe />
      </PreferencesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("behavior-state")).toHaveTextContent("true:false:true:true");
    });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar tela" }));

    await waitFor(() => {
      expect(localStorage.getItem("checkpoint_restore_last_screen_user-1")).toBe("true");
    });
  });
});
