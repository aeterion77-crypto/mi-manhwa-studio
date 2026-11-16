/* =====================================================================
   🎬 MODO REDES: editor de video con timeline (como tu captura).
   Pistas Imagen / B-roll / Texto / Voz / Efectos / Música 1 / Música 2,
   notas, transcripción editable, grabar voz, subtítulos, quitar silencios,
   animaciones por código y exportar TikTok / Reels / YouTube. Sin IA externa.
   ===================================================================== */
const VTRACKS = [['img', 'Imagen', 'visual'], ['broll', 'B-roll', 'visual'], ['txt', 'Texto', 'text'], ['voz', 'Voz', 'audio'], ['fx', 'Efectos', 'audio'], ['mus1', 'Música 1', 'audio'], ['mus2', 'Música 2', 'audio']];
const VFORMATS = { tiktok: ['TikTok', 1080, 1920], reels: ['Reels', 1080, 1920], youtube: ['YouTube', 1920, 1080] };
const NOTE_CATS = ['General', 'Estética', 'Música', 'Motion graphics', 'B-roll', 'Corte', 'Texto', 'Sonido'];
const SUB_STYLES = { bold: 'Grande blanco (como tu captura)', amarillo: 'Palabra activa amarilla', caja: 'Caja negra', manhwa: 'Estilo manhwa' };
function newVideo(name = 'Nuevo video') {
  return { id: uid('v_'), name, format: 'tiktok', fit: 'blur', createdAt: Date.now(), updatedAt: Date.now(), clips: [], notes: [], words: [], subs: { on: false, style: 'bold', pos: 0.74, size: 1, n: 3 }, tvol: {}, tmute: {}, zoom: 40, lang: 'es' };
}
const vById = (m, id) => (m.videos || []).find(v => v.id === id);
const vDur = v => Math.max(1, ...v.clips.map(c => c.start + c.dur));
const trackType = t => (VTRACKS.find(x => x[0] === t) || [])[2];
const fmtT = (s, cs = false) => { s = Math.max(0, s); const mi = Math.floor(s / 60), se = Math.floor(s % 60); return mi + ':' + String(se).padStart(2, '0') + (cs ? '.' + String(Math.floor((s % 1) * 100)).padStart(2, '0') : ''); };
const dbToGain = db => Math.pow(10, (db || 0) / 20);
function parseTime(str, v, playhead) {
  const s = norm(str); let m;
  if ((m = str.match(/(\d+):(\d{1,2})(?:[.,](\d+))?/))) return +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0);
  if ((m = s.match(/minuto\s+(\d+)(?:\s+(?:y|con)\s+(\d+))?/))) return +m[1] * 60 + (+m[2] || 0);
  if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:segundos?|seg|s)\b/))) return parseFloat(m[1].replace(',', '.'));
  if (/\b(al final|final)\b/.test(s)) return vDur(v);
  if (/\b(inicio|principio|comienzo)\b/.test(s)) return 0;
  if (/\baqui\b/.test(s)) return playhead;
  if ((m = s.match(/\b(\d+(?:[.,]\d+)?)\b/))) return parseFloat(m[1].replace(',', '.'));
  return null;
}

/* ---------------- Media (videos, audios, imágenes) ---------------- */
async function mediaDuration(blob, type) {
  return new Promise(res => { const el = document.createElement(type === 'video' ? 'video' : 'audio'); el.preload = 'metadata'; el.src = URL.createObjectURL(blob); el.onloadedmetadata = () => { const d = el.duration; URL.revokeObjectURL(el.src); res(isFinite(d) ? d : 0); }; el.onerror = () => res(0); setTimeout(() => res(0), 8000); });
}
async function addMedia(m, file, extra = {}) {
  const type = /^video\//.test(file.type) ? 'video' : /^audio\//.test(file.type) ? 'audio' : 'image';
  if (type === 'image') { const id = await addImage(m, file, { source: 'video' }); m.media ||= {}; m.media[id] = { id, type: 'image', name: file.name || 'imagen', img: true, ...extra }; touch(m); return m.media[id]; }
  const id = uid('md_'); await IDB.put('images', id, file);
  const dur = await mediaDuration(file, type);
  let w = 0, h = 0; if (type === 'video') { const v = document.createElement('video'); v.src = URL.createObjectURL(file); await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 5000); }); w = v.videoWidth; h = v.videoHeight; URL.revokeObjectURL(v.src); }
  m.media ||= {}; m.media[id] = { id, type, name: (file.name || type).replace(/\.\w+$/, ''), dur, w, h, size: file.size, mime: file.type, path: null, createdAt: Date.now(), ...extra };
  touch(m); return m.media[id];
}
async function mediaBlob(m, id) {
  if (m.images?.[id]) return getImageBlob(m, id);
  let b = await IDB.get('images', id).catch(() => null); if (b) return b;
  const meta = m.media?.[id]; if (meta?.path && S.user) { const { data } = await sb.storage.from('studio').download(meta.path); if (data) { b = data; IDB.put('images', id, b).catch(() => { }); } }
  return b;
}
async function uploadPendingMedia(m) {
  if (!m || !S.user) return;
  for (const meta of Object.values(m.media || {})) {
    if (meta.path || meta.img || meta.synth || (meta.size || 0) > 45e6) continue;
    const b = await IDB.get('images', meta.id).catch(() => null); if (!b) continue;
    const ext = (b.type.split('/')[1] || 'bin').split(';')[0];
    const path = `${S.user.id}/${m.id}/media/${meta.id}.${ext}`;
    const { error } = await sb.storage.from('studio').upload(path, b, { contentType: b.type, upsert: true });
    if (!error) { meta.path = path; m.updatedAt = Date.now(); await IDB.put('manhwas', m.id, m); dirty.add(m.id); }
  }
}
/* caché de audio decodificado y picos (forma de onda) */
const ABUF = new Map(); const PEAKS = new Map();
async function audioBufFor(m, clip) {
  const key = clip.kind === 'synthMusic' ? `mus:${clip.style}:${Math.ceil(clip.in + clip.dur + 1)}` : clip.kind === 'synthSfx' ? `sfx:${clip.sfx}` : clip.media;
  if (ABUF.has(key)) return ABUF.get(key);
  let buf = null;
  try {
    if (clip.kind === 'synthMusic') buf = await renderMusic(clip.style, Math.ceil(clip.in + clip.dur + 1));
    else if (clip.kind === 'synthSfx') buf = await renderSFXBuffer(clip.sfx);
    else { const b = await mediaBlob(m, clip.media); if (b) buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await b.arrayBuffer()); }
  } catch (e) { buf = null; }
  ABUF.set(key, buf);
  if (buf) { const d = buf.getChannelData(0); const step = Math.max(1, Math.floor(buf.sampleRate * 0.05)); const pk = new Float32Array(Math.ceil(d.length / step)); for (let i = 0; i < pk.length; i++) { let mx = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 8) mx = Math.max(mx, Math.abs(d[j])); pk[i] = mx; } PEAKS.set(key, { pk, step: 0.05 }); }
  return buf;
}
function peaksKey(c) { return c.kind === 'synthMusic' ? `mus:${c.style}:${Math.ceil(c.in + c.dur + 1)}` : c.kind === 'synthSfx' ? `sfx:${c.sfx}` : c.media; }
/* mezcla completa del audio (para reproducir y exportar) */
async function mixAudio(m, v) {
  const sr = 44100, dur = vDur(v) + 0.3; const ac = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const busG = {}; for (const [t] of VTRACKS) { const g = ac.createGain(); g.gain.value = v.tmute?.[t] ? 0 : (v.tvol?.[t] ?? 1); g.connect(ac.destination); busG[t] = g; }
  for (const c of v.clips) {
    const hasAudio = ['audio', 'synthMusic', 'synthSfx', 'video'].includes(c.kind); if (!hasAudio || c.muted) continue;
    const buf = await audioBufFor(m, c); if (!buf) continue;
    const s = ac.createBufferSource(); s.buffer = buf; s.loop = c.kind === 'synthMusic' ? false : !!c.loop;
    const g = ac.createGain(); const base = dbToGain(c.vol); const t0 = c.start, t1 = c.start + c.dur;
    g.gain.setValueAtTime(c.fadeIn ? 0.0001 : base, t0);
    if (c.fadeIn) g.gain.linearRampToValueAtTime(base, t0 + Math.min(c.fadeIn, c.dur));
    if (c.fadeOut) { g.gain.setValueAtTime(base, Math.max(t0, t1 - c.fadeOut)); g.gain.linearRampToValueAtTime(0.0001, t1); }
    s.connect(g); g.connect(busG[c.track] || ac.destination);
    s.start(t0, Math.max(0, c.in || 0), c.dur);
  }
  return ac.startRendering();
}

/* ---------------- Motor de reproducción / dibujo ---------------- */
class VEngine {
  constructor(m, v) { this.m = m; this.v = v; this.vid = new Map(); this.img = new Map(); this.parts = new Map(); this.t = 0; this.playing = false; this.rate = 1; this.mix = null; this.mixSig = ''; }
  async prepare() {
    await ensureFonts();
    for (const c of this.v.clips) {
      if (c.kind === 'video' && !this.vid.has(c.media)) { const b = await mediaBlob(this.m, c.media); if (!b) continue; const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.preload = 'auto'; el.src = URL.createObjectURL(b); this.vid.set(c.media, el); await new Promise(r => { el.onloadeddata = r; setTimeout(r, 4000); }); }
      if (c.kind === 'image' && !this.img.has(c.media)) this.img.set(c.media, await bmpCached(this.m, c.media));
      if (c.kind === 'manhwa') { const it = this.item(c); if (it) { if (it.imgId && !this.img.has(it.imgId)) { const b = await getImageBlob(this.m, it.imgId); this.img.set(it.imgId, b ? await createImageBitmap(b).catch(() => null) : null); } await loadLayerBitmaps(this.m, it.layers); } }
    }
  }
  item(c) { const ch = chapterById(this.m, c.chap); return ch?.layout?.items.find(i => i.id === c.item) || null; }
  sig() { return JSON.stringify(this.v.clips.filter(c => c.track !== 'img' || c.kind === 'video').map(c => [c.id, c.start, c.dur, c.in, c.vol, c.fadeIn, c.fadeOut, c.track, c.muted, c.media, c.style, c.sfx])) + JSON.stringify([this.v.tvol, this.v.tmute]); }
  async ensureMix() { const s = this.sig(); if (s !== this.mixSig || !this.mix) { this.mixSig = s; this.mix = await mixAudio(this.m, this.v); } return this.mix; }
  activeAt(track, t) { return this.v.clips.filter(c => c.track === track && t >= c.start && t < c.start + c.dur).sort((a, b) => b.start - a.start)[0] || null; }
  syncVideos(t, playing) {
    for (const [id, el] of this.vid) {
      const c = this.v.clips.find(x => x.kind === 'video' && x.media === id && t >= x.start && t < x.start + x.dur);
      if (!c) { if (!el.paused) el.pause(); continue; }
      const want = (c.in || 0) + (t - c.start);
      if (Math.abs(el.currentTime - want) > (playing ? 0.3 : 0.04)) { try { el.currentTime = want; } catch (e) { } }
      el.playbackRate = this.rate;
      if (playing && el.paused) el.play().catch(() => { }); if (!playing && !el.paused) el.pause();
    }
  }
  drawVisual(ctx, W, H, c, t, dt) {
    const local = t - c.start; const fx = c.fx || {};
    let alpha = 1, sc = 1, dx = 0, dy = 0;
    const p = local / 0.4; if (p < 1) { const e = ease(p); if (fx.enter === 'fade') alpha = e; else if (fx.enter === 'zoom') { sc = 1.2 - 0.2 * e; alpha = Math.min(1, p * 2); } else if (fx.enter === 'slide') dy = (1 - e) * H * 0.25; else if (fx.enter === 'slideL') dx = (1 - e) * W * 0.6; }
    const outp = (c.start + c.dur - t) / 0.4; if (fx.exit === 'fade' && outp < 1) alpha *= Math.max(0, outp);
    const shakes = [...(fx.shake ? [0] : []), ...(fx.shakeAt || [])]; for (const s0 of shakes) { const l = local - s0; if (l >= 0 && l < 0.3) { const k = (1 - l / 0.3) * W * 0.02; dx += Math.sin(l * 90) * k; dy += Math.cos(l * 77) * k; } }
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(W / 2 + dx, H / 2 + dy); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    if (c.kind === 'manhwa') {
      const it = this.item(c); if (it) { const bmp = it.imgId ? this.img.get(it.imgId) : null; if (bmp && CAN_FILTER) { ctx.save(); ctx.filter = 'blur(28px) brightness(45%)'; const k = Math.max(W / bmp.width, H / bmp.height) * 1.1; ctx.drawImage(bmp, (W - bmp.width * k) / 2, (H - bmp.height * k) / 2, bmp.width * k, bmp.height * k); ctx.restore(); } else { ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, W, H); }
        if (!this.parts.has(c.id)) this.parts.set(c.id, makeParticles(itemAnim(it).particles, 3)); drawAnimItem(ctx, this.m, it, bmp, 0, H * 0.05, W, H * 0.9, local, c.dur, this.v.lang || 'es', '#ffffff', this.parts.get(c.id), { dt }); }
    } else {
      const src = c.kind === 'video' ? this.vid.get(c.media) : this.img.get(c.media);
      const sw = src?.videoWidth || src?.width, sh = src?.videoHeight || src?.height;
      if (src && sw) {
        const q = Math.min(1, local / Math.max(0.1, c.dur)); const kb = kbAt(fx.kb, q) || { z: 1 };
        const fit = c.fit || this.v.fit || 'blur';
        if (fit === 'blur' && c.track === 'img') { if (CAN_FILTER) { ctx.save(); ctx.filter = 'blur(30px) brightness(50%)'; const k = Math.max(W / sw, H / sh) * 1.1; ctx.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k); ctx.restore(); } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); } }
        const base = fit === 'cover' || c.track === 'broll' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
        const k = base * (kb.z || 1); const dw = sw * k, dh = sh * k;
        const ox = (W - dw) / 2 + (kb.x || 0) * (dw - W) * -1, oy = (H - dh) / 2 + (kb.y || 0) * (dh - H) * -1;
        if (fxOn(c.cfx) && CAN_FILTER) ctx.filter = `brightness(${c.cfx.b}%) contrast(${c.cfx.c}%) saturate(${c.cfx.s}%)`;
        ctx.drawImage(src, ox, oy, dw, dh); ctx.filter = 'none';
      }
      if (fx.particles && fx.particles !== 'none') { if (!this.parts.has(c.id)) this.parts.set(c.id, makeParticles(fx.particles, 5)); stepDrawParticles(ctx, this.parts.get(c.id), 0, 0, W, H, local, dt); }
    }
    ctx.restore();
  }
  drawText(ctx, W, H, c, t) {
    const local = t - c.start; const st = c.style || {}; const U = W;
    const L = mkLayer(st.kind || 'texto', { x: st.x ?? 0.08, y: st.y ?? 0.12, w: st.w ?? 0.84, h: st.h ?? 0.12 * (W / H) * 1.8, text: c.text || '', fs: (st.fs || 0.075), color: st.color || '#ffffff', stroke: st.stroke || '#000000', fill: st.fill || 'transparent', font: st.font || 'Montserrat', rot: st.rot || 0, bw: st.bw ?? 1.2 });
    const typ = c.anim || 'pop'; const o = {};
    if (typ === 'pop') { o.scale = local < 0.28 ? Math.max(0.01, easeBack(local / 0.28)) : 1; o.alpha = Math.min(1, local / 0.1); }
    else if (typ === 'type') o.text = (c.text || '').slice(0, Math.floor(local * 24)); else if (typ === 'fade') o.alpha = Math.min(1, local / 0.4);
    const out = (c.start + c.dur - t) / 0.25; if (out < 1) o.alpha = (o.alpha ?? 1) * Math.max(0, out);
    drawLayer(ctx, L, 0, 0, U, H, 'es', o);
  }
  drawSubs(ctx, W, H, t) {
    const v = this.v; const S_ = v.subs; if (!S_?.on || !v.words?.length) return;
    const i = v.words.findIndex(w => t >= w.t0 && t < w.t1 + 0.15); if (i < 0) return;
    const n = S_.n || 3; const g0 = Math.floor(i / n) * n; const grp = v.words.slice(g0, g0 + n);
    const size = W * 0.075 * (S_.size || 1) * (W > H ? 0.6 : 1); const y = H * (S_.pos ?? 0.74);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const font = S_.style === 'manhwa' ? `400 ${size * 1.1}px Bangers, sans-serif` : `900 ${size}px Montserrat, Inter, sans-serif`;
    ctx.font = font; const words = grp.map(w => S_.style === 'caja' || S_.style === 'manhwa' || S_.style === 'bold' || S_.style === 'amarillo' ? w.w.toUpperCase() : w.w);
    const widths = words.map(w => ctx.measureText(w + ' ').width); const total = widths.reduce((a, b) => a + b, 0);
    const lines = total > W * 0.9 ? [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))] : [words];
    let idx = 0;
    lines.forEach((ln, li) => {
      const lw = ln.reduce((a, w) => a + ctx.measureText(w + ' ').width, 0); let x = W / 2 - lw / 2; const yy = y + (li - (lines.length - 1) / 2) * size * 1.15;
      if (S_.style === 'caja') { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(x - size * 0.3, yy - size * 0.65, lw + size * 0.4, size * 1.3); }
      for (const w of ln) {
        const ww = ctx.measureText(w + ' ').width; const active = g0 + idx === i; const cx = x + ww / 2 - ctx.measureText(' ').width / 2;
        ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        if (S_.style !== 'caja') { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = size * 0.25; ctx.strokeText(w, cx, yy); ctx.shadowBlur = 0; }
        ctx.fillStyle = (S_.style === 'amarillo' || S_.style === 'manhwa') && active ? '#ffe14d' : '#ffffff';
        if (active && S_.style !== 'caja') { ctx.save(); ctx.translate(cx, yy); ctx.scale(1.08, 1.08); ctx.fillText(w, 0, 0); ctx.restore(); } else ctx.fillText(w, cx, yy);
        x += ww; idx++;
      }
    });
    ctx.restore();
  }
  drawFrame(ctx, W, H, t, dt = 1 / 30) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const main = this.activeAt('img', t); if (main) this.drawVisual(ctx, W, H, main, t, dt);
    const br = this.activeAt('broll', t); if (br) this.drawVisual(ctx, W, H, br, t, dt);
    for (const c of this.v.clips.filter(c => c.track === 'txt' && t >= c.start && t < c.start + c.dur)) this.drawText(ctx, W, H, c, t);
    this.drawSubs(ctx, W, H, t);
  }
  ttsTick(t, prevT) { if (!this.playing) return; for (const c of this.v.clips) if (c.kind === 'tts' && c.start >= prevT && c.start < t) { try { const u = new SpeechSynthesisUtterance(c.text); u.lang = c.lang || 'es-MX'; u.rate = (c.rate || 1) * this.rate; const vs = speechSynthesis.getVoices().filter(x => x.lang.toLowerCase().startsWith((c.lang || 'es').slice(0, 2))); const pick = vs.find(x => guessGender(x) === (c.gender || 'f')) || vs[0]; if (pick) u.voice = pick; speechSynthesis.speak(u); } catch (e) { } } }
}

/* ---------------- Estado del editor ---------------- */
const VED = { eng: null, sel: null, ac: null, src: null, raf: 0, t0: 0, magnet: true, tab: 'notas', noteCat: 'General', noteFilter: 'Todas', wsel: [], undo: [], redo: [], lastSnap: null, vid: null };
function vSnap(v) { const s = JSON.stringify({ clips: v.clips, words: v.words, notes: v.notes, subs: v.subs, tvol: v.tvol, tmute: v.tmute }); if (s === VED.lastSnap) return; if (VED.lastSnap) { VED.undo.push(VED.lastSnap); if (VED.undo.length > 60) VED.undo.shift(); VED.redo = []; } VED.lastSnap = s; }
function vEdit(m, v, fn) { vSnap(v); fn(); v.updatedAt = Date.now(); vSnap(v); touch(m); }
function vRestore(m, v, s) { Object.assign(v, JSON.parse(s)); VED.lastSnap = s; touch(m); render(); }
ACT.vUndo = () => { const m = cur(); const v = vById(m, Route.a); if (!VED.undo.length) return toast('Nada que deshacer'); VED.redo.push(VED.lastSnap); vRestore(m, v, VED.undo.pop()); toast('↶ Deshecho'); };
ACT.vRedo = () => { const m = cur(); const v = vById(m, Route.a); if (!VED.redo.length) return toast('Nada que rehacer'); VED.undo.push(VED.lastSnap); vRestore(m, v, VED.redo.pop()); };

/* ---------------- Lista de proyectos (Modo Redes) ---------------- */
VIEWS.redes = () => {
  const m = cur(); m.videos ||= [];
  return `<div class="head"><div><h1>🎬 Modo Redes · ${esc(m.name)}</h1><p class="muted">Videos para TikTok, Reels y YouTube con tu voz, música, subtítulos y animaciones hechas con código.</p></div>
    <div class="row"><button class="pri big" data-a="vNew">＋ Nuevo video</button><button class="big" data-a="toVideo">📖→🎬 CONVERTIR UN CAPÍTULO A VIDEO</button></div></div>
    ${m.videos.length ? `<div class="cards">${m.videos.map(v => `<div class="card hov" data-a="go" data-to="${mlink(m, 'video', v.id)}"><div class="row between"><h3>${esc(v.name)}</h3><span class="chip">${VFORMATS[v.format]?.[0] || v.format}</span></div><div class="small muted">${fmtT(vDur(v))} · ${plural(v.clips.length, 'clip', 'clips')} · ${plural(v.notes.filter(n => !n.done).length, 'nota pendiente', 'notas pendientes')}</div><div class="small dim">${fmtDate(v.updatedAt)}</div><div class="row" style="margin-top:8px"><button class="sm" data-a="vRename" data-id="${v.id}">✏️</button><button class="sm" data-a="vDup" data-id="${v.id}">⧉ Duplicar</button><button class="sm danger" data-a="vDel" data-id="${v.id}">🗑️</button></div></div>`).join('')}</div>` : '<div class="empty">Aún no tienes videos. Crea uno o convierte un capítulo.</div>'}`;
};
ACT.vNew = async () => { const m = cur(); const n = await promptBox('Nombre del video', 'Video ' + ((m.videos || []).length + 1)); if (!n) return; const v = newVideo(n); (m.videos ||= []).push(v); touch(m); go(mlink(m, 'video', v.id)); };
ACT.vRename = async el => { const m = cur(); const v = vById(m, el.dataset.id); const n = await promptBox('Renombrar video', v.name); if (n) { v.name = n; touch(m); render(); } };
ACT.vDup = el => { const m = cur(); const v = vById(m, el.dataset.id); const d = clone(v); d.id = uid('v_'); d.name += ' (copia)'; d.clips.forEach(c => c.id = uid('cl_')); m.videos.push(d); touch(m); render(); };
ACT.vDel = async el => { const m = cur(); const v = vById(m, el.dataset.id); if (!await confirmBox(`¿Seguro que quieres borrar el video “${esc(v.name)}”? (los archivos quedan en tu biblioteca)`)) return; m.videos = m.videos.filter(x => x !== v); touch(m); render(); };
/* capítulo → video */
ACT.toVideo = async () => {
  const m = cur(); let c = Route.view === 'armador' ? chapterById(m, Route.a) : null;
  if (!c) { const list = chapterList(m).filter(x => x.layout?.items?.length); if (!list.length) return toast('Ningún capítulo tiene paneles en el Editor de Manhwa todavía', 'err'); const id = await choiceBox('📖→🎬 ¿Qué capítulo?', 'Elige el capítulo a convertir en video.', list.slice(-4).map(x => ({ label: `Cap ${x.number}`, value: x.id }))); if (!id) return; c = chapterById(m, id); }
  const music = await choiceBox('🎵 Música', 'Elige la música (hecha con código, la puedes cambiar después).', [{ label: 'Sin música', value: 'none' }, ...Object.entries(MUSIC_STYLES).slice(0, 3).map(([k, v]) => ({ label: v, value: k, cls: k === 'epica' ? 'pri' : '' }))]);
  if (music == null) return;
  const v = newVideo(`Cap ${c.number} · ${c.title || ''}`.trim()); v.lang = BSEL.lang || 'es';
  let t = 0;
  for (const it of c.layout.items) {
    const dur = itemDuration(it, v.lang);
    v.clips.push({ id: uid('cl_'), track: 'img', kind: 'manhwa', chap: c.id, item: it.id, name: `Panel ${c.layout.items.indexOf(it) + 1}`, start: t, dur, in: 0, fx: {} });
    for (const { L, t0 } of layerTimes(it, v.lang)) if (L.kind === 'sfx') v.clips.push({ id: uid('cl_'), track: 'fx', kind: 'synthSfx', sfx: sfxForText(layerText(L, v.lang)), name: layerText(L, v.lang), start: t + t0, dur: 1, in: 0, vol: -4 });
    if (itemAnim(it).shake) v.clips.push({ id: uid('cl_'), track: 'fx', kind: 'synthSfx', sfx: 'boom', name: 'Boom', start: t, dur: 1.4, in: 0, vol: -3 });
    t += dur;
  }
  if (music !== 'none') v.clips.push({ id: uid('cl_'), track: 'mus1', kind: 'synthMusic', style: music, name: MUSIC_STYLES[music], start: 0, dur: t, in: 0, vol: -8, fadeIn: 0.5, fadeOut: 2 });
  (m.videos ||= []).push(v); touch(m); S.mode = 'redes'; go(mlink(m, 'video', v.id)); toast(`Capítulo convertido: ${plural(c.layout.items.length, 'panel', 'paneles')}, ${fmtT(t)} 🎬`, 'ok');
};

/* ---------------- Vista del editor de video ---------------- */
VIEWS.video = () => {
  const m = cur(); const v = vById(m, Route.a); if (!v) return '<div class="empty">Video no encontrado.</div>';
  if (VED.vid !== v.id) { VED.vid = v.id; VED.undo = []; VED.redo = []; VED.lastSnap = null; VED.sel = null; VED.wsel = []; vStop(); VED.eng = null; VED.lastT = 0; }
  vSnap(v);
  const [fname, FW, FH] = VFORMATS[v.format] || VFORMATS.tiktok; const sel = v.clips.find(c => c.id === VED.sel);
  const notes = v.notes; const pend = notes.filter(n => !n.done).length;
  return `<div class="ved">
  <div class="row between" style="margin-bottom:10px"><div class="row"><button class="sm" data-a="go" data-to="${mlink(m, 'redes')}">← Videos</button><h2>${esc(v.name)}</h2></div>
    <div class="row"><select data-change="vFormat" style="width:auto">${Object.entries(VFORMATS).map(([k, x]) => `<option value="${k}" ${v.format === k ? 'selected' : ''}>${x[0]} ${x[1]}×${x[2]}</option>`).join('')}</select>
    <select data-change="vFit" style="width:auto"><option value="blur" ${v.fit === 'blur' ? 'selected' : ''}>Ajustar + fondo desenfocado</option><option value="cover" ${v.fit === 'cover' ? 'selected' : ''}>Rellenar (recorta)</option></select></div></div>
  ${cmdBarHTML('video')}
  <div class="ved-top">
    <div class="ved-prev"><div class="vp-wrap ${FW > FH ? 'wide' : ''}"><canvas id="vpC" width="${FW / 2}" height="${FH / 2}"></canvas>
      <div class="vp-ctl"><button class="vp-play" data-a="vPlay" id="vpPlay">▶</button><span id="vpTime" class="mono">0:00 / ${fmtT(vDur(v))}</span><input id="vpSeek" type="range" min="0" max="${vDur(v)}" step="0.01" value="0" class="grow"><button class="sm icon ghost" data-a="vFull">⛶</button></div></div>
      <div class="row" style="margin-top:8px"><button class="sm ${VED.tab === 'notas' ? 'yel' : ''}" data-a="vTab" data-t="notas">Notas y pistas</button><button class="sm ${VED.tab === 'trans' ? 'yel' : ''}" data-a="vTab" data-t="trans">Transcripción</button>
        <span class="small muted" style="margin-left:8px">Velocidad:</span>${[1, 1.25, 1.5, 2].map(r => `<button class="sm ${(VED.rate || 1) === r ? 'yel' : ''}" data-a="vRate" data-r="${r}">${r}x</button>`).join('')}
        <span class="grow"></span><span class="small mono" id="vpAt"></span></div>
    </div>
    <div class="ved-notes panelbox">${VED.tab === 'trans' ? transcriptHTML(v) : notesHTML(v, pend)}</div>
  </div>
  <div class="ved-tl panelbox">
    <div class="row tl-tools"><b class="mono yelt" id="tlTime">0:00.00</b>
      <button class="sm" data-a="vCut" title="Cortar (S)">✂ Cortar <span class="kbd">S</span></button><button class="sm" data-a="vDupClip">Duplicar</button><button class="sm" data-a="vDelClip">Borrar ⌫</button>
      <select class="sm-sel" data-change="vAddSong"><option value="">＋ Agregar canción…</option><optgroup label="Hecha con código">${Object.entries(MUSIC_STYLES).map(([k, x]) => `<option value="syn:${k}">${x}</option>`).join('')}</optgroup><optgroup label="Tus canciones">${Object.values(m.media || {}).filter(x => x.type === 'audio' && x.kind === 'song').map(x => `<option value="md:${x.id}">${esc(x.name)}</option>`).join('')}</optgroup></select>
      <button class="sm" data-a="vAddTake">＋ Agregar toma</button><button class="sm" data-a="vAddBroll">＋ B-roll</button><button class="sm" data-a="vUpSong">Subir canción</button>
      <select class="sm-sel" data-change="vAddSfx"><option value="">＋ Agregar sonido…</option><optgroup label="Hechos con código">${Object.entries(SFX_TYPES).map(([k, x]) => `<option value="syn:${k}">${x}</option>`).join('')}</optgroup><optgroup label="Tus sonidos">${Object.values(m.media || {}).filter(x => x.type === 'audio' && x.kind === 'sfx').map(x => `<option value="md:${x.id}">${esc(x.name)}</option>`).join('')}</optgroup></select>
      <button class="sm" data-a="vUpSfx">Subir sonido</button>
      <button class="sm icon" data-a="vUndo" title="Deshacer">↶</button><button class="sm icon" data-a="vRedo" title="Rehacer">↷</button>
      <label class="row nw small"><input type="checkbox" data-change="vMagnet" ${VED.magnet ? 'checked' : ''}> Imán</label>
      <button class="sm icon" data-a="vZoom" data-z="0.75">−</button><button class="sm" data-a="vZoomFit">Ajustar</button><button class="sm icon" data-a="vZoom" data-z="1.33">＋</button>
      <button class="sm" data-a="vSave">Guardar</button><button class="sm" data-a="vSendClaude">Enviar a Claude</button></div>
    <div class="row tl-tools"><button class="sm pri" data-a="vRecord" id="recBtn">🎙️ GRABAR MI VOZ</button><button class="sm" data-a="vTTS">🗣️ VOZ DEL NAVEGADOR</button><button class="sm" data-a="vUpVoice">📤 SUBIR MI AUDIO</button><button class="sm" data-a="vSilence">🔇 QUITAR SILENCIOS</button><button class="sm" data-a="vAddText">＋ Texto</button>
      <button class="sm ${v.subs.on ? 'yel' : ''}" data-a="vSubs">💬 Subtítulos ${v.subs.on ? 'ON' : 'OFF'}</button>${v.subs.on ? `<select class="sm-sel" data-change="vSubStyle">${Object.entries(SUB_STYLES).map(([k, x]) => `<option value="${k}" ${v.subs.style === k ? 'selected' : ''}>${x}</option>`).join('')}</select>` : ''}
      <span class="grow"></span><span class="small muted">Exportar:</span><button class="sm pri" data-a="vExport" data-f="tiktok">TIKTOK 1080×1920</button><button class="sm pri" data-a="vExport" data-f="reels">REELS</button><button class="sm pri" data-a="vExport" data-f="youtube">YOUTUBE 1920×1080</button></div>
    <div id="inspector">${sel ? inspectorHTML(m, v, sel) : '<div class="small muted" style="padding:8px 2px">Toca un clip para ver sus opciones. Arrastra para moverlo, jala los bordes para recortarlo.</div>'}</div>
    <div class="tl" id="tl"></div>
  </div></div>`;
};
function notesHTML(v, pend) {
  const t = VED.eng?.t || 0; const under = v.clips.filter(c => t >= c.start && t < c.start + c.dur && c.track === 'img')[0];
  const list = v.notes.filter(n => VED.noteFilter === 'Todas' || n.cat === VED.noteFilter).sort((a, b) => a.t - b.t);
  return `<div class="row between"><h2>Notas</h2><span class="small muted">${pend} pendientes · ${v.notes.length} en total</span></div>
    <div class="row nw between small"><span>Nota en <b class="yelt" id="noteAt">${fmtT(t)}</b> · <span class="muted">${esc(under?.name || '')}</span></span><select id="noteCat" style="width:auto;min-height:36px;padding:4px 8px">${NOTE_CATS.map(c => `<option ${VED.noteCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <textarea id="noteTx" style="min-height:70px" placeholder="Escribe tu nota…"></textarea>
    <div class="row"><button class="yelb" data-a="vNoteAdd">Agregar nota</button><button data-a="vNoteRef">📎 Adjuntar referencia</button></div>
    <div class="row">${['Todas', ...NOTE_CATS].map(c => `<button class="sm chipb ${VED.noteFilter === c ? 'on' : ''}" data-a="vNoteFilter" data-c="${c}">${c}</button>`).join('')}</div>
    <div class="col" style="gap:8px;max-height:300px;overflow:auto">${list.map(n => `<div class="note ${n.done ? 'done' : ''}"><button class="sm yelt mono ghost" data-a="vSeekTo" data-t="${n.t}">${fmtT(n.t)}</button><div class="grow small"><b>${esc(n.cat)}</b> — ${esc(n.text)}${n.ref ? `<div class="thumb" style="width:60px;height:40px;margin-top:4px" data-img="${n.ref}"></div>` : ''}</div><div class="col" style="gap:4px;align-items:flex-end"><label class="row nw tiny"><input type="checkbox" data-change="vNoteDone" data-id="${n.id}" ${n.done ? 'checked' : ''}> Hecho</label><button class="sm ghost" data-a="vNoteEdit" data-id="${n.id}">Editar</button><button class="sm ghost danger" data-a="vNoteDel" data-id="${n.id}">✕</button></div></div>`).join('') || '<p class="small muted">Sin notas.</p>'}</div>`;
}
function transcriptHTML(v) {
  const W = v.words || [];
  const lines = []; for (let i = 0; i < W.length; i += 10) lines.push(W.slice(i, i + 10).map((w, j) => ({ ...w, i: i + j })));
  return `<div class="row between"><h2>Transcripción</h2><span class="small muted">${W.length} palabras</span></div>
    <p class="tiny dim">Toca una palabra para ir ahí. Selecciona varias (toca la primera y Shift+toca la última, o mantén) y bórralas: se corta ese pedazo del video. Doble toque para corregir sin cortar.</p>
    <div class="row"><button class="sm danger" data-a="vWordsCut" ${VED.wsel.length ? '' : 'disabled'}>✂️ Borrar del video (${VED.wsel.length})</button><button class="sm" data-a="vWordEdit" ${VED.wsel.length === 1 ? '' : 'disabled'}>✏️ Corregir palabra</button><button class="sm" data-a="vAlign">📝 Pegar texto y alinear</button>${W.length ? '<button class="sm ghost danger" data-a="vWordsClear">Borrar transcripción</button>' : ''}</div>
    <div class="trans">${lines.map(l => `<div class="tline"><span class="tt mono" data-a="vSeekTo" data-t="${l[0].t0}">${fmtT(l[0].t0)}</span><span>${l.map(w => `<span class="w ${VED.wsel.includes(w.i) ? 'on' : ''}" data-wi="${w.i}">${esc(w.w)}</span>`).join(' ')}</span></div>`).join('') || '<div class="empty small">Graba tu voz (se transcribe sola mientras hablas) o pega tu texto y lo alineo a tu audio.</div>'}</div>`;
}
function inspectorHTML(m, v, c) {
  const isA = trackType(c.track) === 'audio' || c.kind === 'video'; const fx = (c.fx ||= {});
  const src = c.kind === 'synthMusic' ? MUSIC_STYLES[c.style] + ' (código)' : c.kind === 'synthSfx' ? SFX_TYPES[c.sfx] + ' (código)' : c.kind === 'manhwa' ? 'Panel de manhwa' : c.kind === 'tts' ? 'Voz del navegador (solo vista previa)' : (m.media?.[c.media]?.name || c.name || '');
  return `<div class="insp row"><b>${esc(c.name || src)}</b><span class="small muted">${fmtT(c.start)} → ${fmtT(c.start + c.dur)}${c.in ? ` · desde el ${fmtT(c.in)} del archivo` : ''}</span>
    ${isA && c.kind !== 'tts' ? `<span class="small">Volumen</span><input type="range" min="-60" max="12" step="0.5" value="${c.vol || 0}" data-ci="vol" style="width:140px"><input type="number" step="0.5" value="${c.vol || 0}" data-ci="vol" style="width:80px;min-height:34px"> <span class="small">dB</span>
      <span class="small">Fade in</span><input type="number" min="0" step="0.1" value="${c.fadeIn || 0}" data-ci="fadeIn" style="width:70px;min-height:34px"><span class="small">s</span><span class="small">Fade out</span><input type="number" min="0" step="0.1" value="${c.fadeOut || 0}" data-ci="fadeOut" style="width:70px;min-height:34px"><span class="small">s</span>` : ''}
    ${['img', 'broll'].includes(c.track) && c.kind !== 'manhwa' ? `<select data-cf="kb" class="sm-sel">${Object.entries(KBS).map(([k, x]) => `<option value="${k}" ${(fx.kb || 'none') === k ? 'selected' : ''}>${x}</option>`).join('')}</select>` : ''}
    ${['img', 'broll'].includes(c.track) ? `<select data-cf="enter" class="sm-sel">${Object.entries(ENTERS).map(([k, x]) => `<option value="${k}" ${(fx.enter || 'none') === k ? 'selected' : ''}>Entrada: ${x}</option>`).join('')}</select><select data-cf="particles" class="sm-sel">${Object.entries(PARTS).map(([k, x]) => `<option value="${k}" ${(fx.particles || 'none') === k ? 'selected' : ''}>${x}</option>`).join('')}</select><label class="row nw small"><input type="checkbox" data-cfc="shake" ${fx.shake ? 'checked' : ''}> Temblor</label>${c.kind === 'image' ? `<span class="small">Duración</span><input type="number" min="0.3" step="0.1" value="${c.dur.toFixed(1)}" data-ci="dur" style="width:80px;min-height:34px">` : ''}` : ''}
    ${c.track === 'txt' ? `<input data-ct="text" value="${esc(c.text || '')}" style="width:260px;min-height:34px"><select data-ct="anim" class="sm-sel">${[['pop', 'POP'], ['type', 'Letra por letra'], ['fade', 'Aparecer'], ['none', 'Sin animación']].map(([k, x]) => `<option value="${k}" ${(c.anim || 'pop') === k ? 'selected' : ''}>${x}</option>`).join('')}</select><select data-cs="font" class="sm-sel">${Object.entries(FONTS).filter(([k]) => k !== 'auto').map(([k, x]) => `<option value="${k}" ${(c.style?.font || 'Montserrat') === k ? 'selected' : ''}>${x}</option>`).join('')}</select><input type="color" data-cs="color" value="${c.style?.color || '#ffffff'}"><span class="small">Alto</span><input type="range" min="0" max="0.85" step="0.01" data-cs="y" value="${c.style?.y ?? 0.12}" style="width:110px"><span class="small">Tamaño</span><input type="range" min="0.03" max="0.16" step="0.005" data-cs="fs" value="${c.style?.fs || 0.075}" style="width:110px"><span class="small">Duración</span><input type="number" min="0.3" step="0.1" value="${c.dur.toFixed(1)}" data-ci="dur" style="width:80px;min-height:34px">` : ''}
    ${c.kind === 'tts' ? `<input data-ct="text" value="${esc(c.text || '')}" style="width:300px;min-height:34px"><span class="chip warn">Solo se oye en la vista previa</span>` : ''}
    <button class="sm" data-a="vNoteHere">Comentar aquí</button></div>`;
}
/* ---------------- Timeline (DOM) ---------------- */
function drawTimeline() {
  const m = cur(); const v = vById(m, Route.a); const el = $('#tl'); if (!el || !v) return;
  const pps = v.zoom || 40; const dur = vDur(v) + 10; const Wpx = Math.max(dur * pps, el.clientWidth - 140);
  const tick = pps >= 80 ? 1 : pps >= 30 ? 5 : pps >= 12 ? 10 : 30;
  let ruler = ''; for (let s = 0; s <= dur; s += tick) ruler += `<span class="tk" style="left:${s * pps}px">${fmtT(s)}</span>`;
  const markers = v.notes.map(n => `<span class="nmk" style="left:${n.t * pps}px" title="${esc(n.text)}"></span>`).join('');
  const rows = VTRACKS.map(([id, name, type]) => {
    const clips = v.clips.filter(c => c.track === id).map(c => {
      const label = esc(c.name || (c.kind === 'synthMusic' ? MUSIC_STYLES[c.style] : c.kind === 'synthSfx' ? SFX_TYPES[c.sfx] : c.text || m.media?.[c.media]?.name || ''));
      return `<div class="clip k-${type} ${c.kind} ${VED.sel === c.id ? 'on' : ''}" data-cid="${c.id}" style="left:${c.start * pps}px;width:${Math.max(4, c.dur * pps)}px">${type === 'audio' || c.kind === 'video' ? `<canvas class="wf" data-wf="${c.id}"></canvas>` : ''}${c.kind === 'manhwa' || c.kind === 'image' ? `<div class="cthumb" ${c.kind === 'image' ? `data-img="${c.media}"` : `data-img="${chapterById(m, c.chap)?.layout?.items.find(i => i.id === c.item)?.imgId || ''}"`}></div>` : ''}<span class="cl">${label}</span><i class="eh l"></i><i class="eh r"></i></div>`;
    }).join('');
    return `<div class="tl-row" data-track="${id}">${clips}</div>`;
  }).join('');
  const heads = VTRACKS.map(([id, name, type]) => `<div class="tl-h"><span>${name}</span>${type !== 'visual' && type !== 'text' ? `<button class="sm icon ghost ${v.tmute?.[id] ? 'muted' : ''}" data-a="vMute" data-t="${id}" title="Silenciar">M</button><input type="range" min="0" max="1.5" step="0.05" value="${v.tvol?.[id] ?? 1}" data-tv="${id}" style="width:56px;min-height:20px">` : ''}</div>`).join('');
  el.innerHTML = `<div class="tl-heads"><div class="tl-h ruler-h"></div>${heads}</div><div class="tl-scroll" id="tlScroll"><div class="tl-inner" style="width:${Wpx}px"><div class="tl-ruler" id="tlRuler">${ruler}${markers}</div>${rows}<div class="playhead" id="ph"><i></i></div></div></div>`;
  hydrateImages(el);
  // formas de onda
  $$('canvas[data-wf]', el).forEach(async cv => { const c = v.clips.find(x => x.id === cv.dataset.wf); if (!c) return; await audioBufFor(m, c); const P = PEAKS.get(peaksKey(c)); if (!P) return; const w = Math.max(4, Math.round(c.dur * pps)), h = 26; cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < w; i++) { const tt = (c.in || 0) + i / pps; const k = Math.floor(tt / P.step); const a = P.pk[k] || 0; const hh = Math.max(1, a * h); x.fillRect(i, (h - hh) / 2, 1, hh); } });
  placePlayhead();
  bindTimeline(m, v);
}
function placePlayhead() { const m = cur(); const v = vById(m, Route.a); const ph = $('#ph'); if (!ph || !v) return; const t = VED.eng?.t || 0; ph.style.left = (t * (v.zoom || 40)) + 'px'; const tt = $('#tlTime'); if (tt) tt.textContent = fmtT(t, true); }
function snapT(v, t, exclude) {
  if (!VED.magnet) return t; const pps = v.zoom || 40; const th = 8 / pps; let best = t, bd = th;
  const pts = [0, VED.eng?.t || 0]; v.clips.forEach(c => { if (c.id !== exclude) pts.push(c.start, c.start + c.dur); });
  for (const p of pts) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } } return best;
}
function srcLen(m, c) { if (c.kind === 'video' || c.kind === 'audio') return (m.media?.[c.media]?.dur || 9999); if (c.kind === 'synthSfx') return 3; return 99999; }
function bindTimeline(m, v) {
  const sc = $('#tlScroll'); if (!sc) return; const pps = () => v.zoom || 40;
  const toT = e => { const r = sc.getBoundingClientRect(); return Math.max(0, (e.clientX - r.left + sc.scrollLeft) / pps()); };
  $('#tlRuler').addEventListener('pointerdown', e => { e.preventDefault(); const mv = ev => vSeek(toT(ev)); mv(e); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); });
  $$('.tl-row', sc).forEach(row => row.addEventListener('pointerdown', e => { if (e.target === row) { VED.sel = null; vSeek(toT(e)); refreshInspector(); $$('.clip.on').forEach(x => x.classList.remove('on')); } }));
  $$('.clip', sc).forEach(el => el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    const c = v.clips.find(x => x.id === el.dataset.cid); if (!c) return;
    if (VED.sel !== c.id) { VED.sel = c.id; $$('.clip.on').forEach(x => x.classList.remove('on')); el.classList.add('on'); refreshInspector(); }
    const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move';
    const sx = e.clientX; const o = { start: c.start, dur: c.dur, in: c.in || 0, track: c.track }; let moved = false;
    vSnap(v); el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const d = (ev.clientX - sx) / pps(); if (Math.abs(ev.clientX - sx) > 3) moved = true; if (!moved) return;
      if (mode === 'move') {
        c.start = Math.max(0, snapT(v, o.start + d, c.id)); const end = snapT(v, c.start + c.dur, c.id); if (end !== c.start + c.dur) c.start = Math.max(0, end - c.dur);
        const rowEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-row'); const tr = rowEl?.dataset.track;
        if (tr && tr !== c.track && trackType(tr) === trackType(o.track) || (tr && ((o.track === 'img' && tr === 'broll') || (o.track === 'broll' && tr === 'img')))) { if (tr !== c.track) { c.track = tr; rowEl.appendChild(el); } }
      } else if (mode === 'l') {
        let ns = snapT(v, o.start + d, c.id); ns = Math.max(0, Math.min(o.start + o.dur - 0.1, ns)); let nin = o.in + (ns - o.start); if (nin < 0) { ns -= nin; nin = 0; }
        c.start = ns; c.in = nin; c.dur = o.dur - (ns - o.start);
      } else { let ne = snapT(v, o.start + o.dur + d, c.id); c.dur = Math.max(0.1, Math.min(srcLen(m, c) - (c.in || 0), ne - c.start)); }
      el.style.left = c.start * pps() + 'px'; el.style.width = Math.max(4, c.dur * pps()) + 'px';
    };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); if (moved) { v.updatedAt = Date.now(); vSnap(v); touch(m); drawTimeline(); refreshInspector(); vRedraw(); } else vSeek(toT(e)); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  }));
  $$('[data-tv]').forEach(r => r.addEventListener('change', () => { vEdit(m, v, () => { v.tvol[r.dataset.tv] = +r.value; }); }));
  sc.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); v.zoom = Math.min(300, Math.max(4, (v.zoom || 40) * (e.deltaY < 0 ? 1.15 : 0.87))); drawTimeline(); } }, { passive: false });
}
function refreshInspector() { const m = cur(); const v = vById(m, Route.a); const el = $('#inspector'); if (!el) return; const c = v.clips.find(x => x.id === VED.sel); el.innerHTML = c ? inspectorHTML(m, v, c) : '<div class="small muted" style="padding:8px 2px">Toca un clip para ver sus opciones.</div>'; bindInspector(m, v); }
function bindInspector(m, v) {
  const c = v.clips.find(x => x.id === VED.sel); if (!c) return;
  $$('#inspector [data-ci]').forEach(i => i.addEventListener('change', () => { vEdit(m, v, () => { c[i.dataset.ci] = Math.max(i.dataset.ci === 'vol' ? -60 : 0, +i.value); if (i.dataset.ci === 'dur') c.dur = Math.max(0.3, Math.min(srcLen(m, c) - (c.in || 0), c.dur)); }); $$(`#inspector [data-ci="${i.dataset.ci}"]`).forEach(x => x !== i && (x.value = i.value)); drawTimeline(); vRedraw(); }));
  $$('#inspector [data-cf]').forEach(i => i.addEventListener('change', () => { vEdit(m, v, () => { (c.fx ||= {})[i.dataset.cf] = i.value; }); VED.eng?.parts.delete(c.id); vRedraw(); }));
  $$('#inspector [data-cfc]').forEach(i => i.addEventListener('change', () => { vEdit(m, v, () => { (c.fx ||= {})[i.dataset.cfc] = i.checked; }); vRedraw(); }));
  $$('#inspector [data-ct]').forEach(i => i.addEventListener('input', () => { c[i.dataset.ct] = i.value; touch(m); vRedraw(); })); $$('#inspector [data-ct]').forEach(i => i.addEventListener('change', () => { vSnap(v); drawTimeline(); }));
  $$('#inspector [data-cs]').forEach(i => i.addEventListener('input', () => { (c.style ||= {})[i.dataset.cs] = i.type === 'range' ? +i.value : i.value; touch(m); vRedraw(); })); $$('#inspector [data-cs]').forEach(i => i.addEventListener('change', () => vSnap(v)));
}
/* ---------------- Reproducción ---------------- */
async function vEngine() { const m = cur(); const v = vById(m, Route.a); if (!VED.eng || VED.eng.v !== v) { const t = VED.eng?.t ?? VED.lastT ?? 0; VED.eng = new VEngine(m, v); VED.eng.t = Math.min(t, vDur(v)); VED.eng.rate = VED.rate || 1; await VED.eng.prepare(); } return VED.eng; }
function vCanvas() { return $('#vpC'); }
function vRedraw() { const e = VED.eng; const cv = vCanvas(); if (!e || !cv) return; e.syncVideos(e.t, e.playing); e.drawFrame(cv.getContext('2d'), cv.width, cv.height, e.t, 0); updTime(); }
const vRedrawSoon = debounce(vRedraw, 40);
function updTime() { const e = VED.eng; if (e) VED.lastT = e.t; const m = cur(); const v = vById(m, Route.a); if (!e || !v) return; const d = vDur(v); const a = $('#vpTime'); if (a) a.textContent = fmtT(e.t) + ' / ' + fmtT(d); const s = $('#vpSeek'); if (s) { s.max = d; s.value = e.t; } const na = $('#noteAt'); if (na) na.textContent = fmtT(e.t); placePlayhead(); const at = $('#vpAt'); if (at) at.textContent = fmtT(e.t, true); }
async function vSeek(t) { const e = await vEngine(); const was = e.playing; if (was) vStop(); e.t = Math.max(0, t); e.parts.clear(); vRedraw(); setTimeout(vRedraw, 120); if (was) vPlay(); }
function vStop() { const e = VED.eng; if (!e) return; e.playing = false; cancelAnimationFrame(VED.raf); try { VED.src?.stop(); } catch (er) { } try { VED.ac?.close(); } catch (er) { } VED.ac = null; VED.src = null; try { speechSynthesis.cancel(); } catch (er) { } e.syncVideos(e.t, false); const b = $('#vpPlay'); if (b) b.textContent = '▶'; }
async function vPlay() {
  const m = cur(); const v = vById(m, Route.a); const e = await vEngine(); if (e.playing) return;
  if (e.t >= vDur(v) - 0.05) e.t = 0;
  const b = $('#vpPlay'); if (b) b.textContent = '⏳';
  let mix = null; try { mix = await e.ensureMix(); } catch (er) { console.warn(er); }
  VED.ac = new AudioContext(); if (mix) { VED.src = VED.ac.createBufferSource(); VED.src.buffer = mix; VED.src.playbackRate.value = e.rate; VED.src.connect(VED.ac.destination); }
  e.playing = true; if (b) b.textContent = '⏸';
  const startT = e.t; VED.t0 = VED.ac.currentTime + 0.05; if (VED.src) VED.src.start(VED.t0, startT);
  let prev = startT;
  const loop = () => {
    if (!e.playing) return; const t = startT + Math.max(0, VED.ac.currentTime - VED.t0) * e.rate; e.t = t;
    e.syncVideos(t, true); e.ttsTick(t, prev); const cv = vCanvas(); if (cv) e.drawFrame(cv.getContext('2d'), cv.width, cv.height, t, t - prev); prev = t; updTime();
    if (t >= vDur(v)) { e.t = vDur(v); vStop(); return; }
    VED.raf = requestAnimationFrame(loop);
  };
  loop();
}
ACT.vPlay = async () => { const e = await vEngine(); e.playing ? vStop() : vPlay(); };
ACT.vRate = async el => { const e = await vEngine(); const was = e.playing; vStop(); e.rate = VED.rate = +el.dataset.r; rerenderVideo(); if (was) vPlay(); };
ACT.vFull = () => { const w = $('.vp-wrap'); try { (w.requestFullscreen || w.webkitRequestFullscreen).call(w); } catch (e) { } };
ACT.vSeekTo = el => vSeek(+el.dataset.t);
ACT.vTab = el => { VED.tab = el.dataset.t; render(); };
AFTER.video = async () => {
  const m = cur(); const v = vById(m, Route.a); if (!v) return;
  drawTimeline(); bindInspector(m, v); bindCmdBar('video'); bindTranscript(m, v);
  const e = await vEngine(); e.v = v; vRedraw(); setTimeout(vRedraw, 300);
  $('#vpSeek').oninput = ev => vSeek(+ev.target.value);
  $('#noteCat') && ($('#noteCat').onchange = ev => VED.noteCat = ev.target.value);
};
document.addEventListener('keydown', e => {
  if (Route.view !== 'video' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if (e.code === 'Space') { e.preventDefault(); ACT.vPlay(); }
  else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); ACT.vCut(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); if (VED.tab === 'trans' && VED.wsel.length) ACT.vWordsCut(); else ACT.vDelClip(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ACT.vRedo() : ACT.vUndo(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); vSeek((VED.eng?.t || 0) - (e.shiftKey ? 5 : 1 / 30)); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); vSeek((VED.eng?.t || 0) + (e.shiftKey ? 5 : 1 / 30)); }
});
/* ---------------- Edición ---------------- */
function curV() { const m = cur(); return [m, vById(m, Route.a)]; }
function rerenderVideo() { const e = VED.eng; render(); if (e) VED.eng = e; }
ACT.vFormat = el => { const [m, v] = curV(); vEdit(m, v, () => v.format = el.value); rerenderVideo(); };
ACT.vFit = el => { const [m, v] = curV(); vEdit(m, v, () => v.fit = el.value); vRedraw(); };
ACT.vMagnet = el => { VED.magnet = el.checked; };
ACT.vZoom = el => { const [m, v] = curV(); v.zoom = Math.min(300, Math.max(4, (v.zoom || 40) * +el.dataset.z)); drawTimeline(); };
ACT.vZoomFit = () => { const [m, v] = curV(); const w = ($('#tlScroll')?.clientWidth || 800) - 20; v.zoom = Math.max(4, w / vDur(v)); drawTimeline(); };
ACT.vSave = async el => { const [m] = curV(); await busy(el, async () => { touch(m); if (S.user) await pushDirty(); toast(S.user ? 'Video guardado en tu nube ☁️' : 'Guardado en este dispositivo', 'ok'); }, 'Guardando…'); };
function cutAt(v, c, t) { if (t <= c.start + 0.05 || t >= c.start + c.dur - 0.05) return null; const d = clone(c); d.id = uid('cl_'); const cut = t - c.start; c.dur = cut; c.fadeOut = 0; d.start = t; d.in = (c.in || 0) + cut; d.dur -= cut; d.fadeIn = 0; v.clips.push(d); return d; }
ACT.vCut = () => { const [m, v] = curV(); const t = VED.eng?.t || 0; const targets = VED.sel ? v.clips.filter(c => c.id === VED.sel) : v.clips.filter(c => t > c.start && t < c.start + c.dur); let n = 0; vEdit(m, v, () => targets.forEach(c => { if (cutAt(v, c, t)) n++; })); drawTimeline(); toast(n ? `✂ Cortado en ${fmtT(t, true)}` : 'Pon la línea roja sobre un clip para cortarlo'); };
ACT.vDupClip = () => { const [m, v] = curV(); const c = v.clips.find(x => x.id === VED.sel); if (!c) return toast('Selecciona un clip'); const d = { ...clone(c), id: uid('cl_'), start: c.start + c.dur }; vEdit(m, v, () => v.clips.push(d)); VED.sel = d.id; drawTimeline(); refreshInspector(); };
ACT.vDelClip = () => { const [m, v] = curV(); if (!VED.sel) return; vEdit(m, v, () => v.clips = v.clips.filter(c => c.id !== VED.sel)); VED.sel = null; drawTimeline(); refreshInspector(); vRedraw(); };
ACT.vMute = el => { const [m, v] = curV(); vEdit(m, v, () => v.tmute[el.dataset.t] = !v.tmute[el.dataset.t]); drawTimeline(); };
function freeTrack(v, cands, start, dur) { for (const t of cands) if (!v.clips.some(c => c.track === t && c.start < start + dur && c.start + c.dur > start)) return t; return cands[0]; }
async function addClipsFromFiles(m, v, files, track, kind = null) {
  if (!files.length) return; toast(`Cargando ${plural(files.length, 'archivo', 'archivos')}…`); vSnap(v);
  let t = track === 'img' ? (v.clips.filter(c => c.track === 'img').reduce((a, c) => Math.max(a, c.start + c.dur), 0)) : (VED.eng?.t || 0);
  for (const f of files) {
    const md = await addMedia(m, f, kind ? { kind } : {});
    const dur = md.type === 'image' ? 3 : (md.dur || 3);
    const tr = md.type === 'audio' ? (track === 'mus' ? freeTrack(v, ['mus1', 'mus2'], t, dur) : track) : track;
    v.clips.push({ id: uid('cl_'), track: tr, kind: md.type === 'image' ? 'image' : md.type, media: md.id, name: md.name, start: t, dur, in: 0, vol: md.type === 'audio' && tr.startsWith('mus') ? -8 : 0, fx: md.type === 'image' ? { kb: 'in', enter: 'fade' } : {} });
    if (track === 'img') t += dur;
  }
  v.updatedAt = Date.now(); vSnap(v); touch(m); VED.eng = null; rerenderVideo();
}
ACT.vAddTake = async () => { const [m, v] = curV(); await addClipsFromFiles(m, v, await pickFiles({ accept: 'video/*,image/*' }), 'img'); };
ACT.vAddBroll = async () => { const [m, v] = curV(); await addClipsFromFiles(m, v, await pickFiles({ accept: 'video/*,image/*' }), 'broll'); };
ACT.vUpSong = async () => { const [m, v] = curV(); await addClipsFromFiles(m, v, await pickFiles({ accept: 'audio/*' }), 'mus', 'song'); };
ACT.vUpSfx = async () => { const [m, v] = curV(); await addClipsFromFiles(m, v, await pickFiles({ accept: 'audio/*' }), 'fx', 'sfx'); };
ACT.vUpVoice = async () => { const [m, v] = curV(); await addClipsFromFiles(m, v, await pickFiles({ accept: 'audio/*,video/*' }), 'voz', 'voice'); };
function addSong(m, v, val, start = null, end = null) {
  const t = start ?? 0; const dur = Math.max(1, (end ?? vDur(v)) - t);
  let c; if (val.startsWith('syn:')) { const st = val.slice(4); c = { id: uid('cl_'), kind: 'synthMusic', style: st, name: MUSIC_STYLES[st], start: t, dur, in: 0, vol: -8, fadeIn: 0.5, fadeOut: 1.5 }; }
  else { const md = m.media[val.slice(3)]; c = { id: uid('cl_'), kind: 'audio', media: md.id, name: md.name, start: t, dur: Math.min(dur, md.dur || dur), in: 0, vol: -8, fadeIn: 0.5, fadeOut: 1.5 }; }
  c.track = freeTrack(v, ['mus1', 'mus2'], c.start, c.dur); v.clips.push(c); return c;
}
ACT.vAddSong = el => { const [m, v] = curV(); if (!el.value) return; vEdit(m, v, () => addSong(m, v, el.value, VED.eng?.t || 0)); el.value = ''; drawTimeline(); };
function addSfx(m, v, val, t) { let c; if (val.startsWith('syn:')) { const k = val.slice(4); c = { id: uid('cl_'), track: 'fx', kind: 'synthSfx', sfx: k, name: SFX_TYPES[k], start: t, dur: { boom: 1.6, trueno: 2.8, subida: 2.2, campana: 2.4 }[k] || 0.9, in: 0, vol: -3 }; } else { const md = m.media[val.slice(3)]; c = { id: uid('cl_'), track: 'fx', kind: 'audio', media: md.id, name: md.name, start: t, dur: md.dur || 1, in: 0, vol: 0 }; } v.clips.push(c); return c; }
ACT.vAddSfx = el => { const [m, v] = curV(); if (!el.value) return; vEdit(m, v, () => addSfx(m, v, el.value, VED.eng?.t || 0)); el.value = ''; drawTimeline(); };
ACT.vAddText = async () => { const [m, v] = curV(); const tx = await promptBox('Texto en pantalla', 'NI UN DÓLAR MÁS'); if (!tx) return; const c = { id: uid('cl_'), track: 'txt', kind: 'text', text: tx, name: tx, start: VED.eng?.t || 0, dur: 2.5, anim: 'pop', style: { font: 'Montserrat', fs: 0.08, y: 0.4, color: '#ffffff' } }; vEdit(m, v, () => v.clips.push(c)); VED.sel = c.id; drawTimeline(); refreshInspector(); vRedraw(); };
ACT.vSubs = () => { const [m, v] = curV(); if (!v.words?.length && !v.subs.on) toast('Necesitas una transcripción: graba tu voz o usa “Pegar texto y alinear”.'); vEdit(m, v, () => v.subs.on = !v.subs.on); rerenderVideo(); };
ACT.vSubStyle = el => { const [m, v] = curV(); vEdit(m, v, () => v.subs.style = el.value); vRedraw(); };
ACT.vTTS = async () => {
  const [m, v] = curV();
  const tx = await promptBox('🗣️ Voz del navegador', '', { label: 'Escribe lo que dirá la voz. Ojo: el navegador no deja guardar esta voz dentro del video exportado; para el video final grábate o sube tu audio.', multiline: true }); if (!tx) return;
  const g = await choiceBox('Voz', '¿Qué voz?', [{ label: 'Mujer', value: 'f' }, { label: 'Hombre', value: 'm', cls: 'pri' }]); if (!g) return;
  const dur = Math.max(1, tx.length / 14); const c = { id: uid('cl_'), track: 'voz', kind: 'tts', text: tx, name: '🗣️ ' + tx.slice(0, 30), gender: g, lang: 'es-MX', start: VED.eng?.t || 0, dur };
  vEdit(m, v, () => v.clips.push(c)); drawTimeline();
};
/* ---------------- Grabar voz + transcripción en vivo ---------------- */
let RECV = null;
ACT.vRecord = async () => {
  const [m, v] = curV(); const btn = $('#recBtn');
  if (RECV) { RECV.stop(); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { return toast('Permite el micrófono para grabar.', 'err'); }
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const words = []; let lastEnd = 0; const t0 = performance.now(); const startAt = VED.eng?.t || 0;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let sr = null;
  if (SR) { sr = new SR(); sr.lang = 'es-MX'; sr.continuous = true; sr.interimResults = false; sr.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const now = (performance.now() - t0) / 1000; const ws = e.results[i][0].transcript.trim().split(/\s+/).filter(Boolean); const segStart = Math.max(lastEnd, now - ws.join(' ').length / 13 - 0.3); const L = ws.reduce((a, w) => a + w.length + 1, 0) || 1; let acc = 0; ws.forEach(w => { const a = segStart + (now - segStart) * acc / L; acc += w.length + 1; words.push({ w, t0: a, t1: segStart + (now - segStart) * acc / L }); }); lastEnd = now; } }; sr.onend = () => { if (RECV) try { sr.start(); } catch (e) { } }; try { sr.start(); } catch (e) { } }
  RECV = { stop: () => { RECV = null; try { sr && (sr.onend = null, sr.stop()); } catch (e) { } rec.stop(); } };
  btn.textContent = '⏹ DETENER GRABACIÓN'; btn.classList.add('danger'); toast(SR ? '🎙️ Grabando… también escribo lo que dices' : '🎙️ Grabando… (tu navegador no transcribe; luego usa “Pegar texto y alinear”)');
  rec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); await sleep(800);
    const blob = new Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] });
    const file = new File([blob], 'Mi voz ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + '.' + (blob.type.includes('mp4') ? 'm4a' : 'webm'), { type: blob.type });
    const md = await addMedia(m, file, { kind: 'voice' }); let dur = md.dur; if (!dur) { try { const b = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer()); dur = b.duration; md.dur = dur; } catch (e) { dur = (performance.now() - t0) / 1000; md.dur = dur; } }
    const c = { id: uid('cl_'), track: freeTrack(v, ['voz'], startAt, dur), kind: 'audio', media: md.id, name: md.name, start: startAt, dur, in: 0, vol: 0 };
    vEdit(m, v, () => { v.clips.push(c); if (words.length) { v.words = [...(v.words || []), ...words.map(w => ({ id: uid('w_'), w: w.w, t0: startAt + w.t0, t1: startAt + Math.min(dur, w.t1), clip: c.id }))].sort((a, b) => a.t0 - b.t0); v.subs.on = true; } });
    VED.eng = null; rerenderVideo(); toast(`Voz grabada (${fmtT(dur)})${words.length ? ` · ${words.length} palabras transcritas, subtítulos activados` : ''}`, 'ok');
  };
  rec.start(250);
};
/* ---------------- Silencios ---------------- */
function silencesIn(buf, from, to, { minSil = 0.45, pad = 0.12 } = {}) {
  const d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.floor(sr * 0.02); const rms = [];
  for (let i = Math.floor(from * sr); i < Math.min(d.length, to * sr); i += win) { let s = 0; for (let j = i; j < Math.min(d.length, i + win); j += 2) s += d[j] * d[j]; rms.push(Math.sqrt(s / (win / 2))); }
  const sorted = [...rms].sort((a, b) => a - b); const floor = sorted[Math.floor(sorted.length * 0.1)] || 0; const peak = sorted[Math.floor(sorted.length * 0.98)] || 0.1;
  const th = Math.max(0.006, floor + (peak - floor) * 0.08);
  const out = []; let st = null;
  rms.forEach((r, k) => { const t = from + k * 0.02; if (r < th) { if (st == null) st = t; } else if (st != null) { if (t - st >= minSil) out.push([st + pad, t - pad]); st = null; } });
  if (st != null && to - st >= minSil) out.push([st + pad, to]);
  return out.filter(([a, b]) => b - a > 0.08);
}
function rippleCut(v, a, b, skip = ['mus1', 'mus2']) {
  const len = b - a; if (len <= 0) return;
  const out = [];
  for (const c of v.clips) {
    if (skip.includes(c.track)) { out.push(c); continue; }
    const s = c.start, e = s + c.dur;
    if (e <= a) out.push(c);
    else if (s >= b) { c.start -= len; out.push(c); }
    else if (s >= a && e <= b) { /* se borra */ }
    else if (s < a && e > b) { const d = clone(c); d.id = uid('cl_'); c.dur = a - s; c.fadeOut = 0; d.start = a; d.in = (c.in || 0) + (b - s); d.dur = e - b; d.fadeIn = 0; out.push(c, d); }
    else if (s < a) { c.dur = a - s; out.push(c); }
    else { c.in = (c.in || 0) + (b - s); c.dur = e - b; c.start = a; out.push(c); }
  }
  v.clips = out.filter(c => c.dur > 0.04);
  v.words = (v.words || []).filter(w => w.t1 <= a + 0.02 || w.t0 >= b - 0.02).map(w => w.t0 >= b - 0.02 ? { ...w, t0: w.t0 - len, t1: w.t1 - len } : w);
  v.notes.forEach(n => { if (n.t >= b) n.t -= len; else if (n.t > a) n.t = a; });
}
ACT.vSilence = async el => {
  const [m, v] = curV();
  const srcs = v.clips.filter(c => (c.track === 'voz' && c.kind === 'audio') || (c.kind === 'video' && c.track === 'img'));
  if (!srcs.length) return toast('No hay voz ni video con audio para analizar', 'err');
  await busy(el, async () => {
    let ranges = [];
    for (const c of srcs) { const buf = await audioBufFor(m, c); if (!buf) continue; silencesIn(buf, c.in || 0, (c.in || 0) + c.dur).forEach(([a, b]) => ranges.push([c.start + a - (c.in || 0), c.start + b - (c.in || 0)])); }
    // solo cortar donde NINGUNA fuente de voz/video tenga sonido
    ranges.sort((x, y) => x[0] - y[0]);
    const voiced = (t) => srcs.some(c => t >= c.start && t < c.start + c.dur && !ranges.some(r => t >= r[0] && t <= r[1]));
    ranges = ranges.filter(([a, b]) => !voiced((a + b) / 2));
    if (!ranges.length) return toast('No encontré silencios largos 👍');
    const total = ranges.reduce((s, [a, b]) => s + (b - a), 0);
    if (!await confirmBox(`Encontré ${plural(ranges.length, 'silencio', 'silencios')} (${total.toFixed(1)} s en total). ¿Quitarlos? La música no se corta.`, { ok: 'Quitar silencios', danger: false, title: '🔇 Quitar silencios' })) return;
    vEdit(m, v, () => { for (const [a, b] of ranges.reverse()) rippleCut(v, a, b); });
    VED.eng = null; rerenderVideo(); toast(`Quité ${total.toFixed(1)} s de silencio ✂️ (↶ para deshacer)`, 'ok');
  }, 'Analizando…');
};
/* ---------------- Transcripción editable ---------------- */
function bindTranscript(m, v) {
  let anchor = null;
  $$('.trans .w').forEach(el => {
    el.addEventListener('click', e => { const i = +el.dataset.wi; if (e.shiftKey && anchor != null) { const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)]; VED.wsel = Array.from({ length: b - a + 1 }, (_, k) => a + k); } else { VED.wsel = VED.wsel.length === 1 && VED.wsel[0] === i ? [] : [i]; anchor = i; vSeek(v.words[i].t0); } $$('.trans .w').forEach(x => x.classList.toggle('on', VED.wsel.includes(+x.dataset.wi))); const cutB = $('[data-a=vWordsCut]'); if (cutB) { cutB.disabled = !VED.wsel.length; cutB.textContent = `✂️ Borrar del video (${VED.wsel.length})`; } const ed = $('[data-a=vWordEdit]'); if (ed) ed.disabled = VED.wsel.length !== 1; });
    el.addEventListener('dblclick', () => { VED.wsel = [+el.dataset.wi]; ACT.vWordEdit(); });
  });
}
ACT.vWordsCut = () => { const [m, v] = curV(); if (!VED.wsel.length) return; const ws = VED.wsel.map(i => v.words[i]).filter(Boolean); const a = Math.min(...ws.map(w => w.t0)), b = Math.max(...ws.map(w => w.t1)); vEdit(m, v, () => rippleCut(v, a, b)); VED.wsel = []; VED.eng = null; rerenderVideo(); toast(`Borré “${ws.map(w => w.w).join(' ')}” del video (${(b - a).toFixed(2)} s)`, 'ok'); };
ACT.vWordEdit = async () => { const [m, v] = curV(); const w = v.words[VED.wsel[0]]; if (!w) return; const n = await promptBox('Corregir palabra (no corta el video)', w.w); if (n == null) return; vEdit(m, v, () => { const parts = n.trim().split(/\s+/); if (parts.length <= 1) w.w = n.trim(); else { const i = v.words.indexOf(w); const step = (w.t1 - w.t0) / parts.length; v.words.splice(i, 1, ...parts.map((p, k) => ({ id: uid('w_'), w: p, t0: w.t0 + k * step, t1: w.t0 + (k + 1) * step, clip: w.clip }))); } }); rerenderVideo(); };
ACT.vWordsClear = async () => { const [m, v] = curV(); if (!await confirmBox('¿Borrar toda la transcripción? (no corta el video)')) return; vEdit(m, v, () => v.words = []); rerenderVideo(); };
ACT.vAlign = async () => {
  const [m, v] = curV();
  const srcs = v.clips.filter(c => (c.track === 'voz' && c.kind === 'audio') || c.kind === 'video'); if (!srcs.length) return toast('Primero agrega tu voz o un video con audio', 'err');
  const c = srcs.find(x => x.id === VED.sel) || srcs[0];
  const tx = await promptBox('📝 Pegar texto y alinear', '', { label: `Pega exactamente lo que dices en “${c.name || 'tu audio'}”. Lo reparto sobre las partes donde hablas (detecto los silencios con código).`, multiline: true }); if (!tx) return;
  const buf = await audioBufFor(m, c); if (!buf) return toast('No pude leer el audio de ese clip', 'err');
  const sil = silencesIn(buf, c.in || 0, (c.in || 0) + c.dur, { minSil: 0.25, pad: 0.02 });
  const speech = []; let p = c.in || 0; for (const [a, b] of sil) { if (a - p > 0.1) speech.push([p, a]); p = b; } if ((c.in || 0) + c.dur - p > 0.1) speech.push([p, (c.in || 0) + c.dur]);
  const total = speech.reduce((s, [a, b]) => s + b - a, 0) || c.dur; const ws = tx.trim().split(/\s+/); const L = ws.reduce((s, w) => s + w.length + 1, 0);
  const out = []; let acc = 0;
  const timeAt = f => { let x = f * total; for (const [a, b] of speech) { if (x <= b - a) return a + x; x -= b - a; } return (c.in || 0) + c.dur; };
  ws.forEach(w => { const f0 = acc / L; acc += w.length + 1; const f1 = acc / L; out.push({ id: uid('w_'), w, t0: c.start + timeAt(f0) - (c.in || 0), t1: c.start + timeAt(f1) - (c.in || 0), clip: c.id }); });
  vEdit(m, v, () => { v.words = [...(v.words || []).filter(w => w.clip !== c.id), ...out].sort((a, b) => a.t0 - b.t0); v.subs.on = true; });
  VED.tab = 'trans'; rerenderVideo(); toast(`Alineé ${ws.length} palabras · subtítulos activados`, 'ok');
};
/* ---------------- Notas ---------------- */
ACT.vNoteAdd = () => { const [m, v] = curV(); const tx = $('#noteTx').value.trim(); if (!tx && !VED.pendingRef) return toast('Escribe la nota', 'err'); vEdit(m, v, () => v.notes.push({ id: uid('n_'), t: VED.eng?.t || 0, cat: $('#noteCat').value, text: tx, done: false, ref: VED.pendingRef || null })); VED.pendingRef = null; rerenderVideo(); };
ACT.vNoteRef = async () => { const [m] = curV(); const [f] = await pickFiles({ multiple: false }); if (!f) return; VED.pendingRef = await addImage(m, f, { source: 'referencia' }); toast('Referencia adjunta: escribe la nota y toca “Agregar nota”'); };
ACT.vNoteFilter = el => { VED.noteFilter = el.dataset.c; rerenderVideo(); };
ACT.vNoteDone = el => { const [m, v] = curV(); const n = v.notes.find(x => x.id === el.dataset.id); vEdit(m, v, () => n.done = el.checked); rerenderVideo(); };
ACT.vNoteEdit = async el => { const [m, v] = curV(); const n = v.notes.find(x => x.id === el.dataset.id); const t = await promptBox('Editar nota', n.text, { multiline: true }); if (t == null) return; vEdit(m, v, () => n.text = t); rerenderVideo(); };
ACT.vNoteDel = el => { const [m, v] = curV(); vEdit(m, v, () => v.notes = v.notes.filter(x => x.id !== el.dataset.id)); rerenderVideo(); };
ACT.vNoteHere = () => { VED.tab = 'notas'; const c = curV()[1].clips.find(x => x.id === VED.sel); if (c && /mus/.test(c.track)) VED.noteCat = 'Música'; else if (c?.track === 'fx') VED.noteCat = 'Sonido'; else if (c?.track === 'txt') VED.noteCat = 'Texto'; else if (c?.track === 'broll') VED.noteCat = 'B-roll'; rerenderVideo(); setTimeout(() => $('#noteTx')?.focus(), 60); };
/* ---------------- Exportar video ---------------- */
ACT.vExport = async el => {
  const [m, v] = curV(); const [fname, W, H] = VFORMATS[el.dataset.f];
  if (v.clips.some(c => c.kind === 'tts') && !await confirmBox('Tienes clips de “voz del navegador”: el navegador no permite meter esa voz en el archivo, así que no se oirá en el video exportado. ¿Exportar igual?', { ok: 'Exportar igual', danger: false })) return;
  const ctl = new AbortController();
  const bg = modal(`<h2>🎬 Exportando para ${fname} (${W}×${H})</h2><p class="small muted">Se graba en tiempo real (${fmtT(vDur(v))}). Deja esta pestaña abierta y visible.</p><div class="bar"><i id="rcBar" style="width:0%"></i></div><div id="rcTxt" class="small muted">Mezclando audio…</div><div class="acts"><button data-x="no" class="danger">Cancelar</button></div>`, { onClose: () => ctl.abort() });
  bg.querySelector('[data-x=no]').onclick = () => { ctl.abort(); bg.remove(); };
  vStop();
  try {
    const eng = new VEngine(m, v); await eng.prepare(); const mix = await mixAudio(m, v);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    eng.playing = true; const dur = vDur(v);
    const { blob, ext } = await recordCanvas({ canvas: cv, duration: dur, audioBuffer: mix, signal: ctl.signal, drawAt: (t, dt) => { eng.t = t; eng.syncVideos(t, true); eng.drawFrame(ctx, W, H, t, dt || 1 / 30); }, onProgress: p => { const b = bg.querySelector('#rcBar'); if (b) { b.style.width = Math.round(p * 100) + '%'; bg.querySelector('#rcTxt').textContent = `Grabando… ${Math.round(p * 100)}%`; } } });
    eng.playing = false; eng.syncVideos(0, false); for (const el2 of eng.vid.values()) URL.revokeObjectURL(el2.src);
    bg.remove(); downloadBlob(blob, `${safeName(v.name)}_${el.dataset.f}.${ext}`);
    toast(`Video listo: ${ext.toUpperCase()} ${(blob.size / 1e6).toFixed(1)} MB 🎬`, 'ok');
  } catch (e) { bg.remove(); if (e.message !== 'Cancelado') toast(e.message, 'err'); }
};
/* ---------------- Enviar a Claude ---------------- */
function compactVideo(v) { return { name: v.name, format: v.format, duration: +vDur(v).toFixed(2), clips: v.clips.map(c => { const o = { ...c }; delete o.style?.cache; return o; }), notes: v.notes, subs: v.subs, tvol: v.tvol, tmute: v.tmute, words: (v.words || []).slice(0, 1500) }; }
function applyVideo(v, p) {
  if (!p || !Array.isArray(p.clips)) throw new Error('La respuesta no trae un proyecto válido.');
  const known = new Set(VTRACKS.map(t => t[0]));
  v.clips = p.clips.filter(c => known.has(c.track) && c.dur > 0).map(c => ({ ...c, id: c.id || uid('cl_') }));
  if (Array.isArray(p.notes)) v.notes = p.notes; if (p.subs) v.subs = { ...v.subs, ...p.subs }; if (p.tvol) v.tvol = p.tvol; if (p.tmute) v.tmute = p.tmute; if (Array.isArray(p.words)) v.words = p.words;
}
async function aiEditVideo(m, v, instr) {
  const proj = compactVideo(v); cmdLog(CC.ok ? '🔌 Enviando a Claude Code…' : '🤖 Preguntando a Claude…');
  let out, file = null;
  if (CC.ok) { const r = await ccEdit('video', instr, proj, { playhead: VED.eng?.t || 0, manhwa: m.name }); out = r.project; file = r.file_url; if (r.message) cmdLog('🔌 ' + esc(r.message), 'ok'); }
  else {
    const prompt = `Eres el editor de video de MI MANHWA STUDIO. Modifica este proyecto JSON según la instrucción y devuelve SOLO el JSON completo del proyecto modificado (mismos id).
Pistas: img (clip principal), broll, txt (textos: text, anim pop|type|fade, style {font, fs, y, color}), voz, fx (synthSfx: sfx = ${Object.keys(SFX_TYPES).join('|')}), mus1, mus2 (synthMusic: style = ${Object.keys(MUSIC_STYLES).join('|')}). Tiempos en segundos: start, dur, in. vol en dB. fadeIn/fadeOut en s. fx de clips visuales: {kb: none|in|out|panR|panL|panU|panD, enter: none|fade|slide|slideL|zoom, shake, shakeAt:[s], particles: none|lluvia|fuego|humo|nieve|chispas|velocidad|polvo}. subs {on, style: bold|amarillo|caja|manhwa, pos}. No inventes media ids nuevos.
Cabezal en ${fmtT(VED.eng?.t || 0)}.
INSTRUCCIÓN: ${instr}
PROYECTO:
${JSON.stringify(proj)}`;
    out = await aiJSON(prompt, { max_tokens: Math.min(32000, JSON.stringify(proj).length / 2 + 2000), estOut: JSON.stringify(proj).length / 3, title: 'Editar video con Claude', temperature: 0.2 });
    out = out.project || out;
  }
  vEdit(m, v, () => applyVideo(v, out)); VED.eng = null; rerenderVideo();
  if (file) { try { const r = await fetch(file, { headers: { 'x-token': ccConf().token } }); const b = await r.blob(); const md = await addMedia(m, new File([b], 'Claude Code.' + (b.type.split('/')[1] || 'mp4'), { type: b.type })); vEdit(m, v, () => v.clips.push({ id: uid('cl_'), track: md.type === 'audio' ? 'voz' : 'img', kind: md.type === 'image' ? 'image' : md.type, media: md.id, name: md.name, start: 0, dur: md.dur || 3, in: 0 })); VED.eng = null; rerenderVideo(); toast('Claude Code te devolvió un archivo; lo agregué al timeline', 'ok'); } catch (e) { } }
  cmdLog('✔ Hecho. Si no te gusta: ↶ DESHACER', 'ok');
}
ACT.vSendClaude = async () => { const [m, v] = curV(); const tx = await promptBox('Enviar a Claude', '', { label: CC.ok ? 'Tu Claude Code recibirá el proyecto completo con tus notas.' : 'Claude recibirá el proyecto con tus notas. (Conecta Claude Code para que lo haga tu agente).', multiline: true }); if (!tx) return; try { await aiEditVideo(m, v, tx + (v.notes.some(n => !n.done) ? '\nTen en cuenta mis notas pendientes.' : '')); } catch (e) { if (e.message !== 'Cancelado') toast(e.message, 'err'); } };

/* ---------------- HABLANDO en el editor de video ---------------- */
function runVideoClause(m, v, raw) {
  const s = norm(raw).replace(/[¿?¡!]/g, ''); const ph = VED.eng?.t || 0; const done = msg => ({ ok: true, msg });
  const times = []; const re = /(\d+:\d{1,2}(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:segundos?|seg|s)\b|minuto\s+\d+|al final|al inicio|al principio|aqui)/g; let mm; while ((mm = re.exec(raw.toLowerCase()))) times.push(parseTime(mm[1], v, ph));
  const rng = (s.match(/\bdel?\s/) && times.length >= 2) ? [times[0], times[1]] : null;
  if (/^(deshaz|deshacer)/.test(s)) { ACT.vUndo(); return done('deshecho'); }
  if (/(quita|elimina|borra|corta).*silencio/.test(s)) { setTimeout(() => ACT.vSilence($('[data-a=vSilence]')), 30); return done('buscando silencios'); }
  if (/\b(musica|cancion|soundtrack)\b/.test(s) && /\b(pon|agrega|anade|mete|usa|quiero)\b/.test(s)) {
    let val = null; const st = Object.keys(MUSIC_STYLES).find(k => s.includes(k.slice(0, 5)) || (k === 'accion' && /accion/.test(s)));
    const song = Object.values(m.media || {}).find(x => x.type === 'audio' && x.kind === 'song' && s.includes(norm(x.name).split(' ')[0]));
    val = song ? 'md:' + song.id : 'syn:' + (st || 'epica');
    const c = addSong(m, v, val, rng ? rng[0] : (times[0] ?? 0), rng ? rng[1] : null); return done(`${c.name} del ${fmtT(c.start)} al ${fmtT(c.start + c.dur)}`);
  }
  if (/\b(borra|quita|elimina|recorta)\b/.test(s) && rng) { rippleCut(v, Math.min(...rng), Math.max(...rng)); return done(`borré del ${fmtT(rng[0])} al ${fmtT(rng[1])}`); }
  if (/\bcorta\b/.test(s)) { const t = times[0] ?? ph; let n = 0; v.clips.filter(c => t > c.start && t < c.start + c.dur && !/mus/.test(c.track)).forEach(c => { if (cutAt(v, c, t)) n++; }); return n ? done(`corté en ${fmtT(t, true)}`) : { ok: false, why: 'No hay clip en ese momento para cortar.' }; }
  const sfx = Object.keys(SFX_TYPES).find(k => new RegExp(`\\b${k}`).test(s)) || (/\bexplosion\b/.test(s) ? 'boom' : /\bespadazo|corte de espada\b/.test(s) ? 'slash' : null);
  if (sfx && /\b(pon|agrega|anade|mete|un|una)\b/.test(s) && !/temblor/.test(s)) { const c = addSfx(m, v, 'syn:' + sfx, times[0] ?? ph); return done(`${SFX_TYPES[sfx]} en ${fmtT(c.start)}`); }
  const trk = /musica|cancion/.test(s) ? ['mus1', 'mus2'] : /voz/.test(s) ? ['voz'] : /efecto|sonido/.test(s) ? ['fx'] : null;
  if (trk && /\b(sube|subele|mas fuerte|aumenta)\b.*volumen|\bvolumen\b.*\b(arriba|mas alto|mas fuerte)\b|mas fuerte/.test(s)) { trk.forEach(t => v.tvol[t] = Math.min(1.5, (v.tvol[t] ?? 1) + 0.2)); return done('subí el volumen'); }
  if (trk && /\b(baja|bajale|mas bajo|reduce|menos)\b.*volumen|\bvolumen\b.*\b(abajo|mas bajo)\b|mas bajito|mas suave/.test(s)) { trk.forEach(t => v.tvol[t] = Math.max(0, (v.tvol[t] ?? 1) - 0.2)); return done('bajé el volumen'); }
  if (trk && /\b(silencia|mutea|quita el sonido)\b/.test(s)) { trk.forEach(t => v.tmute[t] = true); return done('silenciado'); }
  if (/fade ?out|desvanec.*final|que termine suave/.test(s)) { const cs = v.clips.filter(c => (trk || ['mus1', 'mus2']).includes(c.track)); cs.forEach(c => c.fadeOut = numIn(s) || 2); return done('fade out'); }
  if (/fade ?in|entre suave/.test(s)) { const cs = v.clips.filter(c => (trk || ['mus1', 'mus2']).includes(c.track)); cs.forEach(c => c.fadeIn = numIn(s) || 1.5); return done('fade in'); }
  if (/subtitulo/.test(s)) { if (/quita|sin|desactiva|apaga/.test(s)) { v.subs.on = false; return done('sin subtítulos'); } v.subs.on = true; const st = /amarill/.test(s) ? 'amarillo' : /caja|fondo negro/.test(s) ? 'caja' : /manhwa|comic/.test(s) ? 'manhwa' : /grande|blanco/.test(s) ? 'bold' : null; if (st) v.subs.style = st; if (/arriba/.test(s)) v.subs.pos = 0.2; if (/abajo/.test(s)) v.subs.pos = 0.8; if (/centro|medio/.test(s)) v.subs.pos = 0.5; if (!v.words?.length) return { ok: true, msg: 'subtítulos activados (falta transcripción: graba tu voz o pega el texto)' }; return done('subtítulos ' + SUB_STYLES[v.subs.style]); }
  const at = times[0] ?? ph; const clipAt = v.clips.filter(c => ['img', 'broll'].includes(c.track) && at >= c.start && at < c.start + c.dur).sort((a, b) => (a.track === 'broll' ? -1 : 1))[0];
  if (/temblor|tiembl|sacud|shake/.test(s)) { if (!clipAt) return { ok: false, why: 'No hay imagen en ese momento.' }; (clipAt.fx ||= {}).shakeAt = [...(clipAt.fx.shakeAt || []), at - clipAt.start]; if (!/sin sonido/.test(s)) addSfx(m, v, 'syn:boom', at); return done(`temblor en ${fmtT(at)}`); }
  const part = Object.keys(PARTS).find(p => p !== 'none' && s.includes(p.slice(0, 5))); if (part && clipAt) { (clipAt.fx ||= {}).particles = /quita|sin /.test(s) ? 'none' : part; return done(`${PARTS[part]} en ${clipAt.name || 'el clip'}`); }
  if (/zoom lento|ken ?burns/.test(s) && clipAt) { (clipAt.fx ||= {}).kb = /afuera|alej/.test(s) ? 'out' : 'in'; return done('Ken Burns'); }
  if (/\b(texto|letrero|titulo)\b/.test(s) && /\b(pon|agrega|anade)\b/.test(s)) { const q = (raw.match(/["“'‘]([^"”'’]+)["”'’]/) || raw.match(/(?:que diga|diciendo)\s+(.+?)(?:\s+(?:en|del|al)\s+\d|$)/i) || [])[1]; if (!q) return { ok: false, why: 'Dime el texto entre comillas: pon texto "NI UN DÓLAR MÁS" en 0:05' }; const c = { id: uid('cl_'), track: 'txt', kind: 'text', text: q.toUpperCase(), name: q, start: at, dur: 2.5, anim: 'pop', style: { font: 'Montserrat', fs: 0.08, y: 0.4, color: '#ffffff' } }; v.clips.push(c); return done(`texto “${esc(q)}” en ${fmtT(at)}`); }
  if (/^nota|agrega (una )?nota|anota/.test(s)) { const tx = raw.split(/:\s*/).slice(1).join(':') || raw.replace(/^.*?nota\s*(en\s+\S+)?\s*/i, ''); v.notes.push({ id: uid('n_'), t: at, cat: 'General', text: tx, done: false }); return done(`nota en ${fmtT(at)}`); }
  if (/^(ve|ir|ve al|vete|salta|brinca)\b/.test(s) && times.length) { setTimeout(() => vSeek(times[0]), 20); return done('ir a ' + fmtT(times[0])); }
  if (/exporta/.test(s)) { const f = /youtube/.test(s) ? 'youtube' : /reel|instagram/.test(s) ? 'reels' : 'tiktok'; setTimeout(() => ACT.vExport({ dataset: { f } }), 30); return done('exportando ' + f); }
  if (/(velocidad|reproduce a)\s*(1[.,]25|1[.,]5|2|1)/.test(s)) { const r = parseFloat(s.match(/(1[.,]25|1[.,]5|2|1)/)[1].replace(',', '.')); if (VED.eng) VED.eng.rate = r; return done('velocidad ' + r + 'x'); }
  return { ok: false };
}
async function runVideoCmd(text) {
  const [m, v] = curV(); if (!v) return;
  const msgs = [], unknown = []; vSnap(v);
  for (const cl of splitClauses(text)) { const r = runVideoClause(m, v, cl); if (r.ok) msgs.push(r.msg); else unknown.push(r.why || cl); }
  if (msgs.length) { v.updatedAt = Date.now(); vSnap(v); touch(m); VED.eng = null; rerenderVideo(); cmdLog('✔ ' + msgs.join(' · '), 'ok'); }
  if (unknown.length) { const rest = unknown.join(', '); if (CC.ok || await askAiPermission(rest)) await aiEditVideo(m, v, text); else if (!msgs.length) cmdLog(`No entendí: “${esc(rest)}”. Prueba: “quita silencios”, “pon música épica del 0:30 al 0:50”, “pon un boom en 0:05”.`, 'err'); }
}
