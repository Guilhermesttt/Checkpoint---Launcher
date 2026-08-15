import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, ContactShadows, OrbitControls } from "@react-three/drei";
import {
  ArrowLeft,
  Play,
  Trophy,
  Upload,
  Image as ImageIcon,
  Save,
  RotateCcw,
  Sparkles,
  Sliders,
  Calendar,
  Building2,
  CheckCircle2,
  Trash2,
  Eye,
} from "lucide-react";
import { PS2CaseModel3D } from "../components/retro/PS2CaseModel3D";
import { RetroAchievementsPanel } from "../components/retro/RetroAchievementsPanel";
import { getTheGamesDbScreenshots } from "../services/theGamesDb";
import { useSoundEffects } from "../hooks/useSoundEffects";
import type { RetroGame } from "../types/domain";

export interface RetroGameDetailsPageProps {
  game: RetroGame;
  onBack: () => void;
  onUpdateGame: (updatedGame: RetroGame) => void;
  onDeleteGame?: (gameId: string) => void;
  accentColor?: string;
}

export const RetroGameDetailsPage: React.FC<RetroGameDetailsPageProps> = ({
  game,
  onBack,
  onUpdateGame,
  onDeleteGame,
  accentColor = "#10b981",
}) => {
  const { playSound } = useSoundEffects();

  // Active sub-tab in details page
  const [activeTab, setActiveTab] = useState<"overview" | "achievements" | "edit" | "3d_adjust">("overview");

  // Editable game fields
  const [title, setTitle] = useState<string>(game.title);
  const [consoleName, setConsoleName] = useState<string>(game.console || "PS2");
  const [year, setYear] = useState<number>(game.year || 2004);
  const [publisher, setPublisher] = useState<string>(game.publisher || "");
  const [description, setDescription] = useState<string>(game.description || "");
  const [executablePath, setExecutablePath] = useState<string>(game.executablePath || "");
  const [coverUrl, setCoverUrl] = useState<string>(game.coverImage || game.wrapImage || "");

  // 3D Manipulation Settings
  const [caseScale, setCaseScale] = useState<number>(0.28);
  const [caseRotationY, setCaseRotationY] = useState<number>(-0.35);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Screenshots from TheGamesDB
  const [screenshots, setScreenshots] = useState<string[]>(game.artworkImages || []);
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch screenshots if not loaded
  useEffect(() => {
    if (game.theGamesDbId && (!screenshots || screenshots.length === 0)) {
      setIsLoadingScreenshots(true);
      getTheGamesDbScreenshots(game.theGamesDbId)
        .then((shots) => {
          if (shots && shots.length > 0) setScreenshots(shots);
        })
        .catch(() => {})
        .finally(() => setIsLoadingScreenshots(false));
    }
  }, [game.theGamesDbId, screenshots]);

  // Handle local image file upload for 3D cover
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playSound("select");
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setCoverUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save changes to the parent and persist
  const handleSave = () => {
    playSound("switchOn");
    const updatedGame: RetroGame = {
      ...game,
      title,
      console: consoleName,
      year,
      publisher,
      description,
      executablePath,
      coverImage: coverUrl,
      wrapImage: coverUrl,
      artworkImages: screenshots,
    };
    onUpdateGame(updatedGame);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#03060a] text-[#e0e6ed] select-none overflow-hidden font-mono flex flex-col justify-between p-4 sm:p-6 z-20 animate-in fade-in duration-300">
      {/* Top Header Tactical Navigation */}
      <header className="w-full flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-emerald-500/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playSound("back");
              onBack();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/70 hover:bg-emerald-500/20 border border-emerald-500/40 text-xs font-bold transition-all active:scale-95 text-emerald-300 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] group"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
            <span>[ VOLTAR À ESTANTE 3D ]</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span>PAINEL TÁTICO // {game.title.toUpperCase()}</span>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-1.5 bg-black/70 border border-emerald-500/40 p-1 rounded-2xl backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <button
            onClick={() => {
              playSound("select");
              setActiveTab("overview");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                : "text-emerald-300 hover:text-white hover:bg-emerald-500/10"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => {
              playSound("select");
              setActiveTab("achievements");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "achievements"
                ? "bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                : "text-emerald-300 hover:text-white hover:bg-emerald-500/10"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Conquistas</span>
          </button>

          <button
            onClick={() => {
              playSound("select");
              setActiveTab("edit");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "edit"
                ? "bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                : "text-emerald-300 hover:text-white hover:bg-emerald-500/10"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Gerenciar Capa &amp; Dados</span>
          </button>

          <button
            onClick={() => {
              playSound("select");
              setActiveTab("3d_adjust");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "3d_adjust"
                ? "bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                : "text-emerald-300 hover:text-white hover:bg-emerald-500/10"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Ajuste Escala 3D</span>
          </button>
        </div>

        {/* Quick Launch */}
        <button
          onClick={() => {
            playSound("play");
            alert(`Iniciando ${title} no emulador PS2 configurado!`);
          }}
          className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>EXECUTAR JOGO</span>
        </button>
      </header>

      {/* Main Content Body */}
      <main className="relative flex-1 w-full my-4 overflow-hidden flex flex-col justify-center">
        {/* TAB 1: VISÃO GERAL (OVERVIEW) */}
        {activeTab === "overview" && (
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Column: 3D Case Interactive View */}
            <div className="lg:col-span-5 h-[380px] sm:h-[440px] bg-black/60 border border-emerald-500/30 rounded-3xl relative overflow-hidden flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <Canvas
                camera={{ position: [0, 0.2, 4.4], fov: 38 }}
                gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              >
                <ambientLight intensity={0.9} />
                <spotLight position={[0, 6, 5]} intensity={2.5} color="#ffffff" />
                <pointLight position={[-3, 2, 2]} intensity={1.8} color={accentColor} />
                <pointLight position={[3, 1, 1]} intensity={1.2} color={accentColor} />

                <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
                  <PS2CaseModel3D
                    coverUrl={coverUrl}
                    isSelected={true}
                    rotationY={caseRotationY}
                    scale={caseScale}
                  />
                </Float>

                <ContactShadows position={[0, -1.3, 0]} opacity={0.65} scale={12} blur={2.2} far={4} color={accentColor} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.5} />
              </Canvas>

              {/* 3D Hint */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 border border-emerald-500/30 text-[10px] text-emerald-300 pointer-events-none uppercase tracking-wider">
                Gire com o mouse para ver em 3D
              </div>
            </div>

            {/* Right Column: Game Metadata & Screenshots */}
            <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                    {consoleName}
                  </span>
                  {year && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-gray-300 text-xs font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      {year}
                    </span>
                  )}
                  {publisher && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-gray-300 text-xs font-semibold">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                      {publisher}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                  {title}
                </h1>

                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-black/40 border border-emerald-500/20 rounded-2xl p-4">
                  {description || "Sem descrição cadastrada para este jogo retrô."}
                </p>
              </div>

              {/* Screenshots Gallery */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
                  <span>GALERIA DE SCREENSHOTS (THEGAMESDB)</span>
                  <span>{screenshots.length} IMAGENS</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {screenshots.map((shot, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-emerald-500/20 group hover:border-emerald-400 transition-all cursor-pointer"
                      onClick={() => window.open(shot, "_blank")}
                    >
                      <img
                        src={shot}
                        alt={`Screenshot ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}

                  {screenshots.length === 0 && (
                    <div className="col-span-full p-4 rounded-xl bg-black/40 border border-white/10 text-gray-500 text-xs text-center">
                      Nenhuma screenshot sincronizada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONQUISTAS (RETROACHIEVEMENTS) */}
        {activeTab === "achievements" && (
          <div className="w-full max-w-4xl mx-auto h-full flex flex-col justify-center">
            <RetroAchievementsPanel game={game} accentColor={accentColor} className="w-full" />
          </div>
        )}

        {/* TAB 3: GERENCIAR CAPA & DADOS */}
        {activeTab === "edit" && (
          <div className="w-full max-w-4xl mx-auto bg-black/70 border border-emerald-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.15)] flex flex-col justify-between max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    PERSONALIZAR CAPA 3D &amp; METADADOS
                  </h2>
                </div>

                {saveSuccess && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold animate-pulse">
                    <CheckCircle2 className="w-4 h-4" />
                    Alterações salvas com sucesso!
                  </span>
                )}
              </div>

              {/* Cover Image Upload Section */}
              <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20 space-y-3">
                <label className="text-xs font-bold text-emerald-300 block">
                  CAPA DO JOGO 3D (MATERIAL ART.001)
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Preview Thumbnail */}
                  <div className="w-20 h-28 rounded-xl bg-black border-2 border-emerald-500/40 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Capa 3D" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-600" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Enviar Imagem do PC</span>
                      </button>

                      {game.coverImage && coverUrl !== game.coverImage && (
                        <button
                          onClick={() => setCoverUrl(game.coverImage || "")}
                          className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all border border-white/10"
                        >
                          Restaurar Original
                        </button>
                      )}
                    </div>

                    {/* Direct URL Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={coverUrl}
                        onChange={(e) => setCoverUrl(e.target.value)}
                        placeholder="Ou cole a URL direta da imagem da capa..."
                        className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-emerald-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-bold">TÍTULO DO JOGO</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-black/50 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-bold">CONSOLE / PLATAFORMA</label>
                  <input
                    type="text"
                    value={consoleName}
                    onChange={(e) => setConsoleName(e.target.value)}
                    className="w-full bg-black/50 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-bold">ANO DE LANÇAMENTO</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2004)}
                    className="w-full bg-black/50 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-bold">EDITORA / PUBLICADORA</label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    className="w-full bg-black/50 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] text-gray-400 block mb-1 font-bold">CAMINHO DA ROM / EXECUTÁVEL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={executablePath}
                      onChange={(e) => setExecutablePath(e.target.value)}
                      placeholder="C:\Emuladores\PS2\Games\jogo.iso"
                      className="flex-1 bg-black/50 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] text-gray-400 block mb-1 font-bold">SINOPSE / DESCRIÇÃO</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-black/50 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
              {onDeleteGame && (
                <button
                  onClick={() => {
                    if (confirm(`Deseja remover "${title}" da estante retrô?`)) {
                      onDeleteGame(game.id);
                      onBack();
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover Jogo</span>
                </button>
              )}

              <button
                onClick={handleSave}
                className="ml-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
              >
                <Save className="w-4 h-4" />
                <span>SALVAR ALTERAÇÕES</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: PAINEL DE AJUSTE DE ESCALA & TAMANHO 3D */}
        {activeTab === "3d_adjust" && (
          <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Live 3D Preview with applied sliders */}
            <div className="md:col-span-7 h-[360px] sm:h-[420px] bg-black/60 border border-emerald-500/30 rounded-3xl relative overflow-hidden flex items-center justify-center">
              <Canvas
                camera={{ position: [0, 0.2, 4.4], fov: 38 }}
                gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              >
                <ambientLight intensity={0.9} />
                <spotLight position={[0, 6, 5]} intensity={2.5} color="#ffffff" />
                <pointLight position={[-3, 2, 2]} intensity={1.8} color={accentColor} />

                <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
                  <PS2CaseModel3D
                    coverUrl={coverUrl}
                    isSelected={true}
                    rotationY={caseRotationY}
                    scale={caseScale}
                  />
                </Float>

                <ContactShadows position={[0, -1.3, 0]} opacity={0.65} scale={12} blur={2.2} far={4} color={accentColor} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate={autoRotate} />
              </Canvas>

              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold">
                ESCALA: {(caseScale * 1000).toFixed(0)}%
              </div>
            </div>

            {/* Slider Controls */}
            <div className="md:col-span-5 bg-black/70 border border-emerald-500/30 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  AJUSTES DA CAPA 3D
                </h3>
                <button
                  onClick={() => {
                    setCaseScale(0.28);
                    setCaseRotationY(-0.35);
                    setAutoRotate(false);
                  }}
                  className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Scale Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Tamanho / Escala da Capa</span>
                  <span className="text-emerald-400 font-bold">{(caseScale * 1000).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.45"
                  step="0.01"
                  value={caseScale}
                  onChange={(e) => setCaseScale(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-emerald-950 rounded cursor-pointer"
                />
              </div>

              {/* Initial Angle Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Ângulo de Rotação Y</span>
                  <span className="text-emerald-400 font-bold">{(caseRotationY * 57.3).toFixed(0)}°</span>
                </div>
                <input
                  type="range"
                  min="-3.14"
                  max="3.14"
                  step="0.1"
                  value={caseRotationY}
                  onChange={(e) => setCaseRotationY(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-emerald-950 rounded cursor-pointer"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-emerald-500/20">
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-gray-300">Giro Contínuo 360°</span>
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                    className="accent-emerald-400 w-4 h-4 rounded"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="w-full flex items-center justify-between border-t border-emerald-500/30 pt-3 text-[11px] text-gray-400">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">ESTANTE 3D // PS2_CASE.GLB</span>
          <span className="text-gray-600">|</span>
          <span>MATERIAL: ART.001 (IMAGE_0 REPLACED)</span>
        </div>
        <span>CHECKPOINT RETRO GAMING ENGINE</span>
      </footer>
    </div>
  );
};

export default RetroGameDetailsPage;
