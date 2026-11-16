/* =====================================================================
   EDITOR DE MANHWA: imágenes adentro, capas editables, encuadre, filtros,
   stickers, logo, deshacer, checklist. Todo con Canvas/JS (sin IA).
   ===================================================================== */
const WORK_W = 1600; // trabaja en grande, reduce al final
const LKINDS = { globo: '💬 Globo', grito: '💥 Grito', pensamiento: '💭 Pensamiento', narracion: '▭ Narración', texto: 'T Texto', sfx: '⚡ SFX', sticker: '🏷️ Sticker' };
const FONTS = { auto: 'Automática', 'Comic Neue': 'Comic Neue (diálogo)', Bangers: 'Bangers (SFX)', Anton: 'Anton', 'Bebas Neue': 'Bebas Neue', 'Permanent Marker': 'Permanent Marker (a mano)', 'Black Han Sans': 'Black Han Sans (coreano)', Montserrat: 'Montserrat Black', Inter: 'Inter' };
const FONT_W = { Montserrat: 900, Inter: 800, 'Comic Neue': 700 };
const LANIMS = { auto: 'Automática', pop: 'POP', type: 'Letra por letra', fade: 'Aparecer', none: 'Sin animación' };
function mkLayer(kind, o = {}) {
  const base = { id: uid('ly_'), kind, x: 0.1, y: 0.1, w: 0.5, h: 0.16, text: kind === 'sfx' ? 'BOOM!' : 'Texto…', text_en: '', text_ko: '', fs: kind === 'sfx' ? 0.11 : 0.042, color: '#111111', fill: '#ffffff', stroke: '#111111', rot: 0, tail: 'bl', bw: 1, op: 1, font: 'auto', anim: 'auto' };
  if (kind === 'sfx') Object.assign(base, { color: '#ffe14d', stroke: '#1a0033', fill: 'transparent', rot: -8 });
  if (kind === 'narracion') Object.assign(base, { fill: '#fff8e1', h: 0.1 });
  if (kind === 'texto') Object.assign(base, { fill: 'transparent', color: '#ffffff', stroke: '#000000' });
  if (kind === 'grito') Object.assign(base, { fs: 0.05 });
  if (kind === 'sticker') Object.assign(base, { text: '', fill: 'transparent', w: 0.3, h: 0.2 });
  return { ...base, ...o };
}
const layerText = (L, lang) => (lang === 'en' ? L.text_en : lang === 'ko' ? L.text_ko : '') || L.text || '';
function fontFor(L, lang, px) {
  if (L.font && L.font !== 'auto') return `${FONT_W[L.font] || 400} ${px}px "${L.font}", "Noto Sans KR", sans-serif`;
  const ko = lang === 'ko';
  if (L.kind === 'sfx' || L.kind === 'grito') return `900 ${px}px ${ko ? '"Black Han Sans", "Noto Sans KR"' : 'Bangers'}, "Noto Sans KR", Impact, sans-serif`;
  return `700 ${px}px ${ko ? '"Noto Sans KR"' : '"Comic Neue"'}, "Noto Sans KR", "Comic Sans MS", sans-serif`;
}
let fontsReady = null;
function ensureFonts() { if (!fontsReady) fontsReady = Promise.all(['700 40px "Comic Neue"', '400 40px Bangers', '900 40px "Noto Sans KR"', '700 40px "Noto Sans KR"', '400 40px Anton', '400 40px "Bebas Neue"', '400 40px "Permanent Marker"', '400 40px "Black Han Sans"', '900 40px Montserrat'].map(f => document.fonts.load(f).catch(() => { }))); return fontsReady; }

/* --- caché de imágenes decodificadas (rápido para editar y animar) --- */
const BMP = new Map();
async function bmpCached(m, id) {
  if (!id) return null;
  if (BMP.has(id)) { const v = BMP.get(id); BMP.delete(id); BMP.set(id, v); return v; }
  const b = await getImageBlob(m, id); if (!b) return null;
  let bmp = null; try { bmp = await createImageBitmap(b); } catch (e) { return null; }
  BMP.set(id, bmp);
  while (BMP.size > 24) { const k = BMP.keys().next().value; try { BMP.get(k).close?.(); } catch (e) { } BMP.delete(k); }
  return bmp;
}
function forgetBmp(id) { if (BMP.has(id)) { try { BMP.get(id).close?.(); } catch (e) { } BMP.delete(id); } }

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.includes(' ') ? para.split(' ') : [...para];
    const joiner = para.includes(' ') ? ' ' : '';
    let line = '';
    for (const w of words) { const t = line ? line + joiner + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
  }
  return lines;
}
function drawBubbleShape(ctx, L, X, Y, W, H, U) {
  ctx.save(); ctx.lineWidth = Math.max(1, U * 0.004 * (L.bw ?? 1)); ctx.strokeStyle = L.stroke; ctx.fillStyle = L.fill;
  const cx = X + W / 2, cy = Y + H / 2; const noStroke = (L.bw ?? 1) <= 0;
  const st = () => { if (!noStroke) ctx.stroke(); };
  const tail = () => {
    if (!L.tail || L.tail === 'none') return;
    const tx = L.tail.includes('l') ? X + W * 0.28 : X + W * 0.72; const down = L.tail.startsWith('b');
    const by = down ? Y + H * 0.92 : Y + H * 0.08; const tipY = down ? Y + H + H * 0.35 : Y - H * 0.35; const tipX = tx + (L.tail.includes('l') ? -W * 0.08 : W * 0.08);
    ctx.beginPath(); ctx.moveTo(tx - W * 0.06, by); ctx.lineTo(tipX, tipY); ctx.lineTo(tx + W * 0.06, by); ctx.closePath(); ctx.fill(); st();
  };
  if (L.kind === 'globo') {
    tail(); ctx.beginPath(); ctx.ellipse(cx, cy, W / 2, H / 2, 0, 0, Math.PI * 2); ctx.fill(); st();
    if (L.tail && L.tail !== 'none') { ctx.beginPath(); ctx.ellipse(cx, cy, W / 2 - ctx.lineWidth, H / 2 - ctx.lineWidth, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (L.kind === 'pensamiento') {
    ctx.beginPath(); const n = 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * W * 0.42 + W * 0.12, cy + Math.sin(a) * H * 0.4); ctx.ellipse(cx + Math.cos(a) * W * 0.42, cy + Math.sin(a) * H * 0.4, W * 0.12, H * 0.16, 0, 0, Math.PI * 2); }
    ctx.fill(); st(); ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.44, H * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    const sx = L.tail?.includes('r') ? X + W * 0.8 : X + W * 0.2; const sy = Y + H;
    [[0.05, 0.045], [0.14, 0.03]].forEach(([d, r]) => { ctx.beginPath(); ctx.arc(sx + (L.tail?.includes('r') ? 1 : -1) * W * d * 0.6, sy + H * d * 2.2, U * r * 0.5, 0, Math.PI * 2); ctx.fill(); st(); });
  } else if (L.kind === 'grito') {
    ctx.beginPath(); const n = 18; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; const r = i % 2 ? 0.78 : 1.08; const px = cx + Math.cos(a) * W / 2 * r, py = cy + Math.sin(a) * H / 2 * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.lineWidth *= 1.4; st();
  } else if (L.kind === 'narracion') {
    ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.fill(); st();
  }
  ctx.restore();
}
/* o: { text, scale, alpha, dx, dy } para animaciones */
function drawLayer(ctx, L, ox, oy, U, Hpx, lang, o = {}) {
  const X = ox + L.x * U + (o.dx || 0), Y = oy + L.y * Hpx + (o.dy || 0), W = L.w * U, H = L.h * Hpx;
  ctx.save();
  ctx.globalAlpha *= (L.op ?? 1) * (o.alpha ?? 1);
  const sc = o.scale ?? 1;
  if (L.rot || sc !== 1) { ctx.translate(X + W / 2, Y + H / 2); if (L.rot) ctx.rotate(L.rot * Math.PI / 180); if (sc !== 1) ctx.scale(sc, sc); ctx.translate(-(X + W / 2), -(Y + H / 2)); }
  if (L.kind === 'sticker') {
    const b = L.imgId ? BMP.get(L.imgId) : null;
    if (b) { if (L.flip) { ctx.translate(X + W, Y); ctx.scale(-1, 1); ctx.drawImage(b, 0, 0, W, H); } else ctx.drawImage(b, X, Y, W, H); }
    ctx.restore(); return;
  }
  const txt = o.text ?? layerText(L, lang);
  if (['globo', 'pensamiento', 'grito', 'narracion'].includes(L.kind)) drawBubbleShape(ctx, L, X, Y, W, H, U);
  else if (L.fill && L.fill !== 'transparent') { ctx.fillStyle = L.fill; ctx.fillRect(X, Y, W, H); }
  let px = Math.max(8, L.fs * U);
  const pad = L.kind === 'globo' || L.kind === 'pensamiento' ? 0.2 : L.kind === 'grito' ? 0.24 : 0.07;
  const maxW = W * (1 - pad * 2), maxH = H * (1 - pad * 1.4);
  const full = layerText(L, lang); let lines;
  for (let k = 0; k < 30; k++) { ctx.font = fontFor(L, lang, px); lines = wrap(ctx, full, maxW); if (lines.length * px * 1.15 <= maxH && lines.every(l => ctx.measureText(l).width <= maxW * 1.02)) break; px *= 0.92; }
  if (o.text != null) { // letra por letra: mismo acomodo que el texto completo
    let left = o.text.length; lines = lines.map(l => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; return s; });
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = px * 1.15, total = lines.length * lh; let ty = Y + H / 2 - total / 2 + lh / 2;
  for (const l of lines) {
    if (L.kind === 'sfx' || L.kind === 'texto') { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, px * (L.kind === 'sfx' ? 0.16 : 0.1) * (L.bw ?? 1)); ctx.strokeStyle = L.stroke; if ((L.bw ?? 1) > 0) ctx.strokeText(l, X + W / 2, ty); }
    ctx.fillStyle = L.color; ctx.fillText(l, X + W / 2, ty); ty += lh;
  }
  ctx.restore();
}
async function loadLayerBitmaps(m, layers) { for (const L of layers || []) if (L.kind === 'sticker' && L.imgId && !BMP.has(L.imgId)) await bmpCached(m, L.imgId); }

/* --- encuadre + filtros (brillo/contraste/saturación) --- */
const CAN_FILTER = (() => { try { const c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string'; } catch (e) { return false; } })();
const fxOn = fx => fx && (fx.b !== 100 || fx.c !== 100 || fx.s !== 100);
function pixelFx(ctx, x, y, w, h, fx) {
  if (w < 1 || h < 1) return;
  const d = ctx.getImageData(x, y, w, h), p = d.data; const B = fx.b / 100, C = fx.c / 100, Sa = fx.s / 100;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] * B, g = p[i + 1] * B, b = p[i + 2] * B;
    r = (r - 128) * C + 128; g = (g - 128) * C + 128; b = (b - 128) * C + 128;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = l + (r - l) * Sa; g = l + (g - l) * Sa; b = l + (b - l) * Sa;
    p[i] = r; p[i + 1] = g; p[i + 2] = b;
  }
  ctx.putImageData(d, x, y);
}
function frameOf(m, it, iw) {
  const meta = it.imgId ? m.images[it.imgId] : null;
  if (!it.imgId) return Math.round(iw * (it.blankH || 0.5));
  const r = it.frame || (meta && meta.w && meta.h ? meta.h / meta.w : 1.4);
  return Math.max(1, Math.round(iw * r));
}
/* dibuja la imagen encuadrada (zoom/mover) con filtros dentro del cuadro */
function drawFramed(ctx, bmp, it, X, Y, iw, fh, kb = null) {
  const cr = it.crop || {}; const z = (cr.z || 1) * (kb?.z || 1);
  const s = Math.max(iw / bmp.width, fh / bmp.height) * z; const dw = bmp.width * s, dh = bmp.height * s;
  const cx = Math.min(1, Math.max(0, (cr.x ?? 0.5) + (kb?.x || 0))), cy = Math.min(1, Math.max(0, (cr.y ?? 0.5) + (kb?.y || 0)));
  ctx.save(); ctx.beginPath(); ctx.rect(X, Y, iw, fh); ctx.clip();
  const fx = it.fx;
  if (fxOn(fx) && CAN_FILTER) ctx.filter = `brightness(${fx.b}%) contrast(${fx.c}%) saturate(${fx.s}%)`;
  ctx.drawImage(bmp, X + (iw - dw) * cx, Y + (fh - dh) * cy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
  if (fxOn(fx) && !CAN_FILTER) pixelFx(ctx, Math.round(X), Math.round(Y), Math.round(iw), Math.round(fh), fx);
}
/* Dibuja un item (imagen + capas) en un canvas de ancho W */
async function renderItem(m, it, W, lang = 'es', bg = '#ffffff') {
  await ensureFonts();
  const scale = (it.scale || 100) / 100; const iw = W * scale; const fh = frameOf(m, it, iw);
  const bmp = it.imgId ? await bmpCached(m, it.imgId) : null;
  await loadLayerBitmaps(m, it.layers);
  const c = document.createElement('canvas'); c.width = W; c.height = fh;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = it.color || bg; ctx.fillRect(0, 0, W, fh);
  const ox = (W - iw) / 2;
  if (bmp) drawFramed(ctx, bmp, it, ox, 0, iw, fh);
  for (const L of it.layers || []) drawLayer(ctx, L, ox, 0, iw, fh, lang);
  return c;
}
function itemHeightAt(m, it, W) { return frameOf(m, it, W * (it.scale || 100) / 100); }

/* ---------------- Deshacer / Rehacer ---------------- */
const HIST = { key: null, undo: [], redo: [], last: null };
function histFor(c) { if (HIST.key !== c.id) { HIST.key = c.id; HIST.undo = []; HIST.redo = []; HIST.last = JSON.stringify(c.layout); } }
function snap(c) { histFor(c); const s = JSON.stringify(c.layout); if (s === HIST.last) return; HIST.undo.push(HIST.last); if (HIST.undo.length > 60) HIST.undo.shift(); HIST.redo = []; HIST.last = s; }
function beforeEdit(c) { histFor(c); HIST.last = HIST.last ?? JSON.stringify(c.layout); HIST._pending = JSON.stringify(c.layout); }
function afterEdit(c) { histFor(c); const s = JSON.stringify(c.layout); if (HIST._pending && s !== HIST._pending) { HIST.undo.push(HIST._pending); if (HIST.undo.length > 60) HIST.undo.shift(); HIST.redo = []; } HIST._pending = null; HIST.last = s; }
function editLayout(c, fn) { beforeEdit(c); fn(); afterEdit(c); }
ACT.bUndo = () => { const m = cur(); const c = chapterById(m, Route.a); histFor(c); if (!HIST.undo.length) return toast('Nada que deshacer'); HIST.redo.push(JSON.stringify(c.layout)); const s = HIST.undo.pop(); c.layout = JSON.parse(s); HIST.last = s; touch(m); render(); toast('↶ Deshecho'); };
ACT.bRedo = () => { const m = cur(); const c = chapterById(m, Route.a); histFor(c); if (!HIST.redo.length) return toast('Nada que rehacer'); HIST.undo.push(JSON.stringify(c.layout)); const s = HIST.redo.pop(); c.layout = JSON.parse(s); HIST.last = s; touch(m); render(); toast('↷ Rehecho'); };

/* ---------------- Vista del Editor de Manhwa ---------------- */
let BSEL = { item: null, layer: null, lang: 'es', tool: 'layers', panel: 'item' };
VIEWS.armador = () => {
  const m = cur(); const c = chapterById(m, Route.a); if (!c) return '<div class="empty">Capítulo no encontrado.</div>';
  c.layout ||= { bg: '#ffffff', items: [] };
  histFor(c);
  const items = c.layout.items;
  if (!items.find(i => i.id === BSEL.item)) BSEL.item = items[0]?.id || null;
  const it = items.find(i => i.id === BSEL.item);
  const L = it?.layers.find(l => l.id === BSEL.layer);
  const stickers = Object.values(m.images || {}).filter(i => i.sticker);
  return `<div class="head"><div><h1>🧩 Editor de Manhwa · Cap ${c.number}</h1><p class="muted">Tus imágenes viven aquí: súbelas, encuádralas, ponles globos, efectos y animación. Todo es editable y nada se dibuja encima para siempre.</p></div>
    <div class="row"><button data-a="go" data-to="${mlink(m, 'cap', c.id)}">← Guion</button><button class="ok" data-a="bSave">💾 GUARDAR CAPÍTULO</button><button data-a="bDupChapter">⧉ DUPLICAR CAPÍTULO (V2)</button></div></div>
    ${cmdBarHTML('manhwa')}
    <div class="row" style="margin:12px 0">
      <button class="pri" data-a="bUpload">📤 SUBIR IMÁGENES</button><button data-a="bLibrary">🗃️ Mis imágenes</button><button data-a="bFromScript">🎞️ Desde el guion</button><button data-a="bBlank">▭ Espacio</button>
      <span class="grow"></span>
      <button class="sm icon" data-a="bUndo" title="Deshacer (Ctrl+Z)">↶</button><button class="sm icon" data-a="bRedo" title="Rehacer">↷</button>
      <span class="small muted">Idioma:</span>${['es', 'en', 'ko'].map(l => `<button class="sm ${BSEL.lang === l ? 'pri' : ''}" data-a="bLang" data-l="${l}">${l.toUpperCase()}</button>`).join('')}
      <button class="sm" data-a="bTranslate">🌐 TRADUCIR CAPÍTULO</button>
      <label class="small muted row">Fondo <input type="color" ${bindAttr(c.layout, 'bg')} value="${c.layout.bg}"></label>
    </div>
    <div class="row" style="margin-bottom:14px">
      <button data-a="bPreview">📱 Vista Webtoon</button><button class="pri" data-a="bAnimPreview">▶️ VISTA PREVIA ANIMADA</button><button data-a="bChecklist">✅ Checklist</button><button class="pri" data-a="bExport">⬇️ EXPORTAR PARA PUBLICAR</button><button data-a="go" data-to="${mlink(m, 'portada')}">🖼️ Portada</button><button data-a="toVideo">🎬 Convertir a video</button>
    </div>
    ${items.length ? `<div class="builder">
      <div class="strip" id="strip">${items.map((x, i) => `<div class="sitem ${x.id === BSEL.item ? 'on' : ''}" data-id="${x.id}"><span class="n">${i + 1}</span>${x.imgId ? `<img data-img="${x.imgId}" style="width:100%;border-radius:6px;display:block;aspect-ratio:${x.frame ? (1 / x.frame).toFixed(3) : 'auto'};object-fit:cover" alt="">` : `<div class="ph" style="height:50px;background:${x.color || c.layout.bg}"></div>`}<div class="row between tiny"><span class="dim">${x.layers.length} capas${x.anim && (x.anim.kb !== 'none' || x.anim.shake || (x.anim.particles && x.anim.particles !== 'none')) ? ' · ✨' : ''}</span><span class="row nw" style="gap:2px"><button class="sm icon" data-a="bDupItem" data-id="${x.id}" title="Duplicar panel">⧉</button><button class="sm icon danger" data-a="bDelItem" data-id="${x.id}" title="Borrar panel">🗑️</button></span></div></div>`).join('')}
        <div class="sitem" style="border-style:dashed;cursor:pointer;text-align:center" data-a="bUpload"><div style="padding:16px 4px" class="small muted">＋ Suelta o sube imágenes aquí</div></div></div>
      <div class="col">
        <div class="row">${Object.entries(LKINDS).filter(([k]) => k !== 'sticker').map(([k, v]) => `<button class="sm" data-a="bAddLayer" data-k="${k}">${v}</button>`).join('')}<button class="sm" data-a="bStickers">🏷️ Stickers y logo</button></div>
        <div class="row"><button class="sm ${BSEL.tool === 'layers' ? 'pri' : ''}" data-a="bTool" data-t="layers">✋ Mover capas</button><button class="sm ${BSEL.tool === 'crop' ? 'pri' : ''}" data-a="bTool" data-t="crop" ${it?.imgId ? '' : 'disabled'}>✂️ Recortar / mover imagen</button><button class="sm" data-a="bEraser" ${it?.imgId ? '' : 'disabled'}>🧽 Borrar fondo (sticker)</button></div>
        <div class="stage-wrap" id="stageWrap"><div class="stage ${BSEL.tool === 'crop' ? 'cropmode' : ''}" id="stage"><canvas id="stageC"></canvas><div id="lboxes"></div></div></div>
        <p class="tiny dim">${BSEL.tool === 'crop' ? 'Arrastra la imagen para moverla dentro del cuadro. Usa el zoom y el formato del cuadro a la derecha.' : 'Arrastra una capa para moverla; el círculo morado cambia su tamaño. Puedes soltar archivos sobre la imagen para reemplazarla (el texto se queda).'}</p>
      </div>
      <div class="props panelbox" id="props">${it ? itemProps(m, c, it, L) : ''}</div>
    </div>` : `<div class="empty" id="dropEmpty">Sube imágenes de donde quieras (celular, galería, Clip Studio, Ibis Paint, Fal.ai) o suéltalas aquí.<br><br><button class="pri big" data-a="bUpload">📤 SUBIR IMÁGENES</button> <button class="big" data-a="bFromScript">🎞️ Traer del guion</button></div>`}`;
};
const FRAMES = [['', 'Original'], ['1', '1:1 cuadrado'], ['1.25', '4:5'], ['1.333', '3:4'], ['1.5', '2:3'], ['1.778', '9:16 vertical'], ['0.5625', '16:9 horizontal'], ['0.75', '4:3 horizontal'], ['2.2', 'Tira alta'], ['0.4', 'Tira ancha']];
const ENTERS = { none: 'Ninguna', fade: 'Aparecer (fade)', slide: 'Deslizar arriba', slideL: 'Deslizar lado', zoom: 'Zoom' };
const KBS = { none: 'Sin movimiento', in: 'Zoom lento adentro', out: 'Zoom lento afuera', panR: 'Paneo a la derecha', panL: 'Paneo a la izquierda', panU: 'Paneo hacia arriba', panD: 'Paneo hacia abajo' };
const PARTS = { none: 'Ninguna', lluvia: '🌧️ Lluvia', fuego: '🔥 Fuego', humo: '💨 Humo', nieve: '❄️ Nieve', chispas: '✨ Chispas', velocidad: '💨 Líneas de velocidad', polvo: '🟤 Polvo' };
function itemAnim(it) { it.anim ||= {}; const a = it.anim; a.enter ??= 'fade'; a.kb ??= 'in'; a.shake ??= false; a.particles ??= 'none'; a.parallax ??= false; a.dur ??= 0; return a; }
function itemProps(m, c, it, L) {
  if (L) return layerPropsHTML(m, L);
  const fx = (it.fx ||= { b: 100, c: 100, s: 100 }); const cr = (it.crop ||= { z: 1, x: 0.5, y: 0.5 }); const a = itemAnim(it);
  const idx = c.layout.items.indexOf(it) + 1;
  return `<div class="row between"><h3>Panel ${idx}</h3><div class="row nw">${['item', 'anim'].map(p => `<button class="sm ${BSEL.panel === p ? 'pri' : ''}" data-a="bPanelTab" data-p="${p}">${p === 'item' ? 'Imagen' : '✨ Animación'}</button>`).join('')}</div></div>
    ${BSEL.panel === 'anim' ? `
      <label class="f">Entrada al panel<select ${bindAttr(a, 'enter')} data-onchange="bRedraw">${Object.entries(ENTERS).map(([k, v]) => `<option value="${k}" ${a.enter === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f">Ken Burns (movimiento de cámara)<select ${bindAttr(a, 'kb')}>${Object.entries(KBS).map(([k, v]) => `<option value="${k}" ${a.kb === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="row nw small"><input type="checkbox" ${bindAttr(a, 'shake')} ${a.shake ? 'checked' : ''}> 💥 Temblor al entrar (0.3 s, para golpes)</label>
      <label class="row nw small"><input type="checkbox" ${bindAttr(a, 'parallax')} ${a.parallax ? 'checked' : ''}> 🧭 Parallax (los stickers marcados “primer plano” se mueven más rápido que el fondo)</label>
      <label class="f">Partículas<select ${bindAttr(a, 'particles')}>${Object.entries(PARTS).map(([k, v]) => `<option value="${k}" ${a.particles === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f"><span>Duración en el video <b>${a.dur ? a.dur + ' s' : 'auto'}</b></span><input type="range" min="0" max="12" step="0.5" ${bindAttr(a, 'dur', { num: 1 })} value="${a.dur}"></label>
      <div class="row"><button class="sm" data-a="bAnimAll">Copiar esta animación a todos</button><button class="sm pri" data-a="bAnimPreview" data-only="${it.id}">▶️ Ver este panel</button></div>
      <p class="tiny dim">Los globos hacen POP y la narración aparece letra por letra (cámbialo en cada capa).</p>`
    : `
    ${it.imgId ? `<div class="row"><button class="sm" data-a="bReplaceImg">🔁 Reemplazar imagen (el texto se queda)</button></div>
      <label class="f">Formato del cuadro<select data-change="bFrame">${FRAMES.map(([v, l]) => `<option value="${v}" ${String(it.frame || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>Zoom <b>${Math.round(cr.z * 100)}%</b></span><input type="range" min="1" max="4" step="0.02" ${bindAttr(cr, 'z', { num: 1 })} data-onchange="bLiveImg" value="${cr.z}"></label>
      <div class="grid2"><label class="f">Mover ↔<input type="range" min="0" max="1" step="0.005" ${bindAttr(cr, 'x', { num: 1 })} data-onchange="bLiveImg" value="${cr.x}"></label><label class="f">Mover ↕<input type="range" min="0" max="1" step="0.005" ${bindAttr(cr, 'y', { num: 1 })} data-onchange="bLiveImg" value="${cr.y}"></label></div>
      <label class="f"><span>Brillo <b>${fx.b}%</b></span><input type="range" min="0" max="200" ${bindAttr(fx, 'b', { num: 1 })} data-onchange="bLiveImg" value="${fx.b}"></label>
      <label class="f"><span>Contraste <b>${fx.c}%</b></span><input type="range" min="0" max="200" ${bindAttr(fx, 'c', { num: 1 })} data-onchange="bLiveImg" value="${fx.c}"></label>
      <label class="f"><span>Saturación <b>${fx.s}%</b></span><input type="range" min="0" max="250" ${bindAttr(fx, 's', { num: 1 })} data-onchange="bLiveImg" value="${fx.s}"></label>
      <div class="row"><button class="sm" data-a="bResetImg">Restablecer imagen</button><button class="sm" data-a="bFxAll">Aplicar color a todos</button></div>` : `<label class="f"><span>Alto del espacio</span><input type="range" min="0.05" max="2" step="0.05" ${bindAttr(it, 'blankH', { num: 1 })} data-onchange="bRedraw" value="${it.blankH || 0.5}"></label><label class="f">Color<input type="color" ${bindAttr(it, 'color')} data-onchange="bRedraw" value="${it.color || '#000000'}"></label><button class="sm" data-a="bReplaceImg">📤 Poner imagen aquí</button>`}
    <label class="f"><span>Tamaño del panel (ancho) <b>${it.scale || 100}%</b></span><input type="range" min="40" max="100" ${bindAttr(it, 'scale', { num: 1 })} data-onchange="bRedraw" value="${it.scale || 100}"></label>
    <label class="f"><span>Espacio después <b>${it.gap ?? 80}px</b></span><input type="range" min="0" max="600" step="10" ${bindAttr(it, 'gap', { num: 1 })} value="${it.gap ?? 80}"></label>
    <p class="small muted">Capas: ${it.layers.length}. Toca una capa para editarla.</p>
    ${it.layers.map(l => `<div class="res small row nw between" data-a="bSelLayer" data-id="${l.id}"><span>${LKINDS[l.kind] || l.kind} — ${esc((l.kind === 'sticker' ? (l.logo ? 'Logo' : 'Imagen') : layerText(l, BSEL.lang)).slice(0, 34))}</span></div>`).join('')}`}`;
}
function layerPropsHTML(m, L) {
  const isS = L.kind === 'sticker';
  return `<div class="row between"><h3>${LKINDS[L.kind] || L.kind}${L.logo ? ' · Logo' : ''}</h3><button class="sm" data-a="bDeselect">✔ Listo</button></div>
    ${isS ? '' : `<label class="f">Texto (ES)<textarea data-lp="text">${esc(L.text)}</textarea></label>
    <label class="f">Texto (EN)<textarea data-lp="text_en">${esc(L.text_en || '')}</textarea></label>
    <label class="f">Texto (KO)<textarea data-lp="text_ko">${esc(L.text_ko || '')}</textarea></label>
    <label class="f">Fuente<select data-lp="font">${Object.entries(FONTS).map(([k, v]) => `<option value="${k}" ${(L.font || 'auto') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="f"><span>Tamaño de letra <b>${Math.round(L.fs * 1000)}</b></span><input type="range" min="15" max="220" value="${Math.round(L.fs * 1000)}" data-lp="fs" data-k="1000"></label>`}
    <label class="f"><span>Rotación <b>${L.rot || 0}°</b></span><input type="range" min="-180" max="180" value="${L.rot || 0}" data-lp="rot" data-k="1"></label>
    <label class="f"><span>Opacidad <b>${Math.round((L.op ?? 1) * 100)}%</b></span><input type="range" min="10" max="100" value="${Math.round((L.op ?? 1) * 100)}" data-lp="op" data-k="100"></label>
    ${['globo', 'pensamiento'].includes(L.kind) ? `<label class="f">Cola del globo<select data-lp="tail">${[['bl', 'Abajo izquierda'], ['br', 'Abajo derecha'], ['tl', 'Arriba izquierda'], ['tr', 'Arriba derecha'], ['none', 'Sin cola']].map(([v, l]) => `<option value="${v}" ${L.tail === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    ${isS ? `<label class="row nw small"><input type="checkbox" data-lpc="fg" ${L.fg ? 'checked' : ''}> Primer plano (para parallax)</label><label class="row nw small"><input type="checkbox" data-lpc="flip" ${L.flip ? 'checked' : ''}> Voltear horizontal</label>` : `
    <div class="row"><label class="f">Letra<input type="color" data-lp="color" value="${L.color}"></label><label class="f">Borde<input type="color" data-lp="stroke" value="${L.stroke}"></label><label class="f">Relleno<input type="color" data-lp="fill" value="${L.fill === 'transparent' ? '#ffffff' : L.fill}"></label></div>
    <div class="row"><label class="row nw small"><input type="checkbox" data-lpc="nofill" ${L.fill === 'transparent' ? 'checked' : ''}> Sin relleno</label></div>
    <label class="f"><span>Grosor del borde <b>${(L.bw ?? 1).toFixed(1)}</b></span><input type="range" min="0" max="40" value="${Math.round((L.bw ?? 1) * 10)}" data-lp="bw" data-k="10"></label>`}
    <label class="f">Animación<select data-lp="anim">${Object.entries(LANIMS).map(([k, v]) => `<option value="${k}" ${(L.anim || 'auto') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="row"><button class="sm" data-a="bLayerZ" data-d="1">⬆ Al frente</button><button class="sm" data-a="bLayerZ" data-d="-1">⬇ Atrás</button><button class="sm" data-a="bDupLayer">⧉ Duplicar</button><button class="sm danger" data-a="bDelLayer">🗑️ Borrar</button></div>`;
}
let stageDrawToken = 0;
async function drawStage() {
  const m = cur(); const c = chapterById(m, Route.a); const it = c?.layout.items.find(i => i.id === BSEL.item);
  const cv = $('#stageC'); if (!cv || !it) return;
  const tok = ++stageDrawToken;
  const src = await renderItem(m, it, 1000, BSEL.lang, c.layout.bg);
  if (tok !== stageDrawToken) return;
  cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
  drawBoxes();
}
const drawStageSoon = debounce(drawStage, 30);
function drawBoxes() {
  const m = cur(); const c = chapterById(m, Route.a); const it = c?.layout.items.find(i => i.id === BSEL.item);
  const box = $('#lboxes'); const cv = $('#stageC'); if (!box || !it || !cv) return;
  if (BSEL.tool === 'crop') { box.innerHTML = ''; return; }
  const scale = (it.scale || 100) / 100; const ox = (1 - scale) / 2 * 100;
  box.innerHTML = it.layers.map(L => `<div class="lbox ${L.id === BSEL.layer ? 'on' : ''}" data-id="${L.id}" style="left:${ox + L.x * scale * 100}%;top:${L.y * 100}%;width:${L.w * scale * 100}%;height:${L.h * 100}%;transform:rotate(${L.rot || 0}deg)"><div class="hdl tl" data-h="tl"></div><div class="hdl" data-h="br"></div></div>`).join('');
}
AFTER.armador = () => {
  const m = cur(); const c = chapterById(m, Route.a); if (!c) return;
  const strip = $('#strip');
  if (strip && window.Sortable) Sortable.create(strip, { animation: 150, delay: 120, delayOnTouchOnly: true, filter: '[data-a]', preventOnFilter: false, onEnd: () => { const ids = $$('.sitem[data-id]', strip).map(x => x.dataset.id); editLayout(c, () => c.layout.items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))); touch(m); render(); } });
  $$('.sitem[data-id]').forEach(el => el.addEventListener('click', e => { if (e.target.closest('[data-a]')) return; BSEL.item = el.dataset.id; BSEL.layer = null; render(); }));
  drawStage(); bindDrop(m, c); bindCmdBar('manhwa');
  const stage = $('#stage'); if (!stage) return;
  stage.addEventListener('pointerdown', e => {
    const it = c.layout.items.find(i => i.id === BSEL.item); if (!it) return;
    const rect = stage.getBoundingClientRect(); const scale = (it.scale || 100) / 100;
    if (BSEL.tool === 'crop') { // mover imagen dentro del cuadro
      const cr = (it.crop ||= { z: 1, x: 0.5, y: 0.5 }); const sx = e.clientX, sy = e.clientY, o = { ...cr };
      beforeEdit(c); e.preventDefault(); stage.setPointerCapture(e.pointerId);
      const mv = ev => { const k = 1 / Math.max(0.05, (cr.z || 1) - 0.98); cr.x = Math.min(1, Math.max(0, o.x - (ev.clientX - sx) / (rect.width * scale) * k * 0.5)); cr.y = Math.min(1, Math.max(0, o.y - (ev.clientY - sy) / rect.height * k * 0.5)); drawStageSoon(); };
      const up = () => { stage.removeEventListener('pointermove', mv); stage.removeEventListener('pointerup', up); afterEdit(c); saveSoon(m); };
      stage.addEventListener('pointermove', mv); stage.addEventListener('pointerup', up); return;
    }
    const lb = e.target.closest('.lbox');
    if (!lb) { if (BSEL.layer) { BSEL.layer = null; $('#props').innerHTML = itemProps(m, c, it, null); AFTER.armadorProps(); drawBoxes(); } return; }
    const L = it.layers.find(l => l.id === lb.dataset.id); if (!L) return;
    if (BSEL.layer !== L.id) { BSEL.layer = L.id; $('#props').innerHTML = itemProps(m, c, it, L); AFTER.armadorProps(); drawBoxes(); }
    const handle = e.target.dataset.h; const sx = e.clientX, sy = e.clientY; const o = { x: L.x, y: L.y, w: L.w, h: L.h };
    const ar = L.kind === 'sticker' ? (o.h * rect.height) / (o.w * rect.width * scale) : 0; // mantener proporción
    beforeEdit(c); e.preventDefault(); stage.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dx = (ev.clientX - sx) / (rect.width * scale), dy = (ev.clientY - sy) / rect.height;
      if (handle === 'br') { L.w = Math.max(0.04, o.w + dx); L.h = ar ? L.w * rect.width * scale * ar / rect.height : Math.max(0.03, o.h + dy); }
      else if (handle === 'tl') { L.w = Math.max(0.04, o.w - dx); L.h = ar ? L.w * rect.width * scale * ar / rect.height : Math.max(0.03, o.h - dy); L.x = o.x + (o.w - L.w); L.y = o.y + (o.h - L.h); }
      else { L.x = o.x + dx; L.y = o.y + dy; }
      const el = $(`.lbox[data-id="${L.id}"]`); const ox = (1 - scale) / 2 * 100;
      if (el) Object.assign(el.style, { left: ox + L.x * scale * 100 + '%', top: L.y * 100 + '%', width: L.w * scale * 100 + '%', height: L.h * 100 + '%' });
    };
    const up = () => { stage.removeEventListener('pointermove', mv); stage.removeEventListener('pointerup', up); stage.removeEventListener('pointercancel', up); afterEdit(c); saveSoon(m); drawStage(); };
    stage.addEventListener('pointermove', mv); stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  });
  // zoom con la rueda en modo recorte
  stage.addEventListener('wheel', e => { if (BSEL.tool !== 'crop') return; const it = c.layout.items.find(i => i.id === BSEL.item); if (!it) return; e.preventDefault(); const cr = (it.crop ||= { z: 1, x: 0.5, y: 0.5 }); cr.z = Math.min(4, Math.max(1, cr.z * (e.deltaY < 0 ? 1.06 : 0.94))); saveSoon(m); drawStageSoon(); }, { passive: false });
  AFTER.armadorProps();
};
AFTER.armadorProps = () => {
  const m = cur(); const c = chapterById(m, Route.a);
  const getL = () => c.layout.items.find(i => i.id === BSEL.item)?.layers.find(l => l.id === BSEL.layer);
  $$('#props [data-lp]').forEach(inp => {
    if (inp._b) return; inp._b = 1;
    inp.addEventListener('focus', () => beforeEdit(c)); inp.addEventListener('pointerdown', () => beforeEdit(c));
    inp.addEventListener('change', () => afterEdit(c));
    inp.addEventListener('input', () => {
      const L = getL(); if (!L) return; let v = inp.value; if (inp.dataset.k) v = Number(v) / Number(inp.dataset.k);
      L[inp.dataset.lp] = v; const lab = inp.closest('label')?.querySelector('b');
      if (lab) { const k = inp.dataset.lp; lab.textContent = k === 'fs' ? Math.round(v * 1000) : k === 'rot' ? v + '°' : k === 'op' ? Math.round(v * 100) + '%' : k === 'bw' ? Number(v).toFixed(1) : lab.textContent; }
      saveSoon(m); drawStageSoon();
    });
  });
  $$('#props [data-lpc]').forEach(inp => { if (inp._b) return; inp._b = 1; inp.addEventListener('change', () => { const L = getL(); if (!L) return; editLayout(c, () => { if (inp.dataset.lpc === 'nofill') L.fill = inp.checked ? 'transparent' : '#ffffff'; else L[inp.dataset.lpc] = inp.checked; }); saveSoon(m); drawStage(); }); });
};
ACT.bRedraw = () => drawStageSoon();
ACT.bLiveImg = el => { const lab = el.closest('label')?.querySelector('b'); if (lab) { const p = el.dataset.path; lab.textContent = p === 'z' ? Math.round(el.value * 100) + '%' : el.value + '%'; } drawStageSoon(); };
ACT.bFrame = el => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); editLayout(c, () => { it.frame = el.value ? Number(el.value) : null; }); touch(m); render(); };
ACT.bResetImg = () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); editLayout(c, () => { it.fx = { b: 100, c: 100, s: 100 }; it.crop = { z: 1, x: 0.5, y: 0.5 }; it.frame = null; }); touch(m); render(); };
ACT.bFxAll = () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); editLayout(c, () => c.layout.items.forEach(x => { if (x.imgId) x.fx = { ...it.fx }; })); touch(m); toast('Color aplicado a todos los paneles', 'ok'); };
ACT.bAnimAll = () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); editLayout(c, () => c.layout.items.forEach(x => { x.anim = { ...itemAnim(it), shake: x.anim?.shake || false, particles: x.anim?.particles || 'none', dur: x.anim?.dur || 0 }; })); touch(m); toast('Animación copiada a todos (temblor y partículas se quedan por panel)', 'ok'); };
ACT.bPanelTab = el => { BSEL.panel = el.dataset.p; render(); };
ACT.bTool = el => { BSEL.tool = el.dataset.t; BSEL.layer = null; render(); };
ACT.bLang = el => { BSEL.lang = el.dataset.l; render(); };
ACT.bSelLayer = el => { BSEL.layer = el.dataset.id; BSEL.tool = 'layers'; render(); };
ACT.bDeselect = () => { BSEL.layer = null; render(); };
ACT.bLayerZ = el => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); const i = it.layers.findIndex(l => l.id === BSEL.layer); const j = i + Number(el.dataset.d); if (j < 0 || j >= it.layers.length) return; editLayout(c, () => { [it.layers[i], it.layers[j]] = [it.layers[j], it.layers[i]]; }); touch(m); drawStage(); };

/* --- subir / soltar / pegar imágenes --- */
async function addItemsFromFiles(m, c, files, at = null) {
  files = files.filter(f => /^image\//.test(f.type)); if (!files.length) return;
  toast(`Subiendo ${plural(files.length, 'imagen', 'imágenes')}…`);
  beforeEdit(c);
  const news = [];
  for (const f of files) { const id = await addImage(m, f, { source: 'subida', chapter: c.id }); news.push({ id: uid('it_'), imgId: id, gap: 80, scale: 100, layers: [], fx: { b: 100, c: 100, s: 100 }, crop: { z: 1, x: 0.5, y: 0.5 } }); }
  if (at == null) c.layout.items.push(...news); else c.layout.items.splice(at, 0, ...news);
  afterEdit(c); BSEL.item = news[0].id; touch(m); render();
}
async function replaceItemImage(m, c, it, file) { editLayout(c, () => { }); beforeEdit(c); it.imgId = await addImage(m, file, { source: 'subida', chapter: c.id }); afterEdit(c); touch(m); render(); toast('Imagen reemplazada; el texto se quedó ✔', 'ok'); }
function bindDrop(m, c) {
  const over = e => { e.preventDefault(); e.dataTransfer && (e.dataTransfer.dropEffect = 'copy'); };
  const stage = $('#stageWrap'); const strip = $('#strip'); const empty = $('#dropEmpty');
  if (stage) { stage.addEventListener('dragover', over); stage.addEventListener('drop', async e => { e.preventDefault(); const fs = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type)); const it = c.layout.items.find(i => i.id === BSEL.item); if (!fs.length) return; if (it && fs.length === 1) await replaceItemImage(m, c, it, fs[0]); else await addItemsFromFiles(m, c, fs); }); }
  for (const el of [strip, empty]) if (el) { el.addEventListener('dragover', over); el.addEventListener('drop', e => { e.preventDefault(); addItemsFromFiles(m, c, [...(e.dataTransfer?.files || [])]); }); }
}
document.addEventListener('paste', e => {
  if (Route.view !== 'armador' || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  const fs = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return;
  const m = cur(); const c = chapterById(m, Route.a); e.preventDefault(); addItemsFromFiles(m, c, fs);
});
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if (Route.view === 'armador') {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ACT.bRedo() : ACT.bUndo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); ACT.bRedo(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && BSEL.layer) { e.preventDefault(); ACT.bDelLayer(); }
  }
});
ACT.bUpload = async () => { const m = cur(); const c = chapterById(m, Route.a); const fs = await pickFiles(); if (!fs.length) return; const i = c.layout.items.findIndex(x => x.id === BSEL.item); await addItemsFromFiles(m, c, fs, i >= 0 ? i + 1 : null); };
ACT.bReplaceImg = async () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); const [f] = await pickFiles({ multiple: false }); if (!f) return; await replaceItemImage(m, c, it, f); };
ACT.bFromScript = () => { ACT.toBuilder(); };
ACT.bBlank = () => { const m = cur(); const c = chapterById(m, Route.a); const it = { id: uid('it_'), imgId: null, blankH: 0.4, color: '#000000', gap: 0, scale: 100, layers: [] }; editLayout(c, () => { const i = c.layout.items.findIndex(x => x.id === BSEL.item); c.layout.items.splice(i >= 0 ? i + 1 : c.layout.items.length, 0, it); }); BSEL.item = it.id; touch(m); render(); };
ACT.bDelItem = async el => { const m = cur(); const c = chapterById(m, Route.a); if (!await confirmBox('¿Borrar este panel del capítulo? (la imagen sigue en “Mis imágenes”)')) return; editLayout(c, () => { c.layout.items = c.layout.items.filter(i => i.id !== el.dataset.id); }); touch(m); render(); };
ACT.bDupItem = el => { const m = cur(); const c = chapterById(m, Route.a); const i = c.layout.items.findIndex(x => x.id === el.dataset.id); const d = clone(c.layout.items[i]); d.id = uid('it_'); d.fromPanel = null; d.layers.forEach(l => { l.id = uid('ly_'); }); editLayout(c, () => c.layout.items.splice(i + 1, 0, d)); BSEL.item = d.id; touch(m); render(); toast('Panel duplicado'); };
ACT.bAddLayer = el => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); if (!it) return; const L = mkLayer(el.dataset.k, { x: 0.2, y: 0.1 + Math.random() * 0.2 }); editLayout(c, () => it.layers.push(L)); BSEL.layer = L.id; BSEL.tool = 'layers'; touch(m); render(); };
ACT.bDelLayer = () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); editLayout(c, () => { it.layers = it.layers.filter(l => l.id !== BSEL.layer); }); BSEL.layer = null; touch(m); render(); };
ACT.bDupLayer = () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); const L = it.layers.find(l => l.id === BSEL.layer); const d = { ...clone(L), id: uid('ly_'), x: L.x + 0.04, y: L.y + 0.04, src: null }; editLayout(c, () => it.layers.push(d)); BSEL.layer = d.id; touch(m); render(); };
ACT.bSave = async el => { const m = cur(); await busy(el, async () => { touch(m); if (S.user) { await pushDirty(); toast('Capítulo guardado en tu nube ☁️', 'ok'); } else toast('Capítulo guardado en este dispositivo 💾 (inicia sesión para la nube)', 'ok'); }, 'Guardando…'); };
ACT.bDupChapter = async () => {
  const m = cur(); const c = chapterById(m, Route.a);
  const d = clone(c); d.id = uid('ch_'); d.title = (c.title || 'Capítulo') + ' (V2)'; d.status = 'Borrador'; d.panels.forEach(p => p.id = uid('pn_')); d.layout.items.forEach(i => i.id = uid('it_')); d.createdAt = Date.now();
  m.chapters.push(d); touch(m); toast(`Copia creada: “${d.title}”. La V1 queda intacta.`, 'ok'); go(mlink(m, 'armador', d.id));
};
/* biblioteca de imágenes dentro del editor */
ACT.bLibrary = () => {
  const m = cur(); const c = chapterById(m, Route.a);
  const imgs = Object.values(m.images || {}).sort((a, b) => b.createdAt - a.createdAt);
  const sel = new Set();
  const bg = modal(`<div class="row between"><h2>🗃️ Mis imágenes (${imgs.length})</h2><button class="sm" data-x="up">📤 Subir</button></div>
    <p class="small muted">Toca para elegir. Puedes añadirlas como paneles nuevos o reemplazar la imagen del panel seleccionado.</p>
    <div class="igrid" style="max-height:56vh;overflow:auto">${imgs.map(i => `<div class="ithumb" data-pick="${i.id}"><img data-img="${i.id}" alt=""><div class="cap"><span>${esc(i.sticker ? 'sticker' : i.source || '')}${i.seed != null ? ' · seed ' + i.seed : ''}</span><button class="sm icon danger" data-del="${i.id}">🗑️</button></div></div>`).join('') || '<div class="empty">Aún no hay imágenes.</div>'}</div>
    <div class="acts"><button data-x="no">Cerrar</button><button data-x="rep">🔁 Reemplazar panel actual</button><button class="pri" data-x="add">＋ Añadir como paneles</button></div>`, { wide: true });
  hydrateImages(bg);
  bg.querySelectorAll('[data-pick]').forEach(el => el.onclick = e => { if (e.target.closest('[data-del]')) return; const id = el.dataset.pick; sel.has(id) ? sel.delete(id) : sel.add(id); el.classList.toggle('on'); });
  bg.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (!await confirmBox('¿Borrar esta imagen? Se quitará de los paneles que la usen.')) return; await deleteImage(m, b.dataset.del); b.closest('.ithumb').remove(); });
  bg.querySelector('[data-x=no]').onclick = () => { bg.close(); render(); };
  bg.querySelector('[data-x=up]').onclick = async () => { bg.close(); await ACT.bUpload(); };
  bg.querySelector('[data-x=add]').onclick = () => { if (!sel.size) return toast('Elige al menos una', 'err'); editLayout(c, () => [...sel].forEach(id => c.layout.items.push({ id: uid('it_'), imgId: id, gap: 80, scale: 100, layers: [] }))); touch(m); bg.close(); render(); };
  bg.querySelector('[data-x=rep]').onclick = () => { const it = c.layout.items.find(i => i.id === BSEL.item); if (!it || sel.size !== 1) return toast('Elige una sola imagen y ten un panel seleccionado', 'err'); editLayout(c, () => { it.imgId = [...sel][0]; }); touch(m); bg.close(); render(); };
};

/* ---------------- Vista previa Webtoon ---------------- */
ACT.bPreview = async () => {
  const m = cur(); const c = chapterById(m, Route.a);
  let lang = BSEL.lang;
  const bg = modal(`<div class="row between"><h2>📱 Vista Webtoon</h2><div class="row">${['es', 'en', 'ko'].map(l => `<button class="sm ${l === lang ? 'pri' : ''}" data-pl="${l}">${l.toUpperCase()}</button>`).join('')}<button class="sm" data-x="close">Cerrar</button></div></div><div class="phone"><div class="scr" id="pvs"><div style="padding:30px;text-align:center;color:#666">Cargando…</div></div></div>`, { wide: true });
  bg.querySelector('[data-x=close]').onclick = () => bg.close();
  const draw = async () => {
    const scr = bg.querySelector('#pvs'); scr.innerHTML = ''; scr.style.background = c.layout.bg;
    for (const it of c.layout.items) {
      const cv = await renderItem(m, it, 800, lang, c.layout.bg); cv.style.background = c.layout.bg; scr.appendChild(cv);
      if (it.gap) { const g = document.createElement('div'); g.style.height = (it.gap / WORK_W * 100) + 'cqw'; g.style.height = Math.round(it.gap * scr.clientWidth / WORK_W) + 'px'; g.style.background = c.layout.bg; scr.appendChild(g); }
    }
  };
  bg.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { lang = b.dataset.pl; bg.querySelectorAll('[data-pl]').forEach(x => x.classList.toggle('pri', x === b)); draw(); });
  draw();
};

/* ---------------- Exportación ---------------- */
const EXPORTS = {
  hd: { label: 'Capítulo listo HD (1600px)', W: 1600, H: 2560, q: 0.93, max: 0 },
  webtoon: { label: 'WEBTOON (800×1280, máx 2MB c/u)', W: 800, H: 1280, q: 0.92, max: 2e6, maxN: 100, maxTotal: 20e6 },
  tapas: { label: 'Tapas (940×4000, máx 2MB c/u)', W: 940, H: 4000, q: 0.9, max: 2e6, maxN: 40 },
  pdf: { label: 'PDF (para leer o imprimir)', W: 800, H: 1280, q: 0.88 },
  tiktok: { label: 'TikTok (1080×1920, una imagen por panel)', W: 1080, H: 1920, q: 0.9 }
};
ACT.bExport = () => {
  const m = cur(); const c = chapterById(m, Route.a);
  if (!c.layout.items.length) return toast('No hay imágenes en el editor', 'err');
  const issues = chapterChecklist(m, c, BSEL.lang).filter(x => !x.ok);
  const bg = modal(`<h2>⬇️ Exportar para publicar · Cap ${c.number}</h2><p class="muted small">Se arma en grande (1600px) y se reduce al final para que se vea nítido.</p>
    ${issues.length ? `<div class="alert warn small">⚠️ El checklist encontró ${plural(issues.length, 'detalle', 'detalles')}. <button class="sm" data-x="chk">Ver checklist</button></div>` : '<div class="alert ok small">✅ Checklist completo</div>'}
    <label class="f">Idioma de los globos<select id="exL">${['es', 'en', 'ko'].map(l => `<option value="${l}" ${BSEL.lang === l ? 'selected' : ''}>${{ es: 'Español', en: 'Inglés', ko: 'Coreano' }[l]}</option>`).join('')}</select></label>
    <div class="col">
      <button class="pri" data-ex="webtoon">📗 WEBTOON ESTÁTICO (800×1280, máx 2MB c/u)</button>
      <button data-ex="tapas">📘 TAPAS ESTÁTICO (940×4000)</button>
      <button data-ex="pdf">📄 PDF</button>
      <button class="pri" data-ex="anim">🎬 MANHWA ANIMADO PARA TIKTOK (video 1080×1920)</button>
      <button data-ex="tiktok">🖼️ TikTok en imágenes (1080×1920, una por panel)</button>
      <button data-ex="hd">⬇️ Descargar capítulo listo HD (1600px)</button>
    </div>
    <div id="exP" class="small muted"></div><div class="acts"><button data-x="close">Cerrar</button></div>`);
  bg.querySelector('[data-x=close]').onclick = () => bg.close();
  const ck = bg.querySelector('[data-x=chk]'); if (ck) ck.onclick = () => { bg.close(); ACT.bChecklist(); };
  bg.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => {
    const lang = bg.querySelector('#exL').value;
    if (b.dataset.ex === 'anim') { bg.close(); BSEL.lang = lang; return ACT.bAnimPreview(); }
    busy(b, () => exportChapter(m, c, b.dataset.ex, lang, t => bg.querySelector('#exP').textContent = t), 'Exportando…');
  });
};
async function toJpegUnder(canvas, q, max) {
  let b = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  while (max && b.size > max && q > 0.4) { q -= 0.07; b = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q)); }
  return b;
}
async function exportChapter(m, c, kind, lang, prog) {
  const E = EXPORTS[kind]; const items = c.layout.items; const base = `${safeName(m.name)}_cap${c.number}_${lang}`;
  const zip = new JSZip();
  if (kind === 'tiktok') {
    for (let i = 0; i < items.length; i++) {
      prog(`Imagen ${i + 1}/${items.length}…`);
      const src = await renderItem(m, items[i], WORK_W, lang, c.layout.bg);
      const cv = document.createElement('canvas'); cv.width = E.W; cv.height = E.H; const x = cv.getContext('2d');
      x.fillStyle = '#0b0b0f'; x.fillRect(0, 0, E.W, E.H);
      const s = Math.min(E.W / src.width, (E.H * 0.86) / src.height); const w = src.width * s, h = src.height * s;
      x.imageSmoothingQuality = 'high'; x.drawImage(src, (E.W - w) / 2, (E.H - h) / 2, w, h);
      x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '700 34px Inter, sans-serif'; x.textAlign = 'center'; x.fillText(`${m.name} · Cap ${c.number}`, E.W / 2, E.H - 60);
      zip.file(`${String(i + 1).padStart(3, '0')}.jpg`, await toJpegUnder(cv, E.q, 0));
    }
    prog('Comprimiendo…'); downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}_tiktok.zip`); prog(`✔ ${items.length} imágenes 1080×1920 listas para TikTok.`); return;
  }
  // layout total en px de salida
  const W = E.W; const k = W / WORK_W;
  const pos = []; let y = 0;
  for (const it of items) { const h = itemHeightAt(m, it, W); pos.push({ it, y, h }); y += h + Math.round((it.gap ?? 80) * k); }
  const totalH = Math.max(1, y - Math.round((items[items.length - 1].gap ?? 80) * k));
  const nSlices = Math.ceil(totalH / E.H);
  const cache = new Map();
  const getItem = async it => { if (!cache.has(it.id)) { if (cache.size > 2) cache.delete(cache.keys().next().value); cache.set(it.id, await renderItem(m, it, WORK_W, lang, c.layout.bg)); } return cache.get(it.id); };
  const slices = [];
  for (let s = 0; s < nSlices; s++) {
    prog(`Armando imagen ${s + 1}/${nSlices}…`);
    const top = s * E.H, h = Math.min(E.H, totalH - top);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = h; const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.fillStyle = c.layout.bg; x.fillRect(0, 0, W, h);
    for (const p of pos) {
      if (p.y + p.h <= top || p.y >= top + h) continue;
      const src = await getItem(p.it); const sk = src.width / W; // src está a 1600
      const sy0 = Math.max(0, top - p.y), sy1 = Math.min(p.h, top + h - p.y);
      // altura real del render puede variar ligeramente
      const ratio = src.height / p.h;
      x.drawImage(src, 0, sy0 * ratio, src.width, (sy1 - sy0) * ratio, 0, p.y + sy0 - top, W, sy1 - sy0);
    }
    slices.push(cv);
  }
  if (kind === 'pdf') {
    prog('Creando PDF…');
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'px', format: [W, E.H], hotfixes: ['px_scaling'] });
    for (let i = 0; i < slices.length; i++) { if (i) pdf.addPage([W, slices[i].height]); const b = await toJpegUnder(slices[i], E.q, 0); const d = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); pdf.addImage(d, 'JPEG', 0, 0, W, slices[i].height); }
    downloadBlob(pdf.output('blob'), `${base}.pdf`); prog(`✔ PDF de ${slices.length} páginas.`); return;
  }
  let total = 0;
  for (let i = 0; i < slices.length; i++) { prog(`Comprimiendo ${i + 1}/${slices.length}…`); const b = await toJpegUnder(slices[i], E.q, E.max); total += b.size; zip.file(`${String(i + 1).padStart(3, '0')}.jpg`, b); }
  const warn = []; if (E.maxN && slices.length > E.maxN) warn.push(`son ${slices.length} imágenes y el límite es ${E.maxN}`); if (E.maxTotal && total > E.maxTotal) warn.push(`pesan ${(total / 1e6).toFixed(1)}MB y el límite es ${E.maxTotal / 1e6}MB (divide el capítulo en dos episodios)`);
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}_${kind}.zip`);
  prog(`✔ ${slices.length} imágenes de ${W}×${E.H} · ${(total / 1e6).toFixed(1)}MB en total.${warn.length ? ' ⚠ Ojo: ' + warn.join('; ') + '.' : ''}`);
}

/* ---------------- Portadas ---------------- */
VIEWS.portada = () => {
  const m = cur(); const cv = (m.covers ||= {}); Object.assign(cv, { title: cv.title ?? m.name, sub: cv.sub ?? `Capítulo ${(lastChapter(m)?.number) || 1}`, color: cv.color || '#ffffff', accent: cv.accent || '#b44dff', pos: cv.pos || 'bottom', zoom: cv.zoom || 1, fx: cv.fx ?? 0.5, fy: cv.fy ?? 0.35, font: cv.font || 'Anton' });
  const prota = m.characters.find(c => c.id === m.bible.protagonistId) || m.characters[0];
  const imgs = Object.values(m.images || {}).sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
  return `<div class="head"><div><h1>🖼️ Generador de Portada</h1><p class="muted">Versión con título y sin título (para miniatura). Cuadrada 1080×1080 y vertical 1080×1920.</p></div>
    <div class="row"><button class="pri big" data-a="coverGen">⚡ 1 CLIC: ${prota ? esc(prota.name) + ' en pose épica' : 'portada épica'}${typeof wkOn === 'function' && wkOn() ? ` · ${loraKind(prota) === 'klein' ? '👷 ' + mx(0.012) : '🎨 2K ' + mx(0.10)}` : ' (Fal.ai)'}</button>${typeof wkOn === 'function' && wkOn() ? `<button class="big" data-a="coverGen" data-titled="1">🔤 Portada con título (${mx(0.04)})</button>` : ''}<button class="big" data-a="coverDl">⬇️ Descargar las 4</button></div></div>
    <div class="covergrid">
      <div class="covers" id="covers"><div><canvas id="cv0"></canvas><div class="tiny muted">Cuadrada · con título</div></div><div><canvas id="cv1"></canvas><div class="tiny muted">Cuadrada · sin título</div></div><div><canvas id="cv2"></canvas><div class="tiny muted">Vertical · con título</div></div><div><canvas id="cv3"></canvas><div class="tiny muted">Vertical · sin título</div></div></div>
      <div class="panelbox">
        <label class="f">Título<input ${bindAttr(cv, 'title')} data-onchange="coverDraw" value="${esc(cv.title)}"></label>
        <label class="f">Subtítulo / número<input ${bindAttr(cv, 'sub')} data-onchange="coverDraw" value="${esc(cv.sub)}"></label>
        <div class="row"><label class="f">Texto<input type="color" ${bindAttr(cv, 'color')} data-onchange="coverDraw" value="${cv.color}"></label><label class="f">Brillo<input type="color" ${bindAttr(cv, 'accent')} data-onchange="coverDraw" value="${cv.accent}"></label>
        <label class="f grow">Posición<select ${bindAttr(cv, 'pos')} data-onchange="coverDraw"><option value="bottom" ${cv.pos === 'bottom' ? 'selected' : ''}>Abajo</option><option value="top" ${cv.pos === 'top' ? 'selected' : ''}>Arriba</option></select></label></div>
        <label class="f">Fuente<select ${bindAttr(cv, 'font')} data-onchange="coverDraw">${['Anton', 'Bangers', 'Inter'].map(f => `<option ${cv.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="f">Zoom<input type="range" min="1" max="2.5" step="0.05" ${bindAttr(cv, 'zoom', { num: 1 })} data-onchange="coverDraw" value="${cv.zoom}"></label>
        <label class="f">Encuadre horizontal<input type="range" min="0" max="1" step="0.01" ${bindAttr(cv, 'fx', { num: 1 })} data-onchange="coverDraw" value="${cv.fx}"></label>
        <label class="f">Encuadre vertical<input type="range" min="0" max="1" step="0.01" ${bindAttr(cv, 'fy', { num: 1 })} data-onchange="coverDraw" value="${cv.fy}"></label>
        <div class="row between"><b class="small">Imagen base</b><button class="sm" data-a="coverUp">📤 Subir</button></div>
        <div class="igrid" style="grid-template-columns:repeat(4,1fr)">${imgs.map(i => `<div class="ithumb ${cv.img === i.id ? 'on' : ''}" data-a="coverPick" data-id="${i.id}"><img data-img="${i.id}" alt=""></div>`).join('') || '<span class="small muted">Sube o genera una imagen.</span>'}</div>
        <button class="sm" data-a="coverAsManhwa" ${cv.img ? '' : 'disabled'}>Usar como portada del manhwa en el panel</button>
      </div></div>`;
};
async function drawCover(canvas, m, W, H, withTitle) {
  await ensureFonts(); const cv = m.covers; const x = canvas.getContext('2d'); canvas.width = W; canvas.height = H;
  x.fillStyle = '#0b0b10'; x.fillRect(0, 0, W, H);
  const bmp = cv.img ? await imgBitmap(m, cv.img) : null;
  if (bmp) {
    const s = Math.max(W / bmp.width, H / bmp.height) * (cv.zoom || 1); const w = bmp.width * s, h = bmp.height * s;
    x.drawImage(bmp, (W - w) * cv.fx, (H - h) * cv.fy, w, h);
  } else { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1145'); g.addColorStop(1, '#0b0b10'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  if (!withTitle) return;
  const top = cv.pos === 'top';
  const g = x.createLinearGradient(0, top ? 0 : H, 0, top ? H * 0.5 : H * 0.5); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  let fs = W * 0.13; const fam = cv.font === 'Inter' ? '800 FSpx Inter' : `400 FSpx ${cv.font}`;
  const title = (cv.title || '').toUpperCase();
  x.font = fam.replace('FS', fs); while (x.measureText(title).width > W * 0.88 && fs > 20) { fs *= 0.94; x.font = fam.replace('FS', fs); }
  const lines = wrap(x, title, W * 0.9).slice(0, 3);
  const subFs = W * 0.045; const blockH = lines.length * fs * 1.02 + subFs * 1.8;
  let y = top ? H * 0.06 + fs : H - H * 0.06 - blockH + fs;
  x.shadowColor = cv.accent; x.shadowBlur = W * 0.03; x.fillStyle = cv.color; x.lineWidth = fs * 0.06; x.strokeStyle = 'rgba(0,0,0,.6)';
  for (const l of lines) { x.strokeText(l, W / 2, y); x.fillText(l, W / 2, y); y += fs * 1.02; }
  x.shadowBlur = 0; x.font = `800 ${subFs}px Inter, sans-serif`; x.fillStyle = cv.accent; x.fillText((cv.sub || '').toUpperCase(), W / 2, y + subFs * 0.5);
}
const COVER_SPECS = [[1080, 1080, true, 'cuadrada_titulo', 500e3], [1080, 1080, false, 'cuadrada_sin_titulo', 500e3], [1080, 1920, true, 'vertical_titulo', 700e3], [1080, 1920, false, 'vertical_sin_titulo', 700e3]];
AFTER.portada = () => ACT.coverDraw();
ACT.coverDraw = debounce(async () => { const m = cur(); for (let i = 0; i < 4; i++) { const c = $('#cv' + i); if (!c) return; const [W, H, t] = COVER_SPECS[i]; await drawCover(c, m, W, H, t); } }, 150);
ACT.coverPick = el => { const m = cur(); m.covers.img = el.dataset.id; touch(m); render(); };
ACT.coverUp = async () => { const m = cur(); const [f] = await pickFiles({ multiple: false }); if (!f) return; m.covers.img = await addImage(m, f, { source: 'portada' }); touch(m); render(); };
ACT.coverAsManhwa = () => { const m = cur(); m.coverImg = m.covers.img; touch(m); toast('Portada del manhwa actualizada', 'ok'); };
ACT.coverDl = async el => {
  const m = cur(); await busy(el, async () => {
    const zip = new JSZip();
    for (const [W, H, t, name, max] of COVER_SPECS) { const c = document.createElement('canvas'); await drawCover(c, m, W, H, t); zip.file(`${name}_${W}x${H}.jpg`, await toJpegUnder(c, 0.92, max)); }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeName(m.name)}_portadas.zip`);
  }, 'Creando…');
};
