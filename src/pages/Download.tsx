import { Download, Monitor, ShieldCheck } from "lucide-react";

const WINDOWS_PORTABLE_URL = "/download/Checkpoint-Launcher-Windows.zip";

const DownloadPage = () => {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <section className="relative overflow-hidden px-6 py-24 lg:px-12 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(56,189,248,0.14),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(255,255,255,0.08),transparent_55%)]" />

        <div className="relative mx-auto max-w-5xl">
          <a href="/" className="text-sm text-white/45 transition hover:text-white/75">
            Voltar para o site
          </a>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="mb-4 text-[11px] font-black uppercase tracking-[0.28em] text-white/35">
                Download
              </p>
              <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white lg:text-7xl">
                Baixe o Checkpoint Launcher para Windows.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
                Baixe o arquivo `.zip`, extraia a pasta do launcher e execute o aplicativo no
                Windows. Sem instalador e sem etapa extra.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href={WINDOWS_PORTABLE_URL}
                  className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
                >
                  <Download className="h-4 w-4" />
                  Baixar para Windows
                </a>
                <a
                  href="/privacy-policy"
                  className="inline-flex items-center rounded-full border border-white/15 px-7 py-4 text-sm font-bold text-white/75 transition hover:border-white/30 hover:text-white"
                >
                  Politica de privacidade
                </a>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-2xl">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <Monitor className="h-5 w-5 text-white/75" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Pasta pronta para Windows</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Arquivo compactado com a pasta completa do launcher, com suporte a Steam,
                      Epic e jogos `.exe`.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <ShieldCheck className="h-5 w-5 text-white/75" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Extrair e abrir</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Extraia o `.zip` e abra o executavel dentro da pasta `win-unpacked`.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
                    Arquivo
                  </p>
                  <p className="mt-2 text-sm text-white/75">Checkpoint Launcher Windows (.zip)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default DownloadPage;
