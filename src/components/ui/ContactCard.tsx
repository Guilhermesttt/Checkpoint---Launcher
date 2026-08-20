import React from "react";
import { ArrowRight, MessageSquare, Phone, User, Users } from "lucide-react";

export type ContactStatus = "online" | "playing" | "offline" | "busy";

export interface ContactCardProps {
  id?: string;
  name: string;
  avatarUrl?: string;
  customIcon?: React.ReactNode;
  status?: ContactStatus;
  statusText?: string;
  badge?: string | number;
  actions?: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onCardClick?: () => void;
  className?: string;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  name,
  avatarUrl,
  customIcon,
  status = "offline",
  statusText,
  badge,
  actions,
  primaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  onCardClick,
  className = "",
}) => {
  const isClickable = Boolean(onCardClick);

  return (
    <div
      onClick={onCardClick}
      className={`group relative flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0E0E0E] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-[#171717] ${
        isClickable ? "cursor-pointer active:scale-[0.99]" : ""
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {/* Avatar Container with rounded container and subtle functional status indicator */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#171717] shadow-inner">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : customIcon ? (
            customIcon
          ) : (
            <Users className="h-5 w-5 text-white/40" />
          )}

          {/* Functional status indicator: subtle green for online/playing, subtle red for offline */}
          <span
            className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-[#0E0E0E] ${
              status === "online" || status === "playing"
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                : status === "busy"
                ? "bg-amber-500"
                : "bg-red-500/70"
            }`}
          />
        </div>

        {/* Info Column */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-white tracking-tight">
              {name}
            </p>
            {badge !== undefined && badge !== "" && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/10 px-1.5 font-mono text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
          </div>
          {statusText && (
            <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-white/40 font-body">
              {statusText}
            </p>
          )}
        </div>
      </div>

      {/* Action Controls aligned to right */}
      <div
        className="flex shrink-0 items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {actions ? (
          actions
        ) : onPrimaryAction ? (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="cursor-pointer flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white px-4 text-xs font-black uppercase tracking-wider text-black shadow-md transition-all hover:bg-white/90 active:scale-95"
          >
            <span>{primaryActionLabel || "Acessar"}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        ) : isClickable ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/35 transition-all group-hover:bg-white/[0.08] group-hover:text-white">
            <ArrowRight className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </div>
  );
};
