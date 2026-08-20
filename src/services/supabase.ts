import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: unknown): url is string =>
  typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = typeof rawKey === "string" && rawKey.trim().length > 0 ? rawKey : "placeholder-anon-key";

// DEBUG temporário: log minimal (não exponha a chave em logs públicos)
// Imprima se a URL foi substituída e se a chave foi fornecida.
try {
  // eslint-disable-next-line no-console
  console.info("[supabase] resolved url:", supabaseUrl?.slice(0, 120), "anonKeyPresent:", Boolean(rawKey));
} catch {}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);