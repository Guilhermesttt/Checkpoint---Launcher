import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: unknown): url is string =>
  typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = typeof rawKey === "string" && rawKey.trim().length > 0 ? rawKey : "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);