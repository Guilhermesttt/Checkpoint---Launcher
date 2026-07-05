import React from "react";
import { AlertCircle, CheckCircle2, Gamepad2 } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../Firebase";
import { apiUrl } from "../services/api";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const DesktopAuth: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state") || "";
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">(
    state ? "idle" : "error",
  );
  const [message, setMessage] = React.useState(
    state
      ? "Entre com sua conta Google para voltar ao Checkpoint Launcher."
      : "Sessao de login invalida. Volte ao app e tente novamente.",
  );

  const handleGoogleLogin = async () => {
    if (!state) return;

    setStatus("loading");
    setMessage("Aguardando autenticacao do Google...");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch(apiUrl("/auth/desktop/google/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, idToken }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel concluir login desktop.");
      }

      setStatus("done");
      setMessage("Login concluido. Pode voltar para o Checkpoint Launcher.");
      window.setTimeout(() => window.close(), 1200);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha ao entrar com Google.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#05070a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-white/10 bg-white/[0.04] rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            {status === "done" ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-300" />
            ) : status === "error" ? (
              <AlertCircle className="w-7 h-7 text-red-300" />
            ) : (
              <Gamepad2 className="w-7 h-7" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Checkpoint Launcher</h1>
            <p className="mt-2 text-sm text-white/55">{message}</p>
          </div>
        </div>

        {status !== "done" && (
          <button
            onClick={handleGoogleLogin}
            disabled={!state || status === "loading"}
            className="mt-8 w-full bg-white text-black rounded-xl py-3.5 font-semibold flex items-center justify-center gap-3 hover:bg-white/90 disabled:opacity-60"
          >
            <GoogleIcon />
            {status === "loading" ? "Conectando..." : "Continuar com Google"}
          </button>
        )}
      </div>
    </div>
  );
};

export default DesktopAuth;
