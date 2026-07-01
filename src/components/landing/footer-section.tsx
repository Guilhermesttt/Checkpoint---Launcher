import { Gamepad2 } from "lucide-react";

export function FooterSection() {
  return (
    <footer className="relative bg-black text-white">
      {/* Gradient banner */}
      <div className="relative w-full h-[200px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.09_0.01_260)] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_70%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Gamepad2 className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <div className="text-4xl font-display text-white/10 tracking-tight">
              CHECKPOINT
            </div>
          </div>
        </div>
      </div>

      {/* Footer content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <a href="#" className="inline-flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-white/70" />
            <span className="text-xl font-display text-white">CHECKPOINT</span>
          </a>

          <p className="text-sm text-white/30 text-center">
            © 2025 Checkpoint. Feito com ❤️ por gamers, para gamers.
          </p>

          <div className="flex items-center gap-4 text-sm text-white/30">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Sistemas Operacionais OK
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
