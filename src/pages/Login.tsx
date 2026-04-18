import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Gamepad2, CheckLine } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getSteamLinkUrl } from "../services/steam";
import { isBackendHealthy } from "../services/api";

const Login: React.FC = () => {
  const { signInWithGoogle, user, loading } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [steamHint, setSteamHint] = useState<string | null>(null);

  const steamLink = useMemo(() => {
    if (!user?.uid) return "";
    return getSteamLinkUrl(user.uid);
  }, [user?.uid]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSteamConnect = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user?.uid) {
      e.preventDefault();
      setSteamHint("Entre com Google primeiro para vincular sua conta Steam.");
      return;
    }
    const healthy = await isBackendHealthy();
    if (!healthy) {
      e.preventDefault();
      setSteamHint(
        "Backend Steam offline. Rode `npm run server` ou `npm run dev:full`.",
      );
      return;
    }
    setSteamHint(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(220,38,38,0.2),transparent_35%)]" />

      {/* Animated background noise/ambient particles */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <motion.div
          animate={{
            x: [0, 10, 0],
            y: [0, -10, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md p-10 rounded-[32px] liquid-glass-dark border border-white/10"
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <CheckLine className="w-6 h-6 text-blue-500" />
            <h1 className="text-4xl font-light tracking-tight bg-linear-to-br from-white to-white/60 bg-clip-text text-transparent">
              Checkpoint
            </h1>
          </div>

          <p className="text-white/50 text-sm mb-10 font-light max-w-[280px] leading-relaxed">
            Entre na sua biblioteca e retome seus jogos de onde parou.
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <button
              onClick={handleGoogleLogin}
              disabled={loading || isGoogleLoading}
              className="w-full relative group overflow-hidden rounded-2xl px-6 py-4 bg-white text-black font-semibold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {isGoogleLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
                />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              <span>
                {isGoogleLoading ? "Conectando..." : "Entrar com Google"}
              </span>
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-black/5 to-transparent skew-x-12" />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <a
              href={steamLink || "#"}
              onClick={handleSteamConnect}
              className="w-full group rounded-2xl px-6 py-4 liquid-glass-subtle font-semibold flex items-center justify-center gap-3 text-white/80 hover:text-white hover:bg-white/5 transition-all border border-white/5"
            >
              <Gamepad2 className="w-5 h-5 transition-transform group-hover:rotate-12" />
              Conectar com Steam
            </a>
          </motion.div>
        </div>

        {steamHint && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-xs text-amber-300/80 mt-4 px-1"
          >
            {steamHint}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-10 pt-6 border-t border-white/5"
        >
          <p className="text-[10px] text-white/30 uppercase tracking-widest leading-relaxed">
            Secure Authentication Layer v2.4
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
