// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { PlatformRemovalTransition } from "../src/components/PlatformRemovalTransition";

describe("PlatformRemovalTransition", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children directly when not active", () => {
    render(
      <PlatformRemovalTransition active={false}>
        <div data-testid="child-card">Epic Card</div>
      </PlatformRemovalTransition>,
    );

    expect(screen.getByTestId("child-card")).toBeDefined();
    expect(screen.queryByText(/desconectando plataforma.../i)).toBeNull();
  });

  it("renders removal overlay with phase label when active", () => {
    render(
      <PlatformRemovalTransition active={true} phase="removing-cloud-data">
        <div data-testid="child-card">Epic Card</div>
      </PlatformRemovalTransition>,
    );

    expect(screen.getByTestId("child-card")).toBeDefined();
    expect(screen.getByText(/desconectando plataforma.../i)).toBeDefined();
    expect(screen.getByText(/removendo dados da nuvem.../i)).toBeDefined();
  });
});
