// npm i sharp node-fetch @supabase/supabase-js
// uso: node prepArtwork.mjs "<url-da-imagem>" gow2-front.jpg covers
import sharp from "sharp";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const [, , sourceUrl, outName, bucket = "covers"] = process.argv;

if (!sourceUrl || !outName) {
  console.error("uso: node prepArtwork.mjs <url> <nome-saida.jpg> [bucket]");
  process.exit(1);
}

// nunca comita a service_role key — usa variável de ambiente
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const res = await fetch(sourceUrl);
if (!res.ok) throw new Error(`download falhou: ${res.status}`);
const buffer = Buffer.from(await res.arrayBuffer());

// 1600px no lado maior é mais que suficiente pra textura de case numa
// prateleira 3D (nunca vai ocupar mais que uma fração da tela por vez).
// mozjpeg dá bem menos artefato que o encoder jpeg padrão no mesmo peso.
const optimized = await sharp(buffer)
  .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();

const { data, error } = await supabase.storage
  .from(bucket)
  .upload(outName, optimized, { contentType: "image/jpeg", upsert: true });

if (error) throw error;

const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(outName);
console.log("salvo em:", publicUrl.publicUrl);

