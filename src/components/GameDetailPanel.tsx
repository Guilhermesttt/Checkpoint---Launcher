import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Clock, HardDrive, Package, Users } from "lucide-react";
import { updateDoc } from "firebase/firestore";
import { launchGame } from "../services/launcher";
import type { Game } from "../types/domain";
import { useAuth } from "../auth/AuthProvider";
import { userGameDocRef } from "../services/firestorePaths";

interface GameDetailPanelProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  playSound: (type: "select" | "back" | "navigate") => void;
}

const GameDetailPanel: React.FC<GameDetailPanelProps> = ({
  game,
  isOpen,
  onClose,
  playSound,
}) => {
  const { user } = useAuth();
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("JOGAR");
  const [launchError, setLaunchError] = React.useState<string | null>(null);

  if (!game) return null;

  const formatHours = (hours: number = 0) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}H ${m}M`;
  };

  const handleLaunch = () => {
    if (isLaunching) return;

    setIsLaunching(true);
    setLaunchError(null);
    playSound("select");
    setTimeout(async () => {
      try {
        if (user?.uid) {
          await updateDoc(userGameDocRef(user.uid, game.id), {
            lastPlayedAt: new Date().toISOString(),
          }).catch(() => {
            return;
          });
        }
        await launchGame(game);
      } catch (error) {
        setLaunchError(error instanceof Error ? error.message : "Falha ao iniciar o jogo.");
      } finally {
        setIsLaunching(false);
      }
    }, 700);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex"
        >
          {/* Background Image - Full Screen */}
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <img
              src={game.backgroundImage || game.image}
              alt={game.title}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
            {/* Cinematic Gradients */}
            <div className="absolute inset-0 bg-linear-to-r from-[#050507] via-[#050507]/70 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-t from-[#050507]/90 via-transparent to-[#050507]/30" />
          </motion.div>

          {/* Content Container */}
          <div className="relative z-10 flex w-full h-full">
            {/* Left Panel - Game Info (PS5 Style) */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="w-full max-w-2xl p-12 flex flex-col justify-center"
            >
              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 mb-8">
                <NavTab 
                  icon="◀" 
                  onClick={() => {
                    playSound("back");
                    onClose();
                  }}
                />
                <NavTab 
                  label="JOGAR" 
                  active={activeTab === "JOGAR"} 
                  onClick={() => { setActiveTab("JOGAR"); playSound("navigate"); }}
                />
                <NavTab 
                  label="SOBRE" 
                  active={activeTab === "SOBRE"}
                  onClick={() => { setActiveTab("SOBRE"); playSound("navigate"); }}
                />
                <NavTab 
                  label="MÍDIA" 
                  active={activeTab === "MÍDIA"}
                  onClick={() => { setActiveTab("MÍDIA"); playSound("navigate"); }}
                />
                <NavTab 
                  label="GERENCIAR" 
                  active={activeTab === "GERENCIAR"}
                  onClick={() => { setActiveTab("GERENCIAR"); playSound("navigate"); }}
                />
              </div>

              {/* Platform Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mb-3"
              >
                <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">
                  PC
                </span>
              </motion.div>

              {/* Game Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-5xl md:text-6xl font-light tracking-tight text-white mb-8"
              >
                {game.title}
              </motion.h1>

              {/* Stats Row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-8 mb-10"
              >
                <StatItem
                  icon={<Clock className="w-4 h-4" />}
                  label="TEMPO JOGADO"
                  value={formatHours(game.hoursPlayed)}
                />
                <StatItem
                  icon={<HardDrive className="w-4 h-4" />}
                  label="ESPAÇO"
                  value={game.sizeGB && game.sizeGB > 0 ? `${game.sizeGB} GB` : "--- GB"}
                />
                <StatItem
                  icon={<Package className="w-4 h-4" />}
                  label="ADICIONAIS"
                  value="FREE"
                />
                <StatItem
                  icon={<Users className="w-4 h-4" />}
                  label="ESTADO"
                  value="INSTALADO"
                />
              </motion.div>

              {/* Dynamic Content based on Active Tab */}
              <AnimatePresence mode="wait">
                {activeTab === "JOGAR" && (
                  <motion.div
                    key="play-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="mb-6">
                      <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4">
                        Dados da Sessão
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <InfoCard
                          label="Launcher"
                          value={game.launcherType === "steam" ? "Steam" : "Local"}
                        />
                        <InfoCard
                          label="App ID"
                          value={game.steamAppId || "---"}
                        />
                        <InfoCard
                          label="Fonte"
                          value={game.source === "steam" ? "Sync Steam" : "Manual"}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "SOBRE" && (
                  <motion.div
                    key="about-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="max-w-xl"
                  >
                    <div className="flex flex-col gap-6">
                      <div>
                        <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4">
                          Sobre
                        </h3>
                        <div 
                          className="text-white/70 leading-relaxed text-sm max-h-[40vh] overflow-y-auto no-scrollbar prose prose-invert prose-p:my-0 pb-2"
                          dangerouslySetInnerHTML={{ __html: game.aboutTheGame || game.description || "Sem descrição disponível para este jogo." }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-y-6 gap-x-12 pt-6 border-t border-white/5">
                        <TechnicalDetail label="Desenvolvedor" value={game.developer} />
                        <TechnicalDetail label="Distribuidora" value={game.publisher} />
                        <TechnicalDetail label="Data de Lançamento" value={game.releaseDate} />
                        <TechnicalDetail label="Categoria" value={game.category} />
                      </div>

                      {game.tags && game.tags.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-3">
                            Marcadores Populares
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {game.tags.slice(0, 10).map((tag, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "MÍDIA" && (
                  <motion.div
                    key="media-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4">
                      Mídia
                    </h3>
                    <div className="flex flex-col gap-4">
                      {game.trailerUrl && (
                        <div className="aspect-16/9 rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black/40">
                          <video
                            key={game.trailerUrl}
                            src={game.trailerUrl}
                            className="w-full h-full object-cover"
                            controls
                            preload="metadata"
                          />
                        </div>
                      )}
                      
                      {game.screenshots && game.screenshots.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {game.screenshots.map((url, i) => (
                            <motion.div
                              key={i}
                              whileHover={{ scale: 1.02 }}
                              className="w-64 aspect-16/9 rounded-xl overflow-hidden ring-1 ring-white/10 shrink-0 bg-white/5"
                            >
                              <img
                                src={url}
                                alt={`Screenshot ${i}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {!game.trailerUrl && (!game.screenshots || game.screenshots.length === 0) && (
                        <div className="aspect-16/9 rounded-2xl overflow-hidden ring-1 ring-white/10 bg-white/5 flex items-center justify-center">
                          <img
                            src={game.backgroundImage || game.image}
                            alt={game.title}
                            className="w-full h-full object-cover blur-sm opacity-50"
                          />
                          <p className="absolute text-white/30 text-xs uppercase tracking-widest font-black">Nenhuma mídia adicional</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "GERENCIAR" && (
                  <motion.div
                    key="mgmt-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4">
                      Gerenciamento
                    </h3>
                    <div className="p-4 rounded-xl liquid-glass-subtle flex items-center justify-between mb-4">
                      <span className="text-white/60 text-xs truncate max-w-sm">{game.executablePath}</span>
                      <button className="text-[10px] font-bold text-blue-400 uppercase tracking-widest pl-4">Verificar</button>
                    </div>
                    <div className="flex gap-4">
                      <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest">Criar Atalho</button>
                      <button className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-widest">Remover</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Right Panel - Actions */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex-1 flex flex-col justify-end items-end p-12"
            >
              {/* Trophy Progress */}
              <div className="liquid-glass rounded-2xl p-6 mb-6 min-w-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">
                    Perfil
                  </span>
                  <span className="text-2xl font-light text-white">{game.steamPlaytimeMinutes ? `${Math.max(1, Math.round((game.steamPlaytimeMinutes % 6000) / 60))}%` : "--"}</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: game.steamPlaytimeMinutes ? `${Math.max(8, Math.min(100, Math.round((game.steamPlaytimeMinutes % 6000) / 60)))}%` : "12%" }}
                    transition={{
                      duration: 1,
                      delay: 0.5,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
              </div>

              {/* Start Game Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLaunch}
                disabled={isLaunching}
                className="liquid-glass rounded-2xl px-8 py-5 flex items-center gap-4 group min-w-[200px] justify-between relative overflow-hidden"
              >
                <span className="text-sm font-bold tracking-[0.15em] uppercase">
                  {isLaunching ? "Iniciando..." : "Jogar"}
                </span>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play
                    className={`w-5 h-5 text-black fill-black ml-0.5 ${isLaunching ? "animate-pulse" : ""}`}
                  />
                </div>
              </motion.button>
              {launchError && (
                <p className="mt-3 text-xs text-amber-300/90 max-w-[260px] text-right">{launchError}</p>
              )}
            </motion.div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-8 right-8 z-20 p-4 liquid-glass-subtle rounded-full hover:bg-white/10 transition-all hover:rotate-90 active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Launching Cinematic Overlay */}
          <AnimatePresence>
            {isLaunching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-200 bg-black flex flex-col items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full h-full"
                >
                  <img
                    src={game.backgroundImage || game.image}
                    alt={game.title}
                    className="w-full h-full object-cover scale-110 blur-sm brightness-50"
                    loading="eager"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-center"
                    >
                      <h2 className="text-4xl font-light tracking-[0.2em] text-white/90 uppercase mb-4">
                        {game.title}
                      </h2>
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Signature PS5 Transition Stripe */}
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Sub-components
const NavTab: React.FC<{
  label?: string;
  icon?: string;
  active?: boolean;
  badge?: boolean;
  onClick?: () => void;
}> = ({ label, icon, active, badge, onClick }) => (
  <button
    onClick={onClick}
    className={`
      px-3 py-1.5 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase
      transition-all duration-300 flex items-center gap-1
      ${
        active
          ? "liquid-glass text-white"
          : "text-white/40 hover:text-white/70 hover:bg-white/5"
      }
    `}
  >
    {icon && <span className="text-xs">{icon}</span>}
    {label}
    {badge && <span className="w-2 h-2 rounded-full bg-blue-500 ml-1" />}
  </button>
);

const StatItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2 text-white/40">
      {icon}
      <span className="text-[8px] font-bold tracking-[0.2em] uppercase">
        {label}
      </span>
    </div>
    <span className="text-2xl font-light text-white tracking-tight">
      {value}
    </span>
  </div>
);

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-4 rounded-xl liquid-glass-subtle">
    <span className="block text-[8px] font-bold text-white/40 uppercase mb-1">{label}</span>
    <span className="text-white text-xs">{value}</span>
  </div>
);

const TechnicalDetail: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div>
    <span className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">{label}</span>
    <span className="text-white/80 text-sm font-medium">{value || "Não informado"}</span>
  </div>
);

export default GameDetailPanel;
