import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: unknown): url is string =>
  typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = typeof rawKey === "string" && rawKey.trim().length > 0 ? rawKey : "placeholder-anon-key";

try {
  console.info("[supabase] resolved url:", supabaseUrl?.slice(0, 80), "anonKeyPresent:", Boolean(rawKey));
} catch {}

if (supabaseUrl.includes("placeholder.supabase.co") || supabaseAnonKey === "placeholder-anon-key") {
  console.error(
    "[supabase] ⚠️ ALERTA CRÍTICO: Supabase URL/Key está usando PLACEHOLDER. " +
    "O tempo real (mensagens, amizades, presença) estará inoperante nesta build! " +
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env antes do build."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);