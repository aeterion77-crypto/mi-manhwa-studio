import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// MI MANHWA STUDIO - función segura.
// Las API keys se guardan en la tabla user_keys (sin acceso desde el navegador)
// y SOLO esta función las lee para llamar a Claude y a Fal.ai.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function getKey(uid: string, provider: string): Promise<string | null> {
  const { data } = await admin.from("user_keys").select("api_key").eq("user_id", uid).eq("provider", provider).maybeSingle();
  return data?.api_key ?? null;
}

const APP_RE = /^(fal-ai|blackforestlabs)\/[A-Za-z0-9_\-\/.]+$/;
const safeSeg = (s: unknown) => String(s ?? "x").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 64) || "x";

function falUrlOk(u: unknown): u is string {
  try { const x = new URL(String(u)); return x.protocol === "https:" && x.hostname === "queue.fal.run"; } catch { return false; }
}
async function storeFile(url: string, folder: string, prefix: string, fallbackType: string) {
  const ir = await fetch(url);
  const buf = new Uint8Array(await ir.arrayBuffer());
  const ct = ir.headers.get("content-type") || fallbackType;
  const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : ct.includes("png") ? "png" : ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : ct.includes("wav") ? "wav" : ct.includes("ogg") ? "ogg" : "bin";
  const path = `${folder}/${prefix}_${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("studio").upload(path, buf, { contentType: ct, upsert: false });
  return { path: error ? null : path, content_type: ct };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Petición inválida" }, 400); }
  const action = body?.action;

  // ---------- Registro único del dueño (sin correo de confirmación) ----------
  if (action === "register") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Correo no válido" }, 400);
    if (password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
    const { data: list, error: le } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (le) return json({ error: le.message }, 500);
    if ((list?.users || []).length > 0) return json({ error: "Este estudio ya tiene dueño. Usa “Entrar”." }, 403);
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return json({ error: /dueño|Database error/i.test(error.message) ? "Este estudio ya tiene dueño. Usa “Entrar”." : error.message }, 400);
    return json({ ok: true });
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Inicia sesión primero." }, 401);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, 401);
  const uid = user.id;

  try {
    // ---------- Llaves ----------
    if (action === "setKey") {
      const provider = body.provider;
      if (!["anthropic", "fal"].includes(provider)) return json({ error: "Proveedor desconocido" }, 400);
      const key = String(body.key || "").trim();
      if (!key) {
        await admin.from("user_keys").delete().eq("user_id", uid).eq("provider", provider);
        return json({ ok: true, removed: true });
      }
      if (key.length > 400) return json({ error: "Llave demasiado larga" }, 400);
      const { error } = await admin.from("user_keys").upsert({ user_id: uid, provider, api_key: key, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "keyStatus") {
      const { data } = await admin.from("user_keys").select("provider, api_key, updated_at").eq("user_id", uid);
      const out: Record<string, unknown> = { anthropic: false, fal: false };
      for (const r of data || []) out[r.provider] = { set: true, hint: "…" + String(r.api_key).slice(-4), updated_at: r.updated_at };
      return json(out);
    }

    // ---------- Claude (texto) ----------
    if (action === "ai") {
      const key = await getKey(uid, "anthropic");
      if (!key) return json({ error: "Falta tu API key de Claude. Pégala en Configuración (o usa el modo Claude Premium copiar/pegar)." }, 400);
      const model = /^claude-[a-z0-9\-.]+$/.test(body.model || "") ? body.model : "claude-opus-5-5";
      const max_tokens = Math.min(Math.max(Number(body.max_tokens) || 4000, 100), 64000);
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens, system: body.system || undefined, messages: body.messages, temperature: body.temperature ?? 0.8 }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data?.error?.message || "Error de Claude", status: r.status }, 502);
      const text = (data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      return json({ text, usage: data.usage, stop_reason: data.stop_reason, model: data.model });
    }

    // ---------- Fal.ai: tu saldo real ----------
    if (action === "falBalance") {
      const key = await getKey(uid, "fal");
      if (!key) return json({ error: "Falta tu API key de Fal.ai." }, 400);
      const r = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", { headers: { Authorization: `Key ${key}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: `Fal.ai respondió ${r.status}`, status: r.status }, 502);
      return json({ balance: data?.credits?.current_balance ?? null, currency: data?.credits?.currency || "USD" });
    }

    // ---------- Fal.ai: precios en vivo ----------
    if (action === "falPrice") {
      const key = await getKey(uid, "fal");
      if (!key) return json({ error: "Falta tu API key de Fal.ai." }, 400);
      const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).filter((x: unknown) => APP_RE.test(String(x))).slice(0, 10);
      const qs = ids.map((i) => "endpoint_id=" + encodeURIComponent(i)).join("&");
      const r = await fetch(`https://api.fal.ai/v1/models/pricing?${qs}`, { headers: { Authorization: `Key ${key}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: `Fal.ai respondió ${r.status}` }, 502);
      return json(data);
    }

    // ---------- Fal.ai: generar imágenes o audio (síncrono) y guardarlo en tu almacenamiento ----------
    if (action === "falRun") {
      const key = await getKey(uid, "fal");
      if (!key) return json({ error: "Falta tu API key de Fal.ai. Pégala en Configuración." }, 400);
      const app = String(body.app || "");
      if (!APP_RE.test(app)) return json({ error: "Modelo de Fal.ai no válido" }, 400);
      const r = await fetch(`https://fal.run/${app}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body.input || {}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: data?.detail ? JSON.stringify(data.detail) : (data?.error || `Fal.ai respondió ${r.status}`) }, 502);
      const folder = `${uid}/${safeSeg(body.manhwaId)}`;
      if (data.audio?.url) {
        try { const s = await storeFile(data.audio.url, folder + "/audio", "tts", data.audio.content_type || "audio/wav"); return json({ audio: { ...s, url: data.audio.url } }); }
        catch (_e) { return json({ audio: { path: null, url: data.audio.url } }); }
      }
      const images = [];
      for (const im of data.images || []) {
        try { const s = await storeFile(im.url, folder, "gen", im.content_type || "image/png"); images.push({ ...s, url: im.url, width: im.width, height: im.height }); }
        catch (_e) { images.push({ path: null, url: im.url, width: im.width, height: im.height }); }
      }
      return json({ images, seed: data.seed, timings: data.timings, has_nsfw_concepts: data.has_nsfw_concepts });
    }

    // ---------- Fal.ai: cola (entrenamiento de LoRA) ----------
    if (action === "falSubmit") {
      const key = await getKey(uid, "fal");
      if (!key) return json({ error: "Falta tu API key de Fal.ai. Pégala en Configuración." }, 400);
      const app = String(body.app || "");
      if (!APP_RE.test(app)) return json({ error: "Modelo de Fal.ai no válido" }, 400);
      const r = await fetch(`https://queue.fal.run/${app}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body.input || {}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: data?.detail ? JSON.stringify(data.detail) : `Fal.ai respondió ${r.status}` }, 502);
      return json({ request_id: data.request_id, status_url: data.status_url, response_url: data.response_url });
    }
    if (action === "falStatus" || action === "falResult") {
      const key = await getKey(uid, "fal");
      if (!key) return json({ error: "Falta tu API key de Fal.ai." }, 400);
      const url = action === "falStatus" ? body.status_url : body.response_url;
      if (!falUrlOk(url)) return json({ error: "URL de Fal.ai no válida" }, 400);
      const r = await fetch(url + (action === "falStatus" ? (url.includes("?") ? "&" : "?") + "logs=1" : ""), { headers: { Authorization: `Key ${key}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 202) return json({ error: data?.detail ? JSON.stringify(data.detail) : `Fal.ai respondió ${r.status}` }, 502);
      return json(data);
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
