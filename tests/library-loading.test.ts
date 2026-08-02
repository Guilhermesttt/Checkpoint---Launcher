import { describe, expect, it } from "vitest";
import { resolveLibraryLoadingState, shouldShowLibraryFooter } from "../src/utils/libraryLoading";

describe("apresentacao do carregamento da biblioteca", () => {
  it("mantem os cards montados durante uma atualizacao de fundo", () => {
    expect(resolveLibraryLoadingState(true)).toEqual({
      showSkeleton: false,
      backgroundRefreshing: true,
    });
  });

  it("mostra o skeleton antes do primeiro snapshot utilizavel", () => {
    expect(resolveLibraryLoadingState(false)).toEqual({
      showSkeleton: true,
      backgroundRefreshing: false,
    });
  });
});

describe("rodape da biblioteca", () => {
  it("nao mostra contador e atalhos dentro da pagina Spotify", () => {
    expect(shouldShowLibraryFooter("SPOTIFY")).toBe(false);
    expect(shouldShowLibraryFooter("ALL")).toBe(true);
  });
});
