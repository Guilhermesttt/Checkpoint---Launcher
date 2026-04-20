import React, { useState } from "react";
import { motion } from "framer-motion";
import { Download, Gamepad2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

const SteamIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Landing: React.FC = () => {
  const { signInWithGoogle, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("Falha ao entrar com Google. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050507] text-white flex flex-col items-center justify-center overflow-x-hidden p-6 relative select-none">
      {/* Deep Background with subtle noise/vignette */}
      <div className="fixed inset-0 top-0 left-0 -z-10 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.03)_0%,_rgba(5,5,7,1)_80%)] pointer-events-none" />

      {/* Decorative Blur Orbs (B&W Theme) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-white/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center max-w-4xl mx-auto z-10 w-full mt-10 md:mt-0"
      >
        <div className="mb-8 inline-flex items-center gap-3 px-4 py-2 rounded-full premium-glass border border-white/20 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50 shadow-2xl">
          <Gamepad2 className="w-4 h-4 text-white" />
          O Launcher Definitivo
        </div>

        <h1 className="text-6xl sm:text-8xl font-black tracking-tighter mb-8 mt-2 text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/30 drop-shadow-2xl">
          CHECKPOINT
        </h1>
        
        <p className="text-lg sm:text-2xl text-white/40 max-w-2xl font-medium mb-12 leading-relaxed tracking-wide">
          Sua biblioteca elevada ao estado da arte. Conecte-se com a Steam e experencie seus jogos com uma estética de console primorosa.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto h-auto mb-8">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || authLoading}
            className="flex items-center justify-center gap-4 w-full sm:w-72 h-16 premium-glass-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                Continuar com Google
              </>
            )}
          </button>
          
          <button
            title="A integração requer login prévio"
            disabled
            className="flex items-center justify-center gap-4 w-full sm:w-72 h-16 premium-glass border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest opacity-50 cursor-not-allowed transition-all"
          >
            <SteamIcon />
            Sincronizar Steam
          </button>
        </div>

        <button disabled className="text-white/20 hover:text-white/50 transition-colors flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-widest mb-16">
          <Download className="w-3.5 h-3.5" />
          Baixar App Desktop (Em breve)
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl mb-10 rounded-3xl premium-glass-black border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] relative p-2"
      >
        <div className="aspect-[16/9] w-full bg-[#050507] rounded-2xl overflow-hidden flex flex-col p-8 sm:p-12 relative border border-white/5">
          {/* Faux UI Header */}
          <div className="flex justify-between items-center opacity-30 blur-[0.5px]">
            <div className="flex gap-6 items-center">
              <div className="w-10 h-10 rounded-2xl bg-white/30" />
              <div className="w-32 h-3 rounded-full bg-white/20" />
            </div>
            <div className="w-20 h-8 rounded-xl bg-white/10" />
          </div>
          
          {/* Faux UI Title */}
          <div className="mt-20 sm:mt-32 w-3/4 sm:w-1/2 opacity-40 blur-[1px]">
            <div className="w-56 sm:w-96 h-12 rounded-xl bg-white/30 mb-6" />
            <div className="w-40 h-4 rounded-full bg-white/20 mb-10" />
            <div className="w-40 h-12 rounded-full bg-white/80" />
          </div>

          {/* Faux UI Cards */}
          <div className="absolute bottom-8 sm:bottom-12 left-8 sm:left-12 flex gap-6 w-full">
            <div className="w-36 sm:w-48 bg-white/30 h-52 sm:h-64 rounded-2xl ring-2 ring-white/60 shadow-[0_0_30px_rgba(255,255,255,0.1)] blur-[0.5px]" />
            <div className="w-36 sm:w-48 bg-white/10 h-52 sm:h-64 rounded-2xl blur-[1px]" />
            <div className="w-36 sm:w-48 bg-white/10 h-52 sm:h-64 rounded-2xl hidden sm:block blur-[1px]" />
            <div className="w-36 sm:w-48 bg-white/10 h-52 sm:h-64 rounded-2xl hidden md:block blur-[1.5px]" />
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
        </div>
      </motion.div>

    </div>
  );
};

export default Landing;
