import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// No Supabase Auth (GoTrue), o apikey precisa ser o JWT assinado (começando com eyJ...)
const rawKey = (anonKey && anonKey.startsWith("eyJ"))
  ? anonKey
  : (publishableKey && publishableKey.startsWith("eyJ") ? publishableKey : (anonKey || publishableKey));

const isValidUrl = (url: unknown): url is string =>
  typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = typeof rawKey === "string" && rawKey.trim().length > 0 ? rawKey : "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);