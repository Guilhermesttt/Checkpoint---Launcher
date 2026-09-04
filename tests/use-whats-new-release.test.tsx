// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWhatsNewRelease } from "../src/hooks/useWhatsNewRelease";

describe("novidades por versao", () => {
  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(window, "electronAPI");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const exposeVersion = (result: Promise<string>) => {
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { getVersion: vi.fn(() => result) },
    });
  };

  it("abre a versao 3.2.4 em uma instalacao nova", async () => {
    exposeVersion(Promise.resolve("3.2.4"));

    const { result } = renderHook(() => useWhatsNewRelease(true));

    await waitFor(() => expect(result.current.release?.version).toBe("3.2.4"));
    expect(result.current.release?.highlights).toHaveLength(3);
  });

  it("nao abre uma versao que o usuario ja confirmou", async () => {
    localStorage.setItem("checkpoint:last-seen-release", "3.2.4");
    exposeVersion(Promise.resolve("3.2.4"));

    const { result } = renderHook(() => useWhatsNewRelease(true));

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.release).toBeNull();
  });

  it("espera a introducao terminar antes de consultar a versao", async () => {
    exposeVersion(Promise.resolve("3.2.4"));

    const { result, rerender } = renderHook(
      ({ enabled }) => useWhatsNewRelease(enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current.release).toBeNull();
    expect(window.electronAPI?.getVersion).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.release?.version).toBe("3.2.4"));
  });

  it("usa a versao publica do catalogo quando o IPC falha", async () => {
    exposeVersion(Promise.reject(new Error("IPC indisponivel")));

    const { result } = renderHook(() => useWhatsNewRelease(true));

    await waitFor(() => expect(result.current.release?.version).toBe("3.2.4"));
  });

  it("fecha durante a sessao mesmo quando o armazenamento falha", async () => {
    exposeVersion(Promise.resolve("3.2.4"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("armazenamento bloqueado");
    });
    const { result } = renderHook(() => useWhatsNewRelease(true));
    await waitFor(() => expect(result.current.release?.version).toBe("3.2.4"));

    act(() => result.current.dismiss());

    expect(result.current.release).toBeNull();
  });
});
