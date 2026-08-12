import { useState } from "react";
import {
  DEFAULT_STUDIO_TUNER_PARAMS,
  type StudioTunerParams,
} from "./retroStudioTuner";

interface RetroStudioTunerPanelProps {
  params: StudioTunerParams;
  onChange: (newParams: StudioTunerParams) => void;
  onReset: () => void;
}

export function RetroStudioTunerPanel({
  params,
  onChange,
  onReset,
}: RetroStudioTunerPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"lights" | "tv" | "console" | "case">("lights");

  const updateParam = (key: keyof StudioTunerParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  const handleCopy = () => {
    const code = JSON.stringify(params, null, 2);
    navigator.clipboard.writeText(code);
    console.log("🎛️ STUDIO TUNER PARAMS:", params);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="retro-mode fixed bottom-6 right-6 z-50 flex items-center gap-2 border border-[#b52322] bg-[#09090a]/92 px-4 py-3 font-['Unbounded'] text-xs font-bold text-[#fcf9f3] shadow-2xl transition hover:bg-[#b52322] focus-visible:outline-none"
        title="Abrir Controles de Estúdio 3D"
      >
        <span>🎛️</span>
        <span>AJUSTAR LUZ & CENA 3D</span>
      </button>
    );
  }

  return (
    <div className="retro-mode fixed right-6 top-16 z-50 flex mr-55 h-[calc(100vh-6rem)] w-80 flex-col border border-white/20 bg-[#09090a]/95 text-[#fcf9f3] shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="font-['Unbounded'] text-xs font-bold tracking-wider text-[#b52322]">
          🎛️ ESTÚDIO 3D
        </h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-lg text-[#88837a] hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 text-[9px] font-bold tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("lights")}
          className={`flex-1 py-2 text-center transition ${activeTab === "lights"
              ? "border-b-2 border-[#b52322] text-[#fcf9f3] bg-white/5"
              : "text-[#77736c] hover:text-white"
            }`}
        >
          💡 LUZES
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tv")}
          className={`flex-1 py-2 text-center transition ${activeTab === "tv"
              ? "border-b-2 border-[#b52322] text-[#fcf9f3] bg-white/5"
              : "text-[#77736c] hover:text-white"
            }`}
        >
          📺 TV
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("console")}
          className={`flex-1 py-2 text-center transition ${activeTab === "console"
              ? "border-b-2 border-[#b52322] text-[#fcf9f3] bg-white/5"
              : "text-[#77736c] hover:text-white"
            }`}
        >
          🕹️ CONSOLE
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("case")}
          className={`flex-1 py-2 text-center transition ${activeTab === "case"
              ? "border-b-2 border-[#b52322] text-[#fcf9f3] bg-white/5"
              : "text-[#77736c] hover:text-white"
            }`}
        >
          📦 CAPA
        </button>
      </div>

      {/* Slider Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin">
        {activeTab === "lights" && (
          <>
            <div className="flex items-center justify-between border border-white/15 bg-white/5 p-2.5 rounded-xs">
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#eee9dd]">
                  📺 Efeito CRT (Scanlines)
                </span>
                <span className="block text-[8px] text-[#88837a]">
                  {params.crtEnabled ? "Simulação Tubo 480i" : "Imagem HD Limpa"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...params, crtEnabled: !params.crtEnabled })}
                className={`px-3 py-1.5 text-[10px] font-bold tracking-wider transition ${params.crtEnabled
                    ? "bg-[#b52322] text-white shadow-[0_0_8px_rgba(181,35,34,0.5)]"
                    : "bg-white/10 text-[#88837a] hover:text-white"
                  }`}
              >
                {params.crtEnabled ? "LIGADO" : "DESLIGADO"}
              </button>
            </div>
            <hr className="border-white/10" />
            <SliderControl
              label="Luz Ambiente"
              value={params.ambientIntensity}
              min={0.1}
              max={3.0}
              step={0.05}
              onChange={(v) => updateParam("ambientIntensity", v)}
            />
            <hr className="border-white/10" />
            <SliderControl
              label="Luz Direcional (Intensidade)"
              value={params.dirLightIntensity}
              min={0.0}
              max={8.0}
              step={0.1}
              onChange={(v) => updateParam("dirLightIntensity", v)}
            />
            <SliderControl
              label="Luz Direcional X"
              value={params.dirLightX}
              min={-10.0}
              max={10.0}
              step={0.2}
              onChange={(v) => updateParam("dirLightX", v)}
            />
            <SliderControl
              label="Luz Direcional Y"
              value={params.dirLightY}
              min={-10.0}
              max={10.0}
              step={0.2}
              onChange={(v) => updateParam("dirLightY", v)}
            />
            <SliderControl
              label="Luz Direcional Z"
              value={params.dirLightZ}
              min={-10.0}
              max={10.0}
              step={0.2}
              onChange={(v) => updateParam("dirLightZ", v)}
            />
            <hr className="border-white/10" />
            <SliderControl
              label="Luz do Console (Intensidade)"
              value={params.consoleLightIntensity}
              min={0.0}
              max={15.0}
              step={0.2}
              onChange={(v) => updateParam("consoleLightIntensity", v)}
            />
            <SliderControl
              label="Luz do Console X"
              value={params.consoleLightX}
              min={-5.0}
              max={5.0}
              step={0.1}
              onChange={(v) => updateParam("consoleLightX", v)}
            />
            <SliderControl
              label="Luz do Console Y"
              value={params.consoleLightY}
              min={-5.0}
              max={5.0}
              step={0.1}
              onChange={(v) => updateParam("consoleLightY", v)}
            />
            <SliderControl
              label="Luz do Console Z"
              value={params.consoleLightZ}
              min={-5.0}
              max={10.0}
              step={0.1}
              onChange={(v) => updateParam("consoleLightZ", v)}
            />
          </>
        )}

        {activeTab === "tv" && (
          <>
            <SliderControl
              label="TV Posição X"
              value={params.tvX}
              min={-4.0}
              max={4.0}
              step={0.05}
              onChange={(v) => updateParam("tvX", v)}
            />
            <SliderControl
              label="TV Posição Y"
              value={params.tvY}
              min={-4.0}
              max={4.0}
              step={0.05}
              onChange={(v) => updateParam("tvY", v)}
            />
            <SliderControl
              label="TV Posição Z"
              value={params.tvZ}
              min={-5.0}
              max={5.0}
              step={0.05}
              onChange={(v) => updateParam("tvZ", v)}
            />
          </>
        )}

        {activeTab === "console" && (
          <>
            <SliderControl
              label="Console Posição X"
              value={params.consoleX}
              min={-4.0}
              max={4.0}
              step={0.05}
              onChange={(v) => updateParam("consoleX", v)}
            />
            <SliderControl
              label="Console Posição Y"
              value={params.consoleY}
              min={-4.0}
              max={4.0}
              step={0.05}
              onChange={(v) => updateParam("consoleY", v)}
            />
            <SliderControl
              label="Console Posição Z"
              value={params.consoleZ}
              min={-5.0}
              max={5.0}
              step={0.05}
              onChange={(v) => updateParam("consoleZ", v)}
            />
            <hr className="border-white/10" />
            <SliderControl
              label="Inclinação Pitch (Rot X)"
              value={params.consoleRotX}
              min={-1.57}
              max={1.57}
              step={0.02}
              onChange={(v) => updateParam("consoleRotX", v)}
            />
            <SliderControl
              label="Giro Yaw (Rot Y)"
              value={params.consoleRotY}
              min={-3.14}
              max={3.14}
              step={0.02}
              onChange={(v) => updateParam("consoleRotY", v)}
            />
            <SliderControl
              label="Tombo Roll (Rot Z)"
              value={params.consoleRotZ}
              min={-1.57}
              max={1.57}
              step={0.02}
              onChange={(v) => updateParam("consoleRotZ", v)}
            />
          </>
        )}

        {activeTab === "case" && (
          <>
            <SliderControl
              label="Capa Posição X"
              value={params.caseX}
              min={-4.0}
              max={5.0}
              step={0.05}
              onChange={(v) => updateParam("caseX", v)}
            />
            <SliderControl
              label="Capa Posição Y"
              value={params.caseY}
              min={-4.0}
              max={4.0}
              step={0.05}
              onChange={(v) => updateParam("caseY", v)}
            />
            <SliderControl
              label="Capa Posição Z"
              value={params.caseZ}
              min={-5.0}
              max={5.0}
              step={0.05}
              onChange={(v) => updateParam("caseZ", v)}
            />
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 border border-white/20 bg-white/10 py-2 text-[10px] font-bold tracking-wider hover:bg-white/20"
        >
          {copied ? "✓ COPIADO!" : "📋 COPIAR VALORES"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="border border-[#b52322]/40 bg-[#b52322]/20 px-3 py-2 text-[10px] font-bold text-[#b52322] hover:bg-[#b52322] hover:text-white"
          title="Restaurar padrão"
        >
          🔄 RESET
        </button>
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-semibold text-[#88837a]">
        <span>{label}</span>
        <span className="font-mono text-[#eee9dd]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#b52322] cursor-pointer"
      />
    </div>
  );
}
