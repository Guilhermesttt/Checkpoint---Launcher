import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, CheckLine, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está em uso.");
      } else if (err.code === 'auth/weak-password') {
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
    } catch (err) {
      setError("Falha ao entrar com Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 relative overflow-hidden bg-transparent">
      {/* Local overlays for legibility (keep video visible behind) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.10),transparent_40%)] opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,7,0.35)_70%,rgba(5,5,7,0.55)_100%)]" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md p-8 rounded-[40px] liquid-glass-dark border border-white/10 shadow-2xl elevation-2"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4"
          >
            <CheckLine className="w-8 h-8 text-blue-500" />
          </motion.div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-1">
            Checkpoint
          </h1>
          <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.2em]">
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta gratuita"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/7 transition-all"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/7 transition-all"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-red-400 text-xs px-2"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading || authLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ring-glow"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
              />
            ) : (
              <>
                {mode === "login" ? "Entrar" : "Criar Conta"}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-8 text-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          <span className="relative liquid-glass-subtle px-4 py-1 rounded-full text-[10px] uppercase tracking-[0.25em] text-white/35 font-bold">
            ou
          </span>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || authLoading}
          className="w-full bg-white text-black rounded-2xl py-4 font-semibold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 elevation-1"
        >
          <GoogleIcon />
          <span>Google</span>
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm font-light text-white/40 hover:text-white transition-colors"
          >
            {mode === "login" 
              ? "Não tem conta? Cadastre-se" 
              : "Já tem conta? Faça o login"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
            Autenticação Segura Firebase
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

