import React, { useEffect, useState, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import {
  Settings,
  Tv,
  Plus,
  Trophy,
  Disc3,
  Sliders,
  CheckCircle2,
  Volume2,
  SlidersHorizontal,
  ArrowLeft,
} from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useAuth } from "../auth/AuthProvider";
import {
  CRTWebGLCanvas,
  CRT_THEMES,
  type CRTShaderParams,
  type CRTThemeId,
  type CRTThemeConfig,
} from "../components/retro/CRTWebGLCanvas";
import { RetroShelf3D } from "../components/retro/RetroShelf3D";
import { RetroAddGameModal } from "../components/retro/RetroAddGameModal";
import { RetroGameDetailsPage } from "./RetroGameDetailsPage";
import type { RetroGame } from "../types/domain";

// Local covers imports for starter PS2 shelf
import gtaCover from "../assets/Retro_Capes/PS2/gta-san-andreas-box.jpg";
import godOfWarCover from "../assets/Retro_Capes/PS2/god-of-war-front-optimized.jpg";
import silentHillCover from "../assets/Retro_Capes/PS2/silent-hill-2-box.jpg";
import sotnCover from "../assets/Retro_Capes/sotn-cover.jpg";
import tekken3Cover from "../assets/Retro_Capes/tekken3-cover.jpg";

export interface RetroGamingPageProps {
  onReturnToStandard?: () => void;
  onBootReady?: () => void;
  onBootProgress?: (progress: number) => void;
}

// Initial PS2 starter shelf library
const INITIAL_RETRO_GAMES: RetroGame[] = [
  {
    id: "ps2_gta_sa",
    title: "Grand Theft Auto: San Andreas",
    console: "PS2",
    year: 2004,
    publisher: "Rockstar Games",
    description: "Carl Johnson retorna a Los Santos...",
    coverImage: gtaCover,
    wrapImage: gtaCover,
    theGamesDbId: 104,
    retroAchievementsGameId: 2362,
  },
  {
    id: "ps2_god_of_war",
    title: "God of War II",
    console: "PS2",
    year: 2007,
    publisher: "Sony Computer Entertainment",
    description: "Kratos, agora o Deus da Guerra...",
    coverImage: godOfWarCover,
    wrapImage: godOfWarCover,
    theGamesDbId: 220,
    retroAchievementsGameId: 2840,
  },
  {
    id: "ps2_silent_hill_2",
    title: "Silent Hill 2: Director's Cut",
    console: "PS2",
    year: 2001,
    publisher: "Konami",
    description: "James Sunderland recebe uma carta...",
    coverImage: silentHillCover,
    wrapImage: silentHillCover,
    theGamesDbId: 301,
    retroAchievementsGameId: 2154,
  },
  {
    id: "ps1_sotn",
    title: "Castlevania: Symphony of the Night",
    console: "PS1",
    year: 1997,
    publisher: "Konami",
    description: "Alucard desperta de seu sono...",
    coverImage: sotnCover,
    wrapImage: sotnCover,
    theGamesDbId: 440,
    retroAchievementsGameId: 1124,
  },
  {
    id: "ps1_tekken3",
    title: "Tekken 3",
    console: "PS1",
    year: 1998,
    publisher: "Namco",
    description: "O clássico jogo de luta 3D...",
    coverImage: tekken3Cover,
    wrapImage: tekken3Cover,
    theGamesDbId: 550,
    retroAchievementsGameId: 1150,
  },
];

const DEFAULT_SHADER_PARAMS: CRTShaderParams = {
  curvature: 0.10,
  dotPitch: 3.0,
  glowStrength: 1.35,
  rgbShift: 0.0035,
  scanlines: 0.35,
  vignette: 0.75,
  glowColor: [0.1, 1.0, 0.35],
  coreBoost: 1.4,
  flicker: 0.4,
  noise: 0.3,
};

export const RetroGamingPage: React.FC<RetroGamingPageProps> = ({
  onReturnToStandard,
  onBootReady,
  onBootProgress,
}) => {
  const { setLauncherMode } = usePreferences();
  const { playSound } = useSoundEffects();
  const { user } = useAuth();

  const [shaderParams, setShaderParams] = useState<CRTShaderParams>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_crt_params");
      return saved ? JSON.parse(saved) : DEFAULT_SHADER_PARAMS;
    } catch {
      return DEFAULT_SHADER_PARAMS;
    }
  });

  const [selectedTheme, setSelectedTheme] = useState<CRTThemeId>(() => {
    return (localStorage.getItem("checkpoint_crt_theme") as CRTThemeId) || "green";
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<"themes" | "achievements" | "general">("themes");

  const [games, setGames] = useState<RetroGame[]>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_retro_games_v2");
      return saved ? JSON.parse(saved) : INITIAL_RETRO_GAMES;
    } catch {
      return INITIAL_RETRO_GAMES;
    }
  });

  const [selectedGameIndex, setSelectedGameIndex] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDetailsPageOpen, setIsDetailsPageOpen] = useState<boolean>(false);

  const [raUsername, setRaUsername] = useState<string>(() => {
    return localStorage.getItem("checkpoint_retroachievements_user") || "ViktorPlayer";
  });
  const [raHardcoreMode, setRaHardcoreMode] = useState<boolean>(true);
  const [raLinked, setRaLinked] = useState<boolean>(true);

  // --- REFS PARA CAPTURA DE TELA ---
  const uiContainerRef = useRef<HTMLDivElement>(null);
  const uiCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Inicializa o Canvas offscreen onde faremos o desenho da UI
  if (!uiCaptureCanvasRef.current && typeof document !== 'undefined') {
    uiCaptureCanvasRef.current = document.createElement("canvas");
  }

  // Loop de captura da Interface DOM para o WebGL Canvas (Aproximadamente 10 FPS)
  useEffect(() => {
    if (!uiContainerRef.current) return;

    let animationFrameId: number;
    let lastCaptureTime = 0;
    let isCapturing = false;

    const captureUI = async (timestamp: number) => {
      if (timestamp - lastCaptureTime >= 150 && !isCapturing) {
        isCapturing = true;
        try {
          const canvas = await html2canvas(uiContainerRef.current!, {
            backgroundColor: null,
            scale: 1,
            logging: false,
            ignoreElements: (element) => element.tagName.toLowerCase() === "canvas",
            onclone: (clonedDoc) => {
              // INJEÇÃO DE CSS NO CLONE: Força os elementos a ficarem 100% visíveis na foto
              const style = clonedDoc.createElement('style');
              style.innerHTML = `
                .crt-ui-layer { 
                  opacity: 1 !important; 
                  visibility: visible !important;
                }
              `;
              clonedDoc.head.appendChild(style);
            }
          });

          if (uiCaptureCanvasRef.current) {
            const ctx = uiCaptureCanvasRef.current.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              uiCaptureCanvasRef.current.width = canvas.width;
              uiCaptureCanvasRef.current.height = canvas.height;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(canvas, 0, 0);
            }
          }
          lastCaptureTime = timestamp;
        } catch (err) {
          console.warn("Falha ao capturar a UI para o shader CRT", err);
        } finally {
          isCapturing = false;
        }
      }
      animationFrameId = requestAnimationFrame(captureUI);
    };

    animationFrameId = requestAnimationFrame(captureUI);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);
  const saveGames = (updated: RetroGame[]) => {
    setGames(updated);
    try {
      localStorage.setItem("checkpoint_retro_games_v2", JSON.stringify(updated));
    } catch (err) {
      console.warn("Falha ao salvar jogos no storage:", err);
    }
  };

  const handleUpdateGame = (updatedGame: RetroGame) => {
    const updated = games.map((g) => (g.id === updatedGame.id ? updatedGame : g));
    saveGames(updated);
  };

  const handleDeleteGame = (gameId: string) => {
    const updated = games.filter((g) => g.id !== gameId);
    saveGames(updated.length > 0 ? updated : INITIAL_RETRO_GAMES);
    setSelectedGameIndex(0);
    setIsDetailsPageOpen(false);
  };

  const activeThemeConfig = useMemo(
    () => CRT_THEMES.find((t) => t.id === selectedTheme) || CRT_THEMES[0],
    [selectedTheme]
  );

  const selectedGame = games[selectedGameIndex] || games[0];

  useEffect(() => {
    onBootProgress?.(100);
    onBootReady?.();
  }, [onBootReady, onBootProgress]);

  const handleReturn = () => {
    playSound("back");
    if (onReturnToStandard) {
      onReturnToStandard();
    } else {
      setLauncherMode("standard");
    }
  };

  const handleThemeSelect = (theme: CRTThemeConfig) => {
    playSound("switchOn");
    setSelectedTheme(theme.id);
    localStorage.setItem("checkpoint_crt_theme", theme.id);
    setShaderParams((prev) => {
      const updated = {
        ...prev,
        glowColor: theme.glowColor,
      };
      localStorage.setItem("checkpoint_crt_params", JSON.stringify(updated));
      return updated;
    });
  };

  const updateShaderParam = (key: keyof CRTShaderParams, value: any) => {
    setShaderParams((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("checkpoint_crt_params", JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddGame = (newGame: RetroGame) => {
    const updated = [newGame, ...games];
    saveGames(updated);
    setSelectedGameIndex(0);
    playSound("select");
  };

  const handleNextGame = () => {
    playSound("navigate");
    setSelectedGameIndex((prev) => (prev + 1) % games.length);
  };

  const handlePrevGame = () => {
    playSound("navigate");
    setSelectedGameIndex((prev) => (prev - 1 + games.length) % games.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAddModalOpen || isDetailsPageOpen || isSettingsOpen) return;

      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        handleNextGame();
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        handlePrevGame();
      } else if (e.key === "Enter" || e.key === "e" || e.key === "E") {
        setIsDetailsPageOpen(true);
        playSound("select");
      } else if (e.key === "Escape" || e.key === "Backspace") {
        handleReturn();
      } else if (e.key === "F1") {
        e.preventDefault();
        setIsSettingsOpen(false);
        playSound("select");
      } else if (e.key === "F2") {
        e.preventDefault();
        setIsSettingsOpen(true);
        playSound("select");
      } else if (e.key === "F3") {
        e.preventDefault();
        setIsDetailsPageOpen(true);
        playSound("select");
      } else if (e.key === "F4") {
        e.preventDefault();
        setIsAddModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddModalOpen, isDetailsPageOpen, isSettingsOpen, games.length]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#020407] text-[#e0e6ed] select-none overflow-hidden font-mono">
      {/* 1. Tactical Years 2000s Main Application Layer (Imagem 3 Base) */}
      {/* 
        Ajuste do p-4 para 5.5vh e 5.5vw - Isso garante o alinhamento perfeito do conteúdo
        dentro do "visor" desenhado pelo shader WebGL
      */}
      <div
        ref={uiContainerRef}
        className="relative w-full h-full flex flex-col justify-between z-10 pointer-events-none"
        style={{ padding: '5.5vh 5.5vw' }}
      >
        {/* Top Tactical Status Bar (Imagem 3) */}
        {/* crt-ui-layer e opacity-0 garantem que ele suma da tela DOM, mas seja reativado no clone fotográfico enviado ao CRT */}
        <header className="crt-ui-layer w-full flex items-center justify-between pointer-events-auto text-xs font-bold text-emerald-400" style={{ opacity: 0.01 }}>
          <div className="flex items-center gap-2">
            <span className="text-emerald-300 font-black tracking-wider uppercase">
              USER: {user?.displayName || "VIKTOR"}
            </span>
            <button
              onClick={() => {
                playSound("select");
                setIsSettingsOpen(true);
              }}
              className="px-2 py-0.5 rounded bg-emerald-400 text-black font-black text-[11px] hover:bg-white transition-colors cursor-pointer"
              title="Configurações (F2)"
            >
              02
            </button>
            <span className="text-emerald-400">↗</span>
            <button
              onClick={handleReturn}
              className="ml-2 px-2.5 py-0.5 rounded border border-emerald-500/40 bg-black/60 hover:bg-emerald-500/20 text-[11px] text-emerald-300 transition-colors cursor-pointer"
            >
              00 ESC
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] text-emerald-500/80">
            <button
              onClick={() => {
                playSound("select");
                setIsSettingsOpen(true);
              }}
              className="border border-emerald-500/30 px-2 py-0.5 bg-black/40 hover:bg-emerald-500/20 text-emerald-300 cursor-pointer"
            >
              SA A-2
            </button>
            <button
              onClick={() => {
                playSound("select");
                setIsAddModalOpen(true);
              }}
              className="border border-emerald-500/30 px-2 py-0.5 bg-black/40 hover:bg-emerald-500/20 text-emerald-300 cursor-pointer"
            >
              + ADD GAME
            </button>
            <span className="border border-emerald-500/30 px-2 py-0.5 bg-black/40">SLT C-2</span>
            <span className="text-emerald-400 font-bold animate-pulse">SYSTEM RUNNING...</span>
          </div>
        </header>

        {/* Tactical Headline Overlay (Imagem 3) */}
        <div className="crt-ui-layer w-full pointer-events-auto flex items-center justify-between pt-1" style={{ opacity: 0.01 }}>
          <div className="flex items-center gap-3">
            <h1
              onClick={() => {
                playSound("select");
                setIsDetailsPageOpen(true);
              }}
              className="text-base sm:text-xl font-black text-emerald-300 tracking-wider hover:text-white cursor-pointer transition-colors flex items-center gap-2"
              title="Clique para abrir detalhes do jogo"
            >
              <span className="text-emerald-400">&gt;</span>
              <span>{selectedGame?.title?.toUpperCase() || "TEST PROTOCOL INITIATED_"}</span>
            </h1>
          </div>

          <button
            onClick={() => {
              playSound("select");
              setIsDetailsPageOpen(true);
            }}
            className="text-xs text-emerald-400 font-bold border border-emerald-500/40 px-2.5 py-1 bg-black/60 hover:bg-emerald-500/20 cursor-pointer transition-colors"
          >
            {selectedGameIndex + 1} / {games.length}
          </button>
        </div>

        {/* 
          Center Main Viewport: Pure 3D Shelf with Auto-Rotating Cases
          ATENÇÃO: Não possui a classe "crt-ui-layer", pois a prateleira 3D permanece vísível 
          e independente do shader para não impactar performance de renderização 3D
        */}
        <main className="relative flex-1 w-full flex flex-col items-center justify-center pointer-events-auto my-1">
          <div className="w-full h-full relative">
            <RetroShelf3D
              games={games}
              selectedIndex={selectedGameIndex}
              onSelectIndex={(idx) => {
                playSound("navigate");
                setSelectedGameIndex(idx);
              }}
              onOpenDetails={() => {
                playSound("select");
                setIsDetailsPageOpen(true);
              }}
              accentColor={activeThemeConfig.previewColor}
              className="w-full h-full"
            />
          </div>
        </main>

        {/* Tactical Status Blocks & Matrix (Imagem 3 Bottom Section) */}
        <div className="crt-ui-layer w-full pointer-events-auto flex flex-wrap items-end justify-between gap-3 pb-1" style={{ opacity: 0.01 }}>
          <div className="flex flex-col gap-1 text-[11px] text-emerald-400">
            <div className="flex items-center gap-4 text-[10px] text-emerald-500">
              <span>READING: 198%</span>
              <span>PWR [2-1]: UPDATED</span>
              <span>SYS: STABLE</span>
            </div>
            <div className="text-base sm:text-lg font-black tracking-widest text-emerald-400 animate-pulse">
              ▶ ▶ ▶ ▶ ▶ ▶ ▶
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-bold">
              <span className="w-2 h-2 bg-emerald-400 inline-block" />
              <span>SYSTEM ONLINE</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {games.slice(0, 5).map((g, idx) => (
              <button
                key={g.id}
                onClick={() => {
                  playSound("navigate");
                  setSelectedGameIndex(idx);
                }}
                className={`border px-3 py-1 text-[10px] font-bold text-left transition-all cursor-pointer ${selectedGameIndex === idx
                  ? "bg-emerald-400 text-black border-white shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                  : "border-emerald-500/50 bg-black/60 text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                  }`}
              >
                <div className="text-[9px] opacity-80">CORE 0{idx + 1}/1</div>
                <div>{selectedGameIndex === idx ? "ACTIVE" : "READY"}</div>
              </button>
            ))}

            <button
              onClick={() => {
                playSound("select");
                setIsDetailsPageOpen(true);
              }}
              className="border border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-400 hover:text-black text-emerald-300 px-3 py-1.5 text-[10px] font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <div className="text-[9px]">SYSTEM STS</div>
              <div>ONLINE..</div>
            </button>

            <button
              onClick={() => {
                playSound("select");
                setIsAddModalOpen(true);
              }}
              className="border border-emerald-500/60 bg-black/60 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 text-[10px] font-bold transition-all cursor-pointer"
            >
              <div className="text-[9px]">SYS TEST</div>
              <div>DTSTR RUN..</div>
            </button>
          </div>
        </div>

        {/* Bottom Tactical Command Buttons (Imagem 3) */}
        <footer className="crt-ui-layer w-full flex items-center justify-between border-t border-emerald-500/40 pt-2 text-[11px] font-bold text-emerald-400 pointer-events-auto" style={{ opacity: 0.01 }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playSound("select");
                setIsSettingsOpen(false);
              }}
              className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-400 hover:text-black border border-emerald-500/40 transition-colors cursor-pointer"
            >
              F1.ESTANTE
            </button>

            <button
              onClick={() => {
                playSound("select");
                setIsSettingsOpen(true);
              }}
              className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-400 hover:text-black border border-emerald-500/40 transition-colors cursor-pointer"
            >
              F2.CONFIG
            </button>

            <button
              onClick={() => {
                playSound("select");
                setIsDetailsPageOpen(true);
              }}
              className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-400 hover:text-black border border-emerald-500/40 transition-colors cursor-pointer"
            >
              F3.DETALHES
            </button>

            <button
              onClick={() => {
                playSound("select");
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-400 hover:text-black border border-emerald-500/40 transition-colors cursor-pointer"
            >
              F4.ADICIONAR
            </button>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-emerald-500/80">
            <span>SCHR V15.04.3888</span>
            <button
              onClick={handleReturn}
              className="border border-emerald-500/40 px-2 py-0.5 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
            >
              ESC.SAIR
            </button>
          </div>
        </footer>
      </div>

      {/* 2. Fullscreen WebGL CRT Shader Canvas */}
      {/* O WebGL recebe a captura via ref e mescla as pontas da tela dentro do shader de tubo curvo! */}
      <CRTWebGLCanvas
        params={shaderParams}
        themeId={selectedTheme}
        headline={selectedGame?.title || "TEST PROTOCOL INITIATED_"}
        subtitle={`USER: ${user?.displayName || "VIKTOR"} // PS2 CORE ACTIVE`}
        badgeText={`USER: ${user?.displayName || "VIKTOR"}`}
        activeMode="shelf"
        uiCaptureCanvasRef={uiCaptureCanvasRef}
        className="fixed inset-0 w-full h-full z-0 pointer-events-none"
      />

      {/* 3. Modal Completa de Configurações do Launcher & RetroAchievements */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#04080e] border-2 border-emerald-500/50 rounded-3xl p-6 shadow-[0_0_60px_rgba(16,185,129,0.3)] max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-emerald-500/30 mb-5">
                <div className="flex items-center gap-2.5">
                  <Settings className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                    CONFIGURAÇÕES DO MODO RETRÔ
                  </h2>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕ Fechar
                </button>
              </div>

              {/* Sub-tabs in Settings */}
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setSettingsTab("themes")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${settingsTab === "themes"
                    ? "bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                    : "text-gray-300 hover:text-white bg-black/40 border border-white/10"
                    }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Temas CRT</span>
                </button>

                <button
                  onClick={() => setSettingsTab("achievements")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${settingsTab === "achievements"
                    ? "bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                    : "text-gray-300 hover:text-white bg-black/40 border border-white/10"
                    }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>RetroAchievements</span>
                </button>

                <button
                  onClick={() => setSettingsTab("general")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${settingsTab === "general"
                    ? "bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                    : "text-gray-300 hover:text-white bg-black/40 border border-white/10"
                    }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Comportamento</span>
                </button>
              </div>

              {/* Tab 1: Temas CRT */}
              {settingsTab === "themes" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs text-gray-300 block mb-2 font-bold">
                      TEMAS DA IMAGEM 2 (CORES DE FÓSFORO E FONTES)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CRT_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeSelect(theme)}
                          className={`flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all border text-left cursor-pointer ${selectedTheme === theme.id
                            ? "bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : "bg-black/50 border-white/10 text-gray-400 hover:text-white"
                            }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-white/20 shadow-md flex-shrink-0"
                            style={{ backgroundColor: theme.previewColor }}
                          />
                          <div>
                            <div className="font-bold text-white">{theme.name}</div>
                            <div className="text-[10px] text-gray-400">{theme.monoFont}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fine Shaders Tuning */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20 space-y-3">
                    <h3 className="text-xs font-bold text-emerald-300">CALIBRAÇÃO DO SHADER CRT</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-300">Curvatura</span>
                          <span className="text-emerald-400">{(shaderParams.curvature * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="0.30"
                          step="0.01"
                          value={shaderParams.curvature}
                          onChange={(e) => updateShaderParam("curvature", parseFloat(e.target.value))}
                          className="w-full accent-emerald-400 h-1 bg-emerald-950 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-300">Subpixels RGB</span>
                          <span className="text-emerald-400">{shaderParams.dotPitch.toFixed(1)}px</span>
                        </div>
                        <input
                          type="range"
                          min="1.5"
                          max="6.0"
                          step="0.1"
                          value={shaderParams.dotPitch}
                          onChange={(e) => updateShaderParam("dotPitch", parseFloat(e.target.value))}
                          className="w-full accent-emerald-400 h-1 bg-emerald-950 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-300">Glow Fósforo</span>
                          <span className="text-emerald-400">{(shaderParams.glowStrength * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.4"
                          step="0.05"
                          value={shaderParams.glowStrength}
                          onChange={(e) => updateShaderParam("glowStrength", parseFloat(e.target.value))}
                          className="w-full accent-emerald-400 h-1 bg-emerald-950 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: RetroAchievements */}
              {settingsTab === "achievements" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">CONTA RETROACHIEVEMENTS</span>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {raLinked ? "CONECTADO" : "NÃO VINCULADO"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] text-gray-400 block font-bold">USUÁRIO RETROACHIEVEMENTS</label>
                      <input
                        type="text"
                        value={raUsername}
                        onChange={(e) => {
                          setRaUsername(e.target.value);
                          localStorage.setItem("checkpoint_retroachievements_user", e.target.value);
                        }}
                        className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white"
                        placeholder="Nome de usuário do RetroAchievements.org"
                      />
                    </div>

                    <label className="flex items-center justify-between text-xs cursor-pointer pt-2 border-t border-emerald-500/20">
                      <div>
                        <span className="text-white font-bold block">Modo Hardcore</span>
                        <span className="text-[10px] text-gray-400">Desativa save states e cheats para pontuação 2x</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={raHardcoreMode}
                        onChange={(e) => setRaHardcoreMode(e.target.checked)}
                        className="accent-emerald-400 w-4 h-4 rounded"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 3: Comportamento */}
              {settingsTab === "general" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">ÁUDIO E EFEITOS SONOROS</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Os efeitos sonoros dos menus táticos anos 2000 estão ativos para navegação com teclado e cliques.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-emerald-500/20 flex justify-end">
              <button
                onClick={() => {
                  playSound("switchOn");
                  setIsSettingsOpen(false);
                }}
                className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer"
              >
                PRONTO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Game Modal */}
      <RetroAddGameModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddGame={handleAddGame}
        accentColor={activeThemeConfig.previewColor}
      />

      {/* Dedicated Retro Game Details Page */}
      {isDetailsPageOpen && selectedGame && (
        <RetroGameDetailsPage
          game={selectedGame}
          onBack={() => setIsDetailsPageOpen(false)}
          onUpdateGame={handleUpdateGame}
          onDeleteGame={handleDeleteGame}
          accentColor={activeThemeConfig.previewColor}
        />
      )}
    </div>
  );
};

export default RetroGamingPage;