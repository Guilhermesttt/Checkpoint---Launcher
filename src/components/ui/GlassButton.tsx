import React from "react";

type GlassButtonVariant = "primary" | "secondary" | "danger";
type GlassButtonSize = "sm" | "md";

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

const sizeBy: Record<GlassButtonSize, string> = {
  sm: "h-10 px-4 rounded-xl text-xs tracking-wider uppercase",
  md: "h-11 px-5 rounded-2xl text-sm",
};

const variantBy: Record<GlassButtonVariant, string> = {
  primary:
    "premium-glass-white text-black shadow-[0_0_24px_rgba(255,255,255,0.18)] hover:scale-[1.02]",
  secondary: "premium-glass text-white/90 hover:bg-white/10 hover:scale-[1.02]",
  danger: "premium-glass-black text-white hover:bg-white/10 hover:scale-[1.02] border border-red-500/30 font-bold",
};

export default function GlassButton({
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: GlassButtonProps) {
  return (
    <button
      {...props}
      className={[base, sizeBy[size], variantBy[variant], className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

