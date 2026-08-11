// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import * as THREE from "three";
import { RetroRealCaseModel3D } from "../src/features/retro/shelf/RetroRealCaseModel3D";

// Mock R3F and Drei hooks to prevent crashes in jsdom
vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: {} })),
}));

vi.mock("@react-three/drei", () => {
  const mockGLTF = () => ({
    scene: {
      traverse: () => {},
      clone: () => ({
        traverse: () => {},
        getObjectByName: () => null,
        updateMatrixWorld: () => {},
      }),
    },
  });
  (mockGLTF as any).preload = () => {};
  return {
    useGLTF: mockGLTF,
  };
});

// Mock do RetroProceduralCase3D
vi.mock("../src/features/retro/shelf/RetroProceduralCase3D", () => ({
  RetroProceduralCase3D: vi.fn(() => <div data-testid="procedural-fallback" />),
}));

describe("RetroRealCaseModel3D Component & Helpers", () => {
  it("falls back to RetroProceduralCase3D for unsupported consoles", () => {
    const mockGame = {
      id: "unsupported",
      title: "Test Game",
      subtitle: "TEST",
      year: 2020,
      console: "SWITCH", // Não tem modelo GLB correspondente
      publisher: "NINTENDO",
      accent: "#ff0000",
    };

    const { getByTestId } = render(
      <RetroRealCaseModel3D
        game={mockGame}
        coverTexture={null}
        wrapTexture={null}
      />
    );

    expect(getByTestId("procedural-fallback")).toBeDefined();
  });
});
