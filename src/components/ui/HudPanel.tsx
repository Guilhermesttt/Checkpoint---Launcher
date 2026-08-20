import React from "react";

export interface HudPanelProps {
  title?: string;
  subtitle?: string;
  tag?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  withCorners?: boolean;
}

export const HudCornerMarkers: React.FC<{ className?: string }> = ({ className = "" }) => (
  <>
    {/* Top Left */}
    <span className={`pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 border-white/40 ${className}`} />
    {/* Top Right */}
    <span className={`pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 border-white/40 ${className}`} />
    {/* Bottom Left */}
    <span className={`pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 border-white/40 ${className}`} />
    {/* Bottom Right */}
    <span className={`pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 border-white/40 ${className}`} />
  </>
);

export const HudPanel: React.FC<HudPanelProps> = ({
  title,
  subtitle,
  tag,
  headerRight,
  children,
  className = "",
  contentClassName = "",
  withCorners = true,
}) => {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/95 p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl ${className}`}
    >
      {withCorners && <HudCornerMarkers />}

      {(title || tag || headerRight) && (
        <header className="relative mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            {tag && (
              <span className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                [{tag}]
              </span>
            )}
            {title && (
              <div>
                <h3 className="text-sm md:text-base font-black tracking-tight text-white uppercase">
                  {title}
                </h3>
                {subtitle && (
                  <p className="mt-0.5 text-xs font-medium text-white/40">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </header>
      )}

      <div className={`relative ${contentClassName}`}>{children}</div>
    </section>
  );
};

export interface HudModRowProps {
  name: string;
  version?: string;
  author?: string;
  status?: "installed" | "downloaded" | "active" | "disabled" | "error";
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export const HudModRow: React.FC<HudModRowProps> = ({
  name,
  version,
  author,
  status,
  enabled = true,
  onToggle,
  onRemove,
  onClick,
  className = "",
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#121212] px-4 py-3.5 transition-all duration-150 hover:border-white/20 hover:bg-[#181818] ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      {/* HUD left bracketed name */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="font-mono text-xs font-bold text-white/30 group-hover:text-white/60 select-none">
          [
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs md:text-sm font-bold text-white tracking-tight">
              {name}
            </span>
            <span className="font-mono text-xs text-white/40">▶</span>
          </div>
          {(author || version) && (
            <p className="mt-0.5 font-mono text-[10px] text-white/35">
              {author && `BY: ${author.toUpperCase()}`}
              {author && version && " | "}
              {version && `V: ${version}`}
            </p>
          )}
        </div>
        <span className="font-mono text-xs font-bold text-white/30 group-hover:text-white/60 select-none">
          ]
        </span>
      </div>

      {/* Status & Actions */}
      <div
        className="flex shrink-0 items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {status && (
          <span
            className={`font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
              status === "active" || (enabled && status === "installed")
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : status === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-white/10 bg-white/[0.04] text-white/40"
            }`}
          >
            {status.toUpperCase()}
          </span>
        )}

        {onToggle && (
          <button
            type="button"
            onClick={() => onToggle(!enabled)}
            className={`cursor-pointer font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
              enabled
                ? "border-white bg-white text-black hover:bg-white/90"
                : "border-white/10 bg-white/[0.04] text-white/40 hover:text-white hover:border-white/25"
            }`}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remover Mod"
            className="cursor-pointer font-mono text-xs text-white/30 hover:text-red-400 p-1 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
