'use strict';
/* =====================================================================
   MI MANHWA STUDIO — núcleo: utilidades, almacenamiento, nube, UI base
   ===================================================================== */
const SB_URL = 'https://ggaydgzyjddtnavgqnyw.supabase.co';
const SB_KEY = 'sb_publishable_OiYmE4MTnDGDfYECyZLACw_GJnSyhwp'; // llave pública (segura de mostrar)
const FN_URL = SB_URL + '/functions/v1/studio';
const DEFAULT_MODEL = 'claude-opus-5-5';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtDate = t => t ? new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
function lev(a, b) { a = norm(a); b = norm(b); if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n); let p = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
const safeName = s => norm(s).replace(/\s+/g, '_').slice(0, 40) || 'manhwa';

/* ---------------- IndexedDB ---------------- */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('mi-manhwa-studio', 1);
      r.onupgradeneeded = () => { const d = r.result; ['manhwas', 'images', 'kv'].forEach(s => d.objectStoreNames.contains(s) || d.createObjectStore(s)); };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(store, mode, fn) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); }); },
  get(store, key) { return this.tx(store, 'readonly', s => s.get(key)); },
  put(store, key, val) { return this.tx(store, 'readwrite', s => s.put(val, key)); },
  del(store, key) { return this.tx(store, 'readwrite', s => s.delete(key)); },
  async all(store) { const d = await this.open(); return new Promise((res, rej) => { const out = []; const t = d.transaction(store, 'readonly'); const c = t.objectStore(store).openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); }
};

/* ---------------- Estado ---------------- */
const S = {
  manhwas: {},          // id -> manhwa (cada uno con su propio cerebro)
  settings: { aiMode: 'premium', model: DEFAULT_MODEL, spend: {}, falPrices: {}, audioPos: {}, falApp: 'fal-ai/flux-lora', sdxlModel: '', trainApp: 'fal-ai/flux-lora-fast-training', trainSteps: 1000, readerPos: {}, voice: {} },
  user: null, session: null, keyStatus: null,
  showArchived: false,
  sync: 'local'
};
const cur = () => S.manhwas[Route.mid];

/* ---------------- Modelo de datos ---------------- */
function newManhwa(name = 'Nuevo manhwa') {
  const t = Date.now();
  return {
    id: uid('m_'), name, createdAt: t, updatedAt: t, archived: false, coverImg: null,
    bible: { synopsis: '', plot: '', rules: '', genre: '', tone: '', protagonistId: '',
      style: { model: 'Pony', steps: 30, cfg: 7, width: 800, height: 1200, prefix: 'manhwa style, korean webtoon, clean lineart, vibrant colors, cinematic lighting', negative: 'lowres, bad anatomy, bad hands, extra fingers, text, watermark, signature, speech bubble, blurry' } },
    characters: [], places: [], powers: [], objects: [], factions: [], timeline: [],
    canon: [], chapters: [], images: {}, plotIdeas: [], nameBank: [], covers: {}
  };
}
function chapterList(m) { return [...(m.chapters || [])].sort((a, b) => (a.number || 0) - (b.number || 0)); }
function chapterByNum(m, n) { return (m.chapters || []).find(c => Number(c.number) === Number(n)); }

/* ---------------- Guardado local + nube ---------------- */
const dirty = new Set();
const pushSoon = debounce(() => pushDirty(), 1500);
function touch(m) {
  if (!m) return;
  m.updatedAt = Date.now();
  IDB.put('manhwas', m.id, m).catch(e => console.error(e));
  dirty.add(m.id);
  if (S.user) { setSync('busy', 'Guardando…'); pushSoon(); }
}
const saveSoon = debounce(m => touch(m), 500);

async function pushDirty() {
  if (!S.user || !sb) return;
  const ids = [...dirty]; dirty.clear();
  try {
    for (const id of ids) {
      const m = S.manhwas[id];
      if (!m) continue;
      const { error } = await sb.from('manhwas').upsert({ id: m.id, user_id: S.user.id, name: m.name, archived: !!m.archived, deleted: false, data: m, updated_at: new Date(m.updatedAt).toISOString() });
      if (error) throw error;
    }
    // subir imágenes pendientes
    for (const id of ids) { await uploadPendingImages(S.manhwas[id]); await uploadPendingAudios(S.manhwas[id]); await uploadPendingMedia(S.manhwas[id]); }
    setSync('ok', 'Guardado en la nube');
  } catch (e) {
    ids.forEach(i => dirty.add(i));
    setSync('err', 'Sin conexión — se guardará luego');
    console.warn(e);
    setTimeout(pushSoon, 15000);
  }
}
function setSync(state, text) {
  S.sync = state;
  const el = $('#sync'); if (!el) return;
  el.className = 'sync ' + (state === 'local' ? '' : state);
  el.querySelector('span').textContent = text || (S.user ? 'Nube' : 'Solo en este dispositivo');
}
const saveSettings = debounce(async () => {
  try { await IDB.put('kv', 'settings', S.settings); } catch (e) { }
  if (S.user && sb) { try { await sb.from('user_settings').upsert({ user_id: S.user.id, settings: S.settings, updated_at: new Date().toISOString() }); } catch (e) { } }
}, 1200);

async function loadLocal() {
  for (const [id, m] of await IDB.all('manhwas')) S.manhwas[id] = m;
  const st = await IDB.get('kv', 'settings'); if (st) Object.assign(S.settings, st);
}

async function pullCloud() {
  if (!S.user) return;
  setSync('busy', 'Sincronizando…');
  try {
    const { data, error } = await sb.from('manhwas').select('id,name,archived,deleted,data,updated_at');
    if (error) throw error;
    const cloudIds = new Set();
    for (const row of data) {
      cloudIds.add(row.id);
      const local = S.manhwas[row.id];
      const cloudT = new Date(row.updated_at).getTime();
      if (row.deleted) { if (local) { delete S.manhwas[row.id]; await IDB.del('manhwas', row.id); } continue; }
      if (!local || (local.updatedAt || 0) < cloudT) { S.manhwas[row.id] = row.data; await IDB.put('manhwas', row.id, row.data); }
      else if ((local.updatedAt || 0) > cloudT) dirty.add(row.id);
    }
    // locales que no están en la nube -> subir (excepto el ejemplo intacto si la nube ya tiene manhwas)
    for (const m of Object.values(S.manhwas)) {
      if (cloudIds.has(m.id)) continue;
      if (m.sample && !m.sampleTouched && data.length) { delete S.manhwas[m.id]; await IDB.del('manhwas', m.id); continue; }
      dirty.add(m.id);
    }
    const { data: st } = await sb.from('user_settings').select('settings').maybeSingle();
    if (st?.settings) { Object.assign(S.settings, st.settings); S.settings.spend ||= {}; S.settings.falPrices ||= {}; S.settings.audioPos ||= {}; S.settings.aiMode ||= 'premium'; await IDB.put('kv', 'settings', S.settings); if (S.settings.cc?.token && typeof ccStartPolling === 'function') ccStartPolling(); }
    if (dirty.size) await pushDirty(); else setSync('ok', 'Sincronizado');
  } catch (e) { console.warn(e); setSync('err', 'No se pudo sincronizar'); }
}

/* ---------------- Supabase / sesión ---------------- */
let sb = null;
try { sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } }); } catch (e) { console.warn('Supabase no cargó', e); }

async function initAuth() {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  S.session = data.session; S.user = data.session?.user || null;
  sb.auth.onAuthStateChange((ev, session) => {
    const was = S.user?.id;
    S.session = session; S.user = session?.user || null;
    if (S.user && S.user.id !== was) { pullCloud().then(() => { refreshKeyStatus(); render(); resumeTrainings(); }); }
    if (!S.user) { S.keyStatus = null; setSync('local', 'Solo en este dispositivo'); }
    renderSide();
  });
}
async function callFn(action, payload = {}) {
  if (!S.user) throw new Error('Inicia sesión en Configuración para usar la IA y Fal.ai (tus llaves viven en tu servidor privado).');
  const { data } = await sb.auth.getSession();
  const tok = data.session?.access_token;
  const r = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: SB_KEY }, body: JSON.stringify({ action, ...payload }) });
  let j = {}; try { j = await r.json(); } catch (e) { }
  if (!r.ok || j.error) throw new Error(j.error || ('Error ' + r.status));
  return j;
}
async function refreshKeyStatus() { if (!S.user) return; try { S.keyStatus = await callFn('keyStatus'); } catch (e) { S.keyStatus = null; } if (Route.view === 'config') render(); }

/* ---------------- Imágenes ---------------- */
const urlCache = {};
async function blobFromFile(file, maxW = 1600, keepAlpha = false) {
  // trabaja en grande: guarda hasta 1600px de ancho
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return { blob: file, w: 0, h: 0 };
  let w = bmp.width, h = bmp.height;
  if (w <= maxW && (keepAlpha || file.size < 2.5e6) && /jpe?g|png|webp/.test(file.type)) return { blob: file, w, h };
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, keepAlpha ? 'image/png' : 'image/jpeg', 0.92));
  return { blob, w, h };
}
async function addImage(m, file, meta = {}) {
  const { blob, w, h } = await blobFromFile(file, 1600, !!(meta.sticker || meta.png));
  const id = uid('img_');
  await IDB.put('images', id, blob);
  m.images[id] = { id, w, h, type: blob.type, source: meta.source || 'subida', createdAt: Date.now(), path: null, ...meta };
  touch(m);
  return id;
}
async function addRemoteImage(m, info, meta = {}) {
  // imagen generada en Fal.ai ya guardada en tu Storage por la función segura
  const id = uid('img_');
  m.images[id] = { id, w: info.width || 0, h: info.height || 0, type: info.content_type || 'image/jpeg', source: 'fal.ai', createdAt: Date.now(), path: info.path || null, remoteUrl: info.path ? null : info.url, ...meta };
  touch(m);
  return id;
}
async function getImageBlob(m, id) {
  if (!id) return null;
  let b = await IDB.get('images', id).catch(() => null);
  if (b) return b;
  const meta = m?.images?.[id]; if (!meta) return null;
  try {
    if (meta.path && S.user) { const { data, error } = await sb.storage.from('studio').download(meta.path); if (!error && data) b = data; }
    else if (meta.remoteUrl) { const r = await fetch(meta.remoteUrl); if (r.ok) b = await r.blob(); }
  } catch (e) { }
  if (b) await IDB.put('images', id, b).catch(() => { });
  return b;
}
async function imgURL(m, id) {
  if (!id) return null;
  if (urlCache[id]) return urlCache[id];
  const b = await getImageBlob(m, id);
  if (!b) return null;
  return (urlCache[id] = URL.createObjectURL(b));
}
async function imgBitmap(m, id) { const b = await getImageBlob(m, id); if (!b) return null; try { return await createImageBitmap(b); } catch (e) { return null; } }
async function uploadPendingImages(m) {
  if (!m || !S.user) return;
  for (const meta of Object.values(m.images || {})) {
    if (meta.path || meta.deleted) continue;
    const b = await IDB.get('images', meta.id).catch(() => null); if (!b) continue;
    const ext = (b.type || '').includes('png') ? 'png' : (b.type || '').includes('webp') ? 'webp' : 'jpg';
    const path = `${S.user.id}/${m.id}/${meta.id}.${ext}`;
    const { error } = await sb.storage.from('studio').upload(path, b, { contentType: b.type || 'image/jpeg', upsert: true });
    if (!error) { meta.path = path; m.updatedAt = Date.now(); await IDB.put('manhwas', m.id, m); dirty.add(m.id); }
  }
}
async function uploadPendingAudios(m) {
  if (!m || !S.user) return;
  for (const meta of Object.values(m.audios || {})) {
    if (meta.path) continue;
    const b = await IDB.get('kv', 'audio:' + m.id + ':' + meta.key).catch(() => null); if (!b) continue;
    const path = `${S.user.id}/${m.id}/audio/${hash(meta.key)}_${meta.at}.${meta.ext}`;
    const { error } = await sb.storage.from('studio').upload(path, b, { contentType: b.type, upsert: true });
    if (!error) { meta.path = path; m.updatedAt = Date.now(); await IDB.put('manhwas', m.id, m); dirty.add(m.id); }
  }
}
async function deleteImage(m, id) {
  const meta = m.images[id]; if (!meta) return;
  if (meta.path && S.user) sb.storage.from('studio').remove([meta.path]).catch(() => { });
  await IDB.del('images', id).catch(() => { });
  if (urlCache[id]) { URL.revokeObjectURL(urlCache[id]); delete urlCache[id]; }
  delete m.images[id];
  // quitar referencias
  (m.chapters || []).forEach(c => { (c.panels || []).forEach(p => { if (p.imageId === id) p.imageId = null; }); if (c.layout) { c.layout.items = c.layout.items.filter(it => it.imgId !== id); c.layout.items.forEach(it => it.layers = (it.layers || []).filter(l => l.imgId !== id)); } });
  if (typeof forgetBmp === 'function') forgetBmp(id);
  (m.characters || []).forEach(ch => { if (ch.imageId === id) ch.imageId = null; if (ch.sheet) for (const k in ch.sheet) if (ch.sheet[k] === id) ch.sheet[k] = null; ch.savedImages = (ch.savedImages || []).filter(s => s.imgId !== id); });
  (m.places || []).forEach(p => { if (p.imageId === id) p.imageId = null; });
  if (m.coverImg === id) m.coverImg = null;
  touch(m);
}
// pinta fondos de imágenes con data-img="id" después de render
async function hydrateImages(root = document) {
  const m = cur();
  for (const el of $$('[data-img]', root)) {
    const id = el.dataset.img; const mm = el.dataset.mid ? S.manhwas[el.dataset.mid] : m;
    if (!id || !mm) continue;
    imgURL(mm, id).then(u => { if (!u) return; if (el.tagName === 'IMG') el.src = u; else { el.style.backgroundImage = `url("${u}")`; el.classList.add('has'); const t = el.querySelector('.ph-t'); if (t) t.remove(); } });
  }
}
function pickFiles({ multiple = true, accept = 'image/*' } = {}) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res([...i.files]); i.click();
  });
}

/* ---------------- Toasts y modales ---------------- */
function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), type === 'err' ? 7000 : 3800); return t;
}
function modal(html, { wide = false, onClose } = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  $('#modals').appendChild(bg);
  const close = () => { bg.remove(); onClose && onClose(); };
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  bg.close = close;
  setTimeout(() => { const f = bg.querySelector('[autofocus]'); f && f.focus(); }, 30);
  return bg;
}
function confirmBox(text, { ok = 'Sí, borrar', danger = true, title = '¿Seguro?' } = {}) {
  return new Promise(res => {
    const bg = modal(`<h2>${esc(title)}</h2><p class="muted">${text}</p><div class="acts"><button data-x="no">Cancelar</button><button class="${danger ? 'danger' : 'pri'}" data-x="yes">${esc(ok)}</button></div>`, { onClose: () => res(false) });
    bg.querySelector('[data-x=no]').onclick = () => { bg.remove(); res(false); };
    bg.querySelector('[data-x=yes]').onclick = () => { bg.remove(); res(true); };
  });
}
function promptBox(title, value = '', { label = '', ok = 'Guardar', multiline = false } = {}) {
  return new Promise(res => {
    const bg = modal(`<h2>${esc(title)}</h2>${label ? `<p class="muted">${esc(label)}</p>` : ''}${multiline ? `<textarea autofocus id="pbv">${esc(value)}</textarea>` : `<input autofocus id="pbv" value="${esc(value)}">`}<div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="yes">${esc(ok)}</button></div>`, { onClose: () => res(null) });
    const v = () => bg.querySelector('#pbv').value;
    bg.querySelector('[data-x=no]').onclick = () => { bg.remove(); res(null); };
    bg.querySelector('[data-x=yes]').onclick = () => { const x = v(); bg.remove(); res(x); };
    if (!multiline) bg.querySelector('#pbv').onkeydown = e => { if (e.key === 'Enter') { const x = v(); bg.remove(); res(x); } };
  });
}
function choiceBox(title, text, choices) {
  return new Promise(res => {
    const bg = modal(`<h2>${esc(title)}</h2><p class="muted">${text}</p><div class="acts">${choices.map((c, i) => `<button class="${c.cls || ''}" data-i="${i}">${esc(c.label)}</button>`).join('')}</div>`, { onClose: () => res(null) });
    $$('[data-i]', bg).forEach(b => b.onclick = () => { bg.remove(); res(choices[+b.dataset.i].value); });
  });
}
async function busy(btn, fn, label = 'Trabajando…') {
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${esc(label)}`; }
  try { return await fn(); }
  catch (e) { if (e?.message !== 'Cancelado') { console.error(e); toast(e.message || String(e), 'err'); } }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}

/* ---------------- Enlace de campos (data-bind) ---------------- */
const BINDS = new Map(); let bindN = 0;
function B(obj) { const k = 'b' + (++bindN); BINDS.set(k, obj); return k; }
function bindAttr(obj, path, { num = false } = {}) { return `data-bind="${B(obj)}" data-path="${path}"${num ? ' data-num="1"' : ''}`; }
function getPath(o, p) { return p.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; }
document.addEventListener('input', e => {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  const obj = BINDS.get(el.dataset.bind); if (!obj) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num) v = v === '' ? '' : Number(v);
  setPath(obj, el.dataset.path, v);
  const m = cur(); if (m) { if (m.sample) m.sampleTouched = true; saveSoon(m); }
  if (el.dataset.onchange && ACT[el.dataset.onchange]) ACT[el.dataset.onchange](el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  ACT[el.dataset.change] && ACT[el.dataset.change](el, e);
});

/* ---------------- Acciones (data-a) ---------------- */
const ACT = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const f = ACT[el.dataset.a]; if (!f) return;
  e.preventDefault(); e.stopPropagation();
  f(el, e);
});
ACT.openMenu = () => document.body.classList.add('menu');
ACT.closeMenu = () => document.body.classList.remove('menu');
ACT.go = el => { location.hash = el.dataset.to; document.body.classList.remove('menu'); };

/* ---------------- Rutas ---------------- */
const Route = { view: 'home', mid: null, a: null, b: null, c: null };
function parseRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const p = h.split('/').filter(Boolean);
  Object.assign(Route, { view: 'home', mid: null, a: null, b: null, c: null });
  if (!p.length) return;
  if (p[0] === 'm' && p[1]) { Route.mid = p[1]; Route.view = p[2] || 'biblia'; Route.a = p[3] || null; Route.b = p[4] || null; Route.c = p[5] || null; }
  else { Route.view = p[0]; Route.a = p[1] || null; Route.b = p[2] || null; }
}
const go = h => { location.hash = h; };
const mlink = (m, ...rest) => `#/m/${m.id}/${rest.join('/')}`;

const VIEWS = {};
function render() {
  parseRoute();
  BINDS.clear();
  if (Route.mid && !S.manhwas[Route.mid]) { go('#/'); return; }
  if (Route.view !== 'buscar') { const g = $('#gsearch'); if (g && document.activeElement !== g) g.value = ''; }
  if (window.Reader && Route.view !== 'lector') Reader.stop(true);
  if (Route.view !== 'video' && typeof vStop === 'function') vStop();
  const v = VIEWS[Route.view] || VIEWS.home;
  let html = '';
  try { html = v(); } catch (e) { console.error(e); html = `<div class="alert bad">Error al mostrar esta sección: ${esc(e.message)}</div>`; }
  $('#view').innerHTML = html;
  renderSide();
  hydrateImages($('#view'));
  if (typeof wkMount === 'function') wkMount();
  if (typeof coWriteMount === 'function') coWriteMount();
  if (typeof docMount === 'function') docMount();
  const after = AFTER[Route.view]; if (after) try { after(); } catch (e) { console.error(e); }
  window.scrollTo({ top: 0 });
}
const AFTER = {};
window.addEventListener('hashchange', render);

function renderSide() {
  const m = cur();
  const redes = ['redes', 'video'].includes(Route.view);
  const on = v => Route.view === v ? 'on' : '';
  const n = (to, ic, label, v) => `<a class="nav ${v ? on(v) : ''}" data-a="go" data-to="${to}"><span class="ic">${ic}</span>${label}</a>`;
  let h = `<div class="brand" data-a="go" data-to="#/"><div class="logo">✦</div><div>MI MANHWA<br><span style="color:var(--neon)">STUDIO</span></div></div>`;
  h += n('#/', '🗂️', 'Mis Manhwas', 'home');
  if (m) {
    h += `<div class="curm"><span class="tiny dim">Manhwa abierto</span><b>${esc(m.name)}</b></div>`;
    h += `<div class="modes"><button class="${!redes ? 'on' : ''}" data-a="go" data-to="${mlink(m, 'biblia')}">📖 MODO MANHWA</button><button class="${redes ? 'on' : ''}" data-a="go" data-to="${mlink(m, 'redes')}">🎬 MODO REDES</button></div>`;
    if (redes) {
      h += `<div class="navsec">Videos</div>`;
      h += n(mlink(m, 'redes'), '🎬', 'Mis videos', 'redes');
      (m.videos || []).slice(-6).reverse().forEach(v => { h += `<a class="nav ${Route.view === 'video' && Route.a === v.id ? 'on' : ''}" data-a="go" data-to="${mlink(m, 'video', v.id)}"><span class="ic">▸</span>${esc(v.name.slice(0, 22))}</a>`; });
      h += `<a class="nav" data-a="vNew"><span class="ic">＋</span>Nuevo video</a><a class="nav" data-a="toVideo"><span class="ic">📖</span>Capítulo → video</a>`;
    } else {
      h += `<div class="navsec">Cerebro</div>`;
      h += n(mlink(m, 'biblia'), '🧠', 'Biblia y estilo', 'biblia');
      h += n(mlink(m, 'canon'), '📌', 'Fichas Canon', 'canon');
      h += n(mlink(m, 'ideas'), '💡', 'Dame ideas', 'ideas');
      h += `<div class="navsec">Universo</div>`;
      for (const [k, t] of Object.entries(TYPES)) h += `<a class="nav ${Route.view === 'wiki' && Route.a === k ? 'on' : ''}" data-a="go" data-to="${mlink(m, 'wiki', k)}"><span class="ic">${t.icon}</span>${t.label}</a>`;
      h += `<div class="navsec">Producción</div>`;
      h += n(mlink(m, 'caps'), '📖', 'Capítulos', 'caps');
      if (Route.view === 'cap' || Route.view === 'armador') { const ch = chapterById(m, Route.a); if (ch) { h += `<a class="nav ${Route.view === 'cap' ? 'on' : ''}" style="margin-left:14px" data-a="go" data-to="${mlink(m, 'cap', ch.id)}"><span class="ic">↳</span>Cap ${esc(ch.number)} · Guion</a>`; h += `<a class="nav ${Route.view === 'armador' ? 'on' : ''}" style="margin-left:14px" data-a="go" data-to="${mlink(m, 'armador', ch.id)}"><span class="ic">↳</span>Editor de Manhwa</a>`; } }
      h += n(mlink(m, 'lora'), '🧪', 'Laboratorio LoRA', 'lora');
      h += n(mlink(m, 'portada'), '🖼️', 'Portadas', 'portada');
      h += `<div class="navsec">Escuchar</div>`;
      h += n(mlink(m, 'lector', 'novela'), '🎧', 'Leer como novela', Route.a === 'novela' ? 'lector' : '');
      h += n(mlink(m, 'lector', 'universo'), '🌌', 'Escuchar mi universo', Route.a === 'universo' ? 'lector' : '');
    }
  }
  h += `<div class="navsec">Estudio</div>`;
  h += n('#/trabajadores', '👷', 'Mis 4 trabajadores', 'trabajadores');
  h += n('#/config', '⚙️', 'Configuración', 'config');
  if (typeof isStandalone === 'function' && !isStandalone()) h += `<a class="nav" data-a="installApp" style="${INSTALL_EVT ? 'color:var(--neon);font-weight:700' : ''}"><span class="ic">📲</span>Instalar app</a>`;
  h += `<a class="nav" data-a="ccOpen"><span class="ic">🔌</span>Claude Code: ${CC.ok ? '<b style="color:var(--ok)">SÍ</b>' : 'NO'}</a>`;
  if (typeof falSpentMonth === 'function') h += `<a class="nav" data-a="go" data-to="#/trabajadores" style="margin-top:10px;border:1px solid var(--line);flex-direction:column;align-items:flex-start;gap:2px"><span class="tiny dim">💸 Este mes has gastado</span><b style="color:var(--neon)">${mx(falSpentMonth())} en Fal.ai</b></a>`;
  h += `<div style="margin-top:auto;padding:16px 10px 0" class="tiny dim">${S.user ? '☁️ ' + esc(S.user.email) : '💾 Modo local (inicia sesión para sincronizar)'}</div>`;
  $('#side').innerHTML = h;
}
function chapterById(m, id) { return (m?.chapters || []).find(c => c.id === id); }

/* ---------------- Búsqueda global ---------------- */
document.addEventListener('keydown', e => {
  if (e.target.id === 'gsearch' && e.key === 'Enter') { const q = e.target.value.trim(); if (q) go('#/buscar/' + encodeURIComponent(q)); }
});

/* ---------------- IA (Claude Haiku vía tu función segura) ---------------- */
/* ---------------- Precios (USD). Se confirman antes de cobrar ---------------- */
const CLAUDE_MODELS = {
  'claude-opus-5-5': { label: 'Claude Opus 5.5', in: 4, out: 20 },
  'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', in: 2, out: 10 },
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', in: 0.10, out: 0.50 }
};
const FAL_DEFAULT = { 'fal-ai/flux-lora': 0.035 /* por megapíxel */, 'fal-ai/lora': 0.035 /* aprox. */, 'fal-ai/flux-lora-fast-training': 2 /* por 1000 pasos */, tts: 0.02 /* por 1000 caracteres */ };
const money = v => v <= 0 ? '$0.00' : v < 0.01 ? 'menos de $0.01' : '$' + (v < 1 ? v.toFixed(3) : v.toFixed(2));
const monthKey = () => new Date().toISOString().slice(0, 7);
function spentThisMonth() { return (S.settings.spend || {})[monthKey()] || 0; }
function addSpend(v) { if (!(v > 0)) return; S.settings.spend ||= {}; S.settings.spend[monthKey()] = spentThisMonth() + v; saveSettings(); }
function falUnit(app) { const lp = S.settings.falPrices?.[app]; return lp?.price ?? FAL_DEFAULT[app] ?? 0.035; }
function costImages(n, w, h, app = S.settings.falApp || 'fal-ai/flux-lora') { const mp = Math.max(1, Math.ceil((w * h) / 1e6)); return n * mp * falUnit(app); }
function costTTS(chars) { return (chars / 1000) * (S.settings.falPrices?.tts?.price ?? FAL_DEFAULT.tts); }
function costTrain(steps) { return falUnit(S.settings.trainApp || 'fal-ai/flux-lora-fast-training') * (steps / 1000); }
const usingCC = () => typeof CC !== 'undefined' && CC.ok && CC.info?.ask;
const isPremium = () => (S.settings.aiMode || 'premium') === 'premium' || usingCC();
function costAI(promptChars, outTokens, maxTokens) {
  if (isPremium()) return { cost: 0, max: 0, free: true };
  const M = CLAUDE_MODELS[S.settings.model] || CLAUDE_MODELS[DEFAULT_MODEL];
  const tin = promptChars / 3.2;
  return { cost: (tin * M.in + outTokens * M.out) / 1e6, max: (tin * M.in + maxTokens * M.out) / 1e6 };
}
function aiLine(promptChars, outTokens, maxTokens, label = 'Texto con Claude') {
  const c = costAI(promptChars, outTokens, maxTokens);
  if (c.free) return { label: `${label} · ${usingCC() ? 'tu Claude Code' : 'Claude Premium (copiar y pegar)'}`, cost: 0, note: 'Gratis: usa tu plan de Claude' };
  return { label: `${label} · ${(CLAUDE_MODELS[S.settings.model] || {}).label || S.settings.model}`, cost: c.cost, note: `máximo ${money(c.max)}` };
}
/* Muestra el precio y pide confirmación. lines: [{label, cost, note}] */
async function confirmCost(title, lines, { extra = '' } = {}) {
  const total = lines.reduce((a, l) => a + (l.cost || 0), 0);
  if (total <= 0 && lines.every(l => !l.cost)) return true; // nada que cobrar
  return new Promise(res => {
    const bg = modal(`<h2>💲 ${esc(title)}</h2>
      <div class="col" style="gap:8px">${lines.map(l => `<div class="row nw between"><div class="small grow">${esc(l.label)}${l.note ? `<div class="tiny dim">${esc(l.note)}</div>` : ''}</div><b class="mono">${money(l.cost || 0)}</b></div>`).join('<hr>')}</div>
      <div class="row nw between" style="font-size:18px"><b>Total estimado</b><b style="color:var(--neon)">${money(total)} USD</b></div>
      ${extra ? `<div class="alert info small">${extra}</div>` : ''}
      <div class="tiny dim">Precio estimado con las tarifas de Fal.ai y Claude; el cobro real lo hace cada servicio a tu cuenta. Este mes llevas ≈ ${money(spentThisMonth())}.</div>
      <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="yes">Sí, gastar ${money(total)}</button></div>`, { onClose: () => res(false) });
    bg.querySelector('[data-x=no]').onclick = () => { bg.remove(); res(false); };
    bg.querySelector('[data-x=yes]').onclick = () => { bg.remove(); res(true); };
  });
}
async function refreshFalPrices() {
  if (!S.user || !S.keyStatus?.fal) return;
  try {
    const ids = ['fal-ai/flux-lora', 'fal-ai/lora', 'fal-ai/flux-lora-fast-training', 'fal-ai/kokoro/spanish'];
    const r = await callFn('falPrice', { ids });
    for (const p of r.prices || []) {
      const price = Number(p.unit_price ?? p.price); if (!(price >= 0)) continue;
      const key = p.endpoint_id?.startsWith('fal-ai/kokoro') ? 'tts' : p.endpoint_id;
      S.settings.falPrices[key] = { price, unit: p.unit || '', at: Date.now() };
    }
    saveSettings();
  } catch (e) { /* se usan los precios de respaldo */ }
}

/* ---------------- IA de texto ----------------
   Modo "premium": usa TU plan de Claude (copiar y pegar en claude.ai, $0 extra).
   Modo "api": llama a Claude con tu API key (cobro por uso, se confirma el precio). */
function premiumAI(prompt, title) {
  return new Promise((res, rej) => {
    const bg = modal(`<h2>🤖 ${esc(title || 'Pídeselo a tu Claude')}</h2>
      <ol class="small muted" style="margin:0;padding-left:18px"><li>Toca <b>Copiar instrucciones</b>.</li><li>Abre Claude (tu plan premium), pega y envía.</li><li>Copia TODA la respuesta de Claude y pégala abajo.</li></ol>
      <textarea readonly id="pai" style="min-height:120px;font-size:12px" class="mono">${esc(prompt)}</textarea>
      <div class="row"><button class="pri" data-x="copy">📋 Copiar instrucciones</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">↗ Abrir Claude</a><span class="tiny dim">${prompt.length.toLocaleString('es')} caracteres</span></div>
      <label class="f">Respuesta de Claude<textarea id="pans" style="min-height:160px" placeholder="Pega aquí la respuesta completa…"></textarea></label>
      <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="ok">Usar respuesta</button></div>`, { wide: true, onClose: () => rej(new Error('Cancelado')) });
    bg.querySelector('[data-x=copy]').onclick = async e => { try { await navigator.clipboard.writeText(prompt); e.target.textContent = '✔ Copiado'; } catch (_) { const t = bg.querySelector('#pai'); t.select(); document.execCommand('copy'); e.target.textContent = '✔ Copiado'; } };
    bg.querySelector('[data-x=no]').onclick = () => { bg.remove(); rej(new Error('Cancelado')); };
    bg.querySelector('[data-x=ok]').onclick = () => { const t = bg.querySelector('#pans').value.trim(); if (!t) return toast('Pega la respuesta de Claude', 'err'); bg.remove(); res({ text: t, stop: 'end_turn' }); };
  });
}
async function ai(prompt, { system = '', max_tokens = 4000, temperature = 0.8, estOut, confirmed = false, title = '' } = {}) {
  const full = (system ? system + '\n\n' : '') + prompt;
  // 1) Claude Code conectado: automático y con tu plan (sin llave, sin copiar/pegar)
  if (typeof CC !== 'undefined' && CC.ok && CC.info?.ask) {
    const tt = toast('🔌 Tu Claude Code está trabajando' + (title ? ': ' + title : '') + '… (puede tardar un par de minutos)');
    try { const r = await ccFetch('/ask', { method: 'POST', body: JSON.stringify({ prompt: full, title }) }, 16 * 60 * 1000); return { text: r.text || '', stop: 'end_turn' }; }
    catch (e) { toast('Claude Code no respondió (' + e.message + '). Uso el otro modo.', 'err'); }
  } else if (typeof CC !== 'undefined' && CC.ok && !CC.info?.ask) toast('Actualiza tu puente de Claude Code para que haga esto solo (te mandé el archivo nuevo).');
  if (isPremium()) return premiumAI(full, title);
  if (!confirmed) {
    const line = aiLine(full.length, estOut ?? Math.round(max_tokens * 0.4), max_tokens, title || 'Texto con Claude');
    if (!await confirmCost(title || 'Usar Claude', [line])) throw new Error('Cancelado');
  }
  const r = await callFn('ai', { model: S.settings.model || DEFAULT_MODEL, max_tokens, temperature, system, messages: [{ role: 'user', content: prompt }] });
  if (r.usage) { const M = CLAUDE_MODELS[r.model] || CLAUDE_MODELS[S.settings.model] || CLAUDE_MODELS[DEFAULT_MODEL]; addSpend((r.usage.input_tokens * M.in + r.usage.output_tokens * M.out) / 1e6); }
  return { text: r.text || '', stop: r.stop_reason };
}
function parseJSON(text) {
  let t = String(text).replace(/```(?:json)?/gi, '').trim();
  const a = t.search(/[\[{]/); if (a < 0) throw new Error('La IA no devolvió datos válidos. Intenta de nuevo.');
  const open = t[a], close = open === '[' ? ']' : '}';
  const b = t.lastIndexOf(close);
  const body = t.slice(a, b + 1);
  try { return JSON.parse(body); }
  catch (e) {
    // reparación simple: cortar al último objeto completo
    const cut = body.lastIndexOf('},');
    if (cut > 0) { try { return JSON.parse(body.slice(0, cut + 1) + (open === '[' ? ']' : '}')); } catch (_) { } }
    throw new Error('La IA devolvió un formato incompleto. Intenta de nuevo.');
  }
}
async function aiJSON(prompt, opts = {}) {
  const { text } = await ai(prompt + '\n\nResponde SOLO con JSON válido, sin texto antes ni después.', { temperature: 0.7, ...opts });
  return parseJSON(text);
}
function parseJSONL(text) {
  const out = [];
  for (const line of String(text).split('\n')) { const l = line.trim().replace(/,$/, ''); if (!l.startsWith('{')) continue; try { out.push(JSON.parse(l)); } catch (e) { } }
  return out;
}

/* Contexto del cerebro de UN manhwa (nunca mezcla otros) */
function brain(m, { maxChars = 50000, skipChapterId = null } = {}) {
  const L = [];
  const b = m.bible || {};
  L.push(`MANHWA: ${m.name}`);
  if (b.genre) L.push(`Género: ${b.genre}`); if (b.tone) L.push(`Tono: ${b.tone}`);
  if (b.synopsis) L.push(`Sinopsis: ${b.synopsis}`);
  if (b.plot) L.push(`Trama completa: ${b.plot}`);
  if (b.rules) L.push(`Reglas del mundo: ${b.rules}`);
  if (b.extras) L.push(`Apuntes del autor:\n${String(b.extras).slice(0, 15000)}`);
  for (const s of b.sections || []) if (s.text) L.push(`\n## ${String(s.title).toUpperCase()}\n${String(s.text).slice(0, 6000)}`);
  const ent = (title, arr, fn) => { if (arr?.length) { L.push(`\n## ${title}`); arr.forEach(x => L.push('- ' + fn(x))); } };
  const nm = id => findEntity(m, id)?.name || '?';
  ent('PERSONAJES', m.characters, c => [c.name, c.nickname && `apodo "${c.nickname}"`, c.age && `${c.age} años`, c.role, c.status && `estado: ${c.status}`, c.power && `poder: ${c.power}`, c.weakness && `debilidad: ${c.weakness}`, c.trauma && `trauma: ${c.trauma}`, c.goal && `objetivo: ${c.goal}`, c.appearance && `apariencia: ${c.appearance}`, (c.relations || []).length && 'relaciones: ' + c.relations.map(r => `${r.kind} de ${nm(r.target)}`).join(', ')].filter(Boolean).join(' · '));
  ent('LUGARES', m.places, p => [p.name, p.kind, p.description, p.climate && `clima: ${p.climate}`, p.inhabitants && `habitantes: ${p.inhabitants}`, p.rules && `reglas: ${p.rules}`].filter(Boolean).join(' · '));
  ent('PODERES Y SISTEMA', m.powers, p => [p.name, p.kind, p.description, p.ranks && `rangos: ${p.ranks}`, p.cost && `costo: ${p.cost}`].filter(Boolean).join(' · '));
  ent('OBJETOS', m.objects, p => [p.name, p.kind, p.description, p.owner && `dueño: ${p.owner}`].filter(Boolean).join(' · '));
  ent('FACCIONES Y GREMIOS', m.factions, p => [p.name, p.kind, p.description, p.leader && `líder: ${p.leader}`].filter(Boolean).join(' · '));
  ent('LÍNEA DE TIEMPO', [...(m.timeline || [])].sort((a, b) => (a.order || 0) - (b.order || 0)), t => `${t.when}: ${t.name}${t.description ? ' — ' + t.description : ''}`);
  ent('FICHAS CANON (hechos fijos)', m.canon, f => `${f.entity} · ${f.attribute} · ${f.value}${f.since ? ' · desde Cap ' + f.since : ''}${f.note ? ' (' + f.note + ')' : ''}`);
  const caps = chapterList(m).filter(c => c.id !== skipChapterId && (c.summary || c.premise));
  if (caps.length) { L.push('\n## CAPÍTULOS ANTERIORES'); caps.forEach(c => L.push(`- Cap ${c.number} "${c.title || ''}": ${c.summary || c.premise}`)); }
  let s = L.join('\n');
  if (s.length > maxChars) s = s.slice(0, maxChars) + '\n…(recortado)';
  return s;
}
function findEntity(m, id) { for (const k of Object.keys(TYPES)) { const e = (m[TYPES[k].key] || []).find(x => x.id === id); if (e) return e; } return null; }
function findEntityType(m, id) { for (const k of Object.keys(TYPES)) if ((m[TYPES[k].key] || []).some(x => x.id === id)) return k; return null; }
