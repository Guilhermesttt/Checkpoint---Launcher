# 🌐 Integração GitHub Releases para a Landing Page (Pherielium)

Este guia explica como a Landing Page (`Phelierium-Landing-Page`) deve consumir as releases e instaladores do **Pherielium Game Hub** publicados no GitHub.

---

## 1. Links Rápidos / Estáticos

Se você quiser apenas colocar links diretos nos botões "Baixar para Windows", use as URLs oficiais do GitHub:

* **Download direto do instalador mais recente (`.exe`)**:
  ```html
  https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/latest/download/Pherielium-Setup.exe
  ```
  *(Nota: Enquanto houver versões anteriores com a nomenclatura Checkpoint, o GitHub apontará sempre para o arquivo lançado na tag mais recente).*

* **Página de todas as Releases no GitHub**:
  ```html
  https://github.com/Guilhermesttt/Checkpoint---Launcher/releases
  ```

* **Página da Release mais recente**:
  ```html
  https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/latest
  ```

* **Protocolo de abertura direta no app instalado (Deep Link)**:
  ```html
  pherielium://
  ```

---

## 2. Hook React / TypeScript para a Landing Page (`useLatestRelease.ts`)

Copie este arquivo para o projeto `Phelierium-Landing-Page` (ex: `src/hooks/useLatestRelease.ts`):

```typescript
import { useState, useEffect } from "react";

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeFormatted: string;
}

export interface LatestReleaseData {
  tagName: string;
  version: string;
  downloadUrl: string;
  releaseUrl: string;
  publishedAt: string;
  releaseNotes: string;
  assets: ReleaseAsset[];
  loading: boolean;
  error: string | null;
}

const GITHUB_REPO = "Guilhermesttt/Checkpoint---Launcher";
const FALLBACK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/Pherielium-Setup.exe`;
const FALLBACK_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export function useLatestRelease(): LatestReleaseData {
  const [data, setData] = useState<LatestReleaseData>({
    tagName: "v3.1.4",
    version: "3.1.4",
    downloadUrl: FALLBACK_DOWNLOAD_URL,
    releaseUrl: FALLBACK_RELEASE_URL,
    publishedAt: "",
    releaseNotes: "",
    assets: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchRelease() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
          {
            headers: {
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`GitHub API HTTP ${response.status}`);
        }

        const release = await response.json();

        // Encontra o asset do executável (.exe)
        const exeAsset = release.assets?.find((asset: { name: string }) =>
          asset.name.endsWith(".exe")
        );

        const assets: ReleaseAsset[] = (release.assets || []).map(
          (asset: { name: string; browser_download_url: string; size: number }) => ({
            name: asset.name,
            downloadUrl: asset.browser_download_url,
            sizeFormatted: (asset.size / (1024 * 1024)).toFixed(1) + " MB",
          })
        );

        if (isMounted) {
          setData({
            tagName: release.tag_name || "v3.1.4",
            version: (release.tag_name || "3.1.4").replace(/^v/, ""),
            downloadUrl: exeAsset?.browser_download_url || FALLBACK_DOWNLOAD_URL,
            releaseUrl: release.html_url || FALLBACK_RELEASE_URL,
            publishedAt: release.published_at
              ? new Date(release.published_at).toLocaleDateString("pt-BR")
              : "",
            releaseNotes: release.body || "",
            assets,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (isMounted) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : "Falha ao buscar release",
          }));
        }
      }
    }

    void fetchRelease();

    return () => {
      isMounted = false;
    };
  }, []);

  return data;
}
```

---

## 3. Exemplo de Botão de Download na Landing Page

```tsx
import React from "react";
import { useLatestRelease } from "./hooks/useLatestRelease";
import { Download, ExternalLink } from "lucide-react";

export const DownloadButton = () => {
  const { version, downloadUrl, loading } = useLatestRelease();

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <a
        href={downloadUrl}
        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-black font-heading font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:shadow-cyan-500/20"
      >
        <Download className="w-5 h-5" />
        <span>Baixar Pherielium {loading ? "" : `(v${version})`}</span>
      </a>

      <span className="text-xs text-white/50 font-ui">
        Windows 10 / 11 • 64-bit
      </span>
    </div>
  );
};
```
