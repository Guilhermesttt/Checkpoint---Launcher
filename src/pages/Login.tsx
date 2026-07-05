import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, AlertCircle, ArrowRight, Gamepad2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const LoginContent: React.FC = () => {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isDesktopRuntime = Boolean(window.electronAPI);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/app", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      navigate("/app", { replace: true });
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail jÃ¡ estÃ¡ em uso.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate("/app", { replace: true });
    } catch {
      setError("Falha ao entrar com Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.08),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(139,92,246,0.06),transparent_60%)]" />

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div key={`v-${i}`} className="absolute w-px bg-white" style={{ left: `${(i + 1) * 8.33}%`, top: 0, bottom: 0 }} />
        ))}
        {[...Array(8)].map((_, i) => (
          <div key={`h-${i}`} className="absolute h-px bg-white" style={{ top: `${(i + 1) * 12.5}%`, left: 0, right: 0 }} />
        ))}
      </div>

      {!isDesktopRuntime && (
        <a
          href="/"
          className="absolute top-8 left-8 flex items-center gap-2 text-white/40 hover:text-white/80 text-sm font-mono transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </a>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="border border-white/10 bg-white/[0.03] backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4"
            >
              <Gamepad2 className="w-7 h-7 text-white" />
            </motion.div>
            <h1 className="text-3xl font-display tracking-tight text-white mb-1">
              Checkpoint
            </h1>
            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.2em]">
              {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta gratuita"}
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || authLoading}
            className="w-full bg-white text-black rounded-2xl py-4 font-semibold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 mb-6"
          >
            <GoogleIcon />
            <span>Continuar com Google</span>
          </button>

          <div className="relative my-6 text-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
            <span className="relative px-4 bg-transparent text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold">
              ou com e-mail
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white/60 transition-colors" />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all text-sm"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white/60 transition-colors" />
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all text-sm"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 text-red-400 text-xs px-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading || authLoading}
              className="w-full border border-white/20 hover:border-white/40 hover:bg-white/5 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                />
              ) : (
                <>
                  {mode === "login" ? "Entrar" : "Criar Conta"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
              className="text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              {mode === "login"
                ? "NÃ£o tem conta? Cadastre-se grÃ¡tis"
                : "JÃ¡ tem conta? FaÃ§a o login"}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/20 font-mono mt-6 uppercase tracking-[0.2em]">
          AutenticaÃ§Ã£o segura Â· Firebase Auth
        </p>
      </motion.div>
    </div>
  );
};

const Login: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  </NotificationProvider>
);

export default Login;
