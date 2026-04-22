import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 shrink-0",
  {
    variants: {
      variant: {
        default: "premium-glass text-white hover:bg-white/10 border border-white/10 shadow-2xl",
        white: "premium-glass-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.1)]",
        ghost: "hover:bg-white/5 text-white/60 hover:text-white",
        outline: "border border-white/20 bg-transparent hover:bg-white/10 text-white",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-9 px-4 text-[10px]",
        lg: "h-14 px-8 text-sm",
        icon: "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";

export default GlassButton;
