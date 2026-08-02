// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpotifySearch } from "../src/hooks/useSpotifySearch";

afterEach(() => vi.useRealTimers());

describe("busca Spotify ao vivo", () => {
  it("espera 350ms e ignora consultas curtas", async () => {
    vi.useFakeTimers();
    const search = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useSpotifySearch(search));

    act(() => result.current.setQuery("a"));
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(search).not.toHaveBeenCalled();

    act(() => result.current.setQuery("after"));
    await act(async () => { vi.advanceTimersByTime(349); await Promise.resolve(); });
    expect(search).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith("after");
  });

  it("nao deixa uma resposta antiga substituir a busca mais nova", async () => {
    vi.useFakeTimers();
    let resolveOld!: (value: any[]) => void;
    const search = vi.fn()
      .mockReturnValueOnce(new Promise<any[]>((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce([{ id: "new", title: "New" }]);
    const { result } = renderHook(() => useSpotifySearch(search as any));

    act(() => result.current.setQuery("old"));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    act(() => result.current.setQuery("new"));
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.results[0]?.id).toBe("new");

    await act(async () => { resolveOld([{ id: "old", title: "Old" }]); await Promise.resolve(); });
    expect(result.current.results[0]?.id).toBe("new");
  });
});
