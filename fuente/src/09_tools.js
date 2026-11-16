/* =====================================================================
   Herramientas del Editor de Manhwa: stickers, borrador de fondo manual,
   logo en todos los paneles, checklist para publicar, traducir capítulo.
   ===================================================================== */
function stickerList(m) { return Object.values(m.images || {}).filter(i => i.sticker).sort((a, b) => b.createdAt - a.createdAt); }
function addStickerLayer(m, c, it, imgId, o = {}) {
  const meta = m.images[imgId]; const r = it.frame || (it.imgId && m.images[it.imgId]?.w ? m.images[it.imgId].h / m.images[it.imgId].w : (it.blankH || 0.5));
  const w = o.w || 0.32; const h = w * ((meta?.h || 1) / (meta?.w || 1)) / r;
  const L = mkLayer('sticker', { imgId, w, h, x: o.x ?? (0.5 - w / 2), y: o.y ?? Math.max(0, 0.5 - h / 2), ...o });
  it.layers.push(L); return L;
}
ACT.bStickers = () => {
  const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item);
  const st = stickerList(m); m.logo ||= { id: null, pos: 'br', size: 0.16, op: 0.9 };
  const bg = modal(`<div class="row between"><h2>🏷️ Stickers y logo</h2><button class="sm" data-x="close">Cerrar</button></div>
    <div class="row"><button class="pri" data-x="up">📤 Subir PNG (logo / sticker)</button><button data-x="make" ${it?.imgId ? '' : 'disabled'}>🧽 Crear sticker de este panel (borrar fondo)</button><button data-x="makeUp">🧽 Crear sticker de otra imagen</button></div>
    <p class="small muted">Toca un sticker para ponerlo en el panel actual. Luego lo mueves, cambias tamaño y giras.</p>
    <div class="igrid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">${st.map(s => `<div class="ithumb" style="aspect-ratio:1;background:repeating-conic-gradient(#2a2a30 0 25%,#1c1c20 0 50%) 0 0/18px 18px" data-st="${s.id}"><img data-img="${s.id}" alt="" style="object-fit:contain"><div class="cap"><span>${m.logo.id === s.id ? '⭐ logo' : ''}</span><button class="sm icon danger" data-del="${s.id}">🗑️</button></div></div>`).join('') || '<div class="empty" style="grid-column:1/-1">Aún no tienes stickers.</div>'}</div>
    ${st.length ? `<div class="panelbox"><h3>⭐ PONER MI LOGO EN TODOS LOS PANELES</h3>
      <div class="grid2"><label class="f">Logo<select id="lgId">${st.map(s => `<option value="${s.id}" ${m.logo.id === s.id ? 'selected' : ''}>Sticker ${fmtDate(s.createdAt)}${s.name ? ' · ' + esc(s.name) : ''}</option>`).join('')}</select></label>
      <label class="f">Esquina<select id="lgPos">${[['br', 'Abajo derecha'], ['bl', 'Abajo izquierda'], ['tr', 'Arriba derecha'], ['tl', 'Arriba izquierda']].map(([v, l]) => `<option value="${v}" ${m.logo.pos === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label class="f">Tamaño <input type="range" id="lgSize" min="0.05" max="0.4" step="0.01" value="${m.logo.size}"></label>
      <label class="f">Opacidad <input type="range" id="lgOp" min="0.2" max="1" step="0.05" value="${m.logo.op}"></label>
      <div class="row"><button class="pri" data-x="logoAll">⭐ PONER MI LOGO EN TODOS LOS PANELES</button><button class="danger" data-x="logoOff">Quitar logo de todos</button></div></div>` : ''}`, { wide: true });
  hydrateImages(bg);
  bg.querySelector('[data-x=close]').onclick = () => { bg.close(); render(); };
  bg.querySelectorAll('[data-st]').forEach(el => el.onclick = e => { if (e.target.closest('[data-del]')) return; if (!it) return toast('Selecciona un panel primero', 'err'); let L; editLayout(c, () => { L = addStickerLayer(m, c, it, el.dataset.st); }); BSEL.layer = L.id; touch(m); bg.close(); render(); });
  bg.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (!await confirmBox('¿Borrar este sticker? Se quitará de los paneles donde esté.')) return; editLayout(c, () => { for (const ch of m.chapters) for (const x of ch.layout?.items || []) x.layers = x.layers.filter(l => l.imgId !== b.dataset.del); }); await deleteImage(m, b.dataset.del); bg.close(); ACT.bStickers(); });
  bg.querySelector('[data-x=up]').onclick = async () => { const fs = await pickFiles({ accept: 'image/png,image/webp,image/*' }); for (const f of fs) await addImage(m, f, { source: 'sticker', sticker: true, name: f.name.replace(/\.\w+$/, '') }); bg.close(); ACT.bStickers(); };
  bg.querySelector('[data-x=make]').onclick = async () => { const b = await getImageBlob(m, it.imgId); bg.close(); openEraser(m, b); };
  bg.querySelector('[data-x=makeUp]').onclick = async () => { const [f] = await pickFiles({ multiple: false }); if (!f) return; bg.close(); openEraser(m, f); };
  const lg = () => { m.logo.id = bg.querySelector('#lgId').value; m.logo.pos = bg.querySelector('#lgPos').value; m.logo.size = +bg.querySelector('#lgSize').value; m.logo.op = +bg.querySelector('#lgOp').value; };
  const la = bg.querySelector('[data-x=logoAll]'); if (la) la.onclick = () => {
    lg(); const meta = m.images[m.logo.id]; if (!meta) return;
    editLayout(c, () => c.layout.items.forEach(x => {
      x.layers = x.layers.filter(l => !l.logo);
      const r = x.frame || (x.imgId && m.images[x.imgId]?.w ? m.images[x.imgId].h / m.images[x.imgId].w : (x.blankH || 0.5));
      const w = m.logo.size, h = w * (meta.h / meta.w) / r, pad = 0.025;
      const px = m.logo.pos.includes('r') ? 1 - w - pad : pad, py = m.logo.pos.startsWith('b') ? 1 - h - pad * 0.6 : pad * 0.6;
      x.layers.push(mkLayer('sticker', { imgId: m.logo.id, w, h, x: px, y: py, op: m.logo.op, logo: true, anim: 'none' }));
    }));
    touch(m); bg.close(); render(); toast(`Logo puesto en ${plural(c.layout.items.length, 'panel', 'paneles')} ⭐`, 'ok');
  };
  const lo = bg.querySelector('[data-x=logoOff]'); if (lo) lo.onclick = () => { editLayout(c, () => c.layout.items.forEach(x => x.layers = x.layers.filter(l => !l.logo))); touch(m); bg.close(); render(); toast('Logo quitado de todos'); };
};

/* ---------- Borrador de fondo MANUAL (sin IA): pincel, restaurar y varita mágica ---------- */
async function openEraser(m, blob) {
  if (!blob) return toast('No encontré la imagen', 'err');
  const src = await createImageBitmap(blob); const MAXD = 1400; const k = Math.min(1, MAXD / Math.max(src.width, src.height));
  const W = Math.round(src.width * k), H = Math.round(src.height * k);
  const orig = document.createElement('canvas'); orig.width = W; orig.height = H; orig.getContext('2d').drawImage(src, 0, 0, W, H);
  const bg = modal(`<div class="row between"><h2>🧽 Borrar fondo a mano → sticker PNG</h2><button class="sm" data-x="close">Cerrar</button></div>
    <div class="row">
      <button class="sm pri" data-tool="erase">🧽 Borrador</button><button class="sm" data-tool="restore">🖌️ Restaurar</button><button class="sm" data-tool="wand">🪄 Varita (borra un color parecido)</button>
      <label class="f" style="width:150px">Pincel <input type="range" id="erSize" min="4" max="160" value="40"></label>
      <label class="f" style="width:150px">Tolerancia varita <input type="range" id="erTol" min="5" max="120" value="40"></label>
      <button class="sm" data-x="undo">↶ Deshacer</button><button class="sm" data-x="zoomin">🔍＋</button><button class="sm" data-x="zoomout">🔍－</button>
    </div>
    <div id="erWrap" style="max-height:62vh;overflow:auto;border-radius:12px;background:repeating-conic-gradient(#3a3a42 0 25%,#26262c 0 50%) 0 0/20px 20px;touch-action:none"><canvas id="erC" width="${W}" height="${H}" style="display:block;width:100%;cursor:crosshair;touch-action:none"></canvas></div>
    <p class="tiny dim">Consejo: usa la varita en el fondo liso y luego el borrador para los detalles. “Restaurar” devuelve lo que borraste de más.</p>
    <div class="acts"><button data-x="close2">Cancelar</button><button class="pri" data-x="save">💾 Guardar como sticker PNG</button></div>`, { wide: true });
  const cv = bg.querySelector('#erC'); const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(orig, 0, 0);
  let tool = 'erase', zoom = 1; const undo = [];
  const pushU = () => { undo.push(ctx.getImageData(0, 0, W, H)); if (undo.length > 15) undo.shift(); };
  bg.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool; bg.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('pri', x === b)); });
  bg.querySelector('[data-x=undo]').onclick = () => { const d = undo.pop(); if (d) ctx.putImageData(d, 0, 0); };
  const setZoom = z => { zoom = Math.min(4, Math.max(1, z)); cv.style.width = (zoom * 100) + '%'; };
  bg.querySelector('[data-x=zoomin]').onclick = () => setZoom(zoom * 1.4); bg.querySelector('[data-x=zoomout]').onclick = () => setZoom(zoom / 1.4);
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const brush = (x0, y0, x1, y1) => {
    const size = +bg.querySelector('#erSize').value * (W / cv.getBoundingClientRect().width);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size;
    if (tool === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = '#000'; const mask = document.createElement('canvas'); mask.width = W; mask.height = H; const mc = mask.getContext('2d'); mc.lineCap = 'round'; mc.lineWidth = size; mc.beginPath(); mc.moveTo(x0, y0); mc.lineTo(x1, y1); mc.stroke(); mc.globalCompositeOperation = 'source-in'; mc.drawImage(orig, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(mask, 0, 0); }
    ctx.restore();
  };
  const wand = (x, y) => {
    x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
    const id = ctx.getImageData(0, 0, W, H), d = id.data; const tol = +bg.querySelector('#erTol').value; const i0 = (y * W + x) * 4;
    const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2]; if (d[i0 + 3] === 0) return;
    const seen = new Uint8Array(W * H); const st = [y * W + x]; const t2 = tol * tol * 3;
    while (st.length) { const p = st.pop(); if (seen[p]) continue; seen[p] = 1; const j = p * 4; if (d[j + 3] === 0) continue; const dr = d[j] - r0, dg = d[j + 1] - g0, db = d[j + 2] - b0; if (dr * dr + dg * dg + db * db > t2) continue; d[j + 3] = 0; const px = p % W; if (px > 0) st.push(p - 1); if (px < W - 1) st.push(p + 1); if (p >= W) st.push(p - W); if (p < W * (H - 1)) st.push(p + W); }
    ctx.putImageData(id, 0, 0);
  };
  let drawing = false, last = null;
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); pushU(); if (tool === 'wand') { wand(x, y); return; } drawing = true; last = [x, y]; brush(x, y, x + 0.1, y + 0.1); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); brush(last[0], last[1], x, y); last = [x, y]; });
  const end = () => { drawing = false; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const close = () => bg.remove(); bg.querySelector('[data-x=close]').onclick = close; bg.querySelector('[data-x=close2]').onclick = close;
  bg.querySelector('[data-x=save]').onclick = async () => {
    const id = ctx.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (id[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return toast('Borraste todo 😅', 'err');
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1; out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    const png = await new Promise(r => out.toBlob(r, 'image/png'));
    const sid = await addImage(m, new File([png], 'sticker.png', { type: 'image/png' }), { source: 'sticker', sticker: true, name: 'Recorte' });
    close();
    if (Route.view === 'armador') {
      const c = chapterById(m, Route.a); const it = c?.layout.items.find(i => i.id === BSEL.item);
      if (it && await confirmBox('Sticker guardado ✔ ¿Ponerlo en el panel actual?', { ok: 'Sí, ponerlo', danger: false, title: '🏷️ Sticker listo' })) { let L; editLayout(c, () => { L = addStickerLayer(m, c, it, sid, { fg: true }); }); BSEL.layer = L.id; touch(m); }
      render();
    } else toast('Sticker guardado ✔', 'ok');
  };
}
ACT.bEraser = async () => { const m = cur(); const c = chapterById(m, Route.a); const it = c.layout.items.find(i => i.id === BSEL.item); if (!it?.imgId) return; openEraser(m, await getImageBlob(m, it.imgId)); };

/* ---------- Checklist antes de publicar ---------- */
function chapterChecklist(m, c, lang = 'es') {
  const out = []; const items = c.layout?.items || [];
  const add = (ok, text, go = null, level = ok ? 'ok' : 'warn') => out.push({ ok, text, go, level });
  add(items.length > 0, items.length ? `${plural(items.length, 'panel', 'paneles')} en el capítulo` : 'El capítulo no tiene paneles', null, items.length ? 'ok' : 'bad');
  if (!items.length) return out;
  const noText = items.map((x, i) => ({ x, i })).filter(({ x }) => x.imgId && !x.layers.some(l => l.kind !== 'sticker' && layerText(l, lang).trim()));
  add(!noText.length, noText.length ? `Paneles sin texto: ${noText.map(o => o.i + 1).join(', ')} (puede ser a propósito)` : 'Todos los paneles con imagen tienen texto', noText[0]?.x.id);
  const placeholder = items.map((x, i) => ({ x, i })).filter(({ x }) => x.layers.some(l => /^texto…?$/i.test(layerText(l, 'es').trim()) || (l.kind !== 'sticker' && !layerText(l, 'es').trim())));
  add(!placeholder.length, placeholder.length ? `Hay globos vacíos o con “Texto…” en: ${placeholder.map(o => o.i + 1).join(', ')}` : 'Ningún globo vacío', placeholder[0]?.x.id, placeholder.length ? 'bad' : 'ok');
  if (lang !== 'es') { const miss = items.map((x, i) => ({ x, i })).filter(({ x }) => x.layers.some(l => l.kind !== 'sticker' && l.text && !(lang === 'en' ? l.text_en : l.text_ko))); add(!miss.length, miss.length ? `Faltan traducciones (${lang.toUpperCase()}) en: ${miss.map(o => o.i + 1).join(', ')}` : `Traducción ${lang.toUpperCase()} completa`, miss[0]?.x.id); }
  const out_ = items.map((x, i) => ({ x, i })).filter(({ x }) => x.layers.some(l => l.x < -0.04 || l.y < -0.04 || l.x + l.w > 1.04 || l.y + l.h > 1.04));
  add(!out_.length, out_.length ? `Capas que se salen del cuadro (se cortarán) en: ${out_.map(o => o.i + 1).join(', ')}` : 'Ninguna capa se sale del cuadro', out_[0]?.x.id);
  const small = items.map((x, i) => ({ x, i })).filter(({ x }) => x.imgId && (m.images[x.imgId]?.w || 9999) < 800);
  add(!small.length, small.length ? `Imágenes chicas (menos de 800px, se verán borrosas): ${small.map(o => o.i + 1).join(', ')}` : 'Todas las imágenes tienen buen tamaño (800px o más)', small[0]?.x.id);
  const missing = items.map((x, i) => ({ x, i })).filter(({ x }) => x.imgId && !m.images[x.imgId]);
  add(!missing.length, missing.length ? `Imágenes que ya no existen: ${missing.map(o => o.i + 1).join(', ')}` : 'Todas las imágenes están disponibles', missing[0]?.x.id, missing.length ? 'bad' : 'ok');
  add(!!m.covers?.img, m.covers?.img ? 'Portada lista (con y sin título, 1080×1080 y 1080×1920)' : 'Falta la portada', 'portada');
  add(!!(c.title || '').trim(), (c.title || '').trim() ? `Título: “${c.title}”` : 'El capítulo no tiene título');
  const h = items.reduce((a, x) => a + itemHeightAt(m, x, 800) + Math.round((x.gap ?? 80) * 0.5), 0); const slices = Math.ceil(h / 1280);
  add(slices <= 100, `Tamaño WEBTOON: 800px de ancho, ${slices} imágenes de 800×1280${slices > 100 ? ' — pasa el límite de 100, divide en 2 episodios' : ''}`, null, slices > 100 ? 'bad' : 'ok');
  add(['Listo', 'Publicado'].includes(c.status), `Estado del capítulo: ${c.status}${['Listo', 'Publicado'].includes(c.status) ? '' : ' (márcalo como Listo cuando termines)'}`);
  return out;
}
ACT.bChecklist = () => {
  const m = cur(); const c = chapterById(m, Route.a); let lang = BSEL.lang;
  const show = () => {
    const list = chapterChecklist(m, c, lang); const bad = list.filter(x => !x.ok).length;
    return `<div class="row between"><h2>✅ Checklist para publicar</h2><div class="row">${['es', 'en', 'ko'].map(l => `<button class="sm ${l === lang ? 'pri' : ''}" data-cl="${l}">${l.toUpperCase()}</button>`).join('')}</div></div>
      <div class="alert ${bad ? 'warn' : 'ok'}">${bad ? `Faltan ${plural(bad, 'cosa', 'cosas')} por revisar.` : '¡Todo listo para publicar! 🎉'}</div>
      <div class="col" style="gap:8px">${list.map(x => `<div class="row nw between"><div class="small">${x.level === 'ok' ? '✅' : x.level === 'bad' ? '⛔' : '⚠️'} ${esc(x.text)}</div>${x.go ? `<button class="sm" data-goto="${esc(x.go)}">Ir</button>` : ''}</div>`).join('')}</div>
      <div class="acts"><button data-x="close">Cerrar</button>${!bad ? '<button class="pri" data-x="exp">⬇️ Exportar para publicar</button>' : ''}</div>`;
  };
  const bg = modal(show(), { wide: true });
  const wire = () => {
    bg.querySelector('[data-x=close]').onclick = () => bg.close();
    const ex = bg.querySelector('[data-x=exp]'); if (ex) ex.onclick = () => { bg.close(); ACT.bExport(); };
    bg.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => { lang = b.dataset.cl; bg.querySelector('.modal').innerHTML = show(); wire(); });
    bg.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { bg.close(); if (b.dataset.goto === 'portada') return go(mlink(m, 'portada')); BSEL.item = b.dataset.goto; BSEL.layer = null; BSEL.lang = lang; render(); });
  };
  wire();
};

/* ---------- Traducir capítulo (todas las capas, sin tocar imágenes) ---------- */
ACT.bTranslate = async () => {
  const m = cur(); const c = chapterById(m, Route.a);
  const target = await choiceBox('🌐 Traducir capítulo', 'Traduzco todos los globos, textos y SFX. Las imágenes no se tocan.', [{ label: 'Inglés', value: 'en' }, { label: 'Coreano', value: 'ko' }, { label: 'Ambos', value: 'both', cls: 'pri' }]);
  if (!target) return;
  const items = []; c.layout.items.forEach((x, i) => x.layers.forEach(L => { if (L.kind !== 'sticker' && (L.text || '').trim()) items.push({ k: `${x.id}|${L.id}`, text: L.text, sfx: L.kind === 'sfx' }); }));
  if (!items.length) return toast('No hay textos que traducir', 'err');
  const langs = target === 'both' ? 'INGLÉS ("en") y COREANO ("ko")' : target === 'en' ? 'INGLÉS ("en")' : 'COREANO ("ko")';
  const per = isPremium() ? 1000 : 80;
  if (!isPremium() && !await confirmCost('Traducir capítulo', [aiLine(JSON.stringify(items).length + 500, items.length * 40, 6000, `${items.length} textos`)])) return;
  const btn = $('[data-a=bTranslate]');
  await busy(btn, async () => {
    const out = {};
    for (let a = 0; a < items.length; a += per) {
      const chunk = items.slice(a, a + per);
      const r = await aiJSON(`Traduce estos textos de manhwa (globos y efectos de sonido) a ${langs}. Tono natural de webtoon. Los SFX ("sfx":true) tradúcelos como onomatopeyas nativas (BOOM → 쾅 en coreano). Mantén la "k" de cada uno.
${JSON.stringify(chunk)}
Formato: [{"k":"…"${target !== 'ko' ? ',"en":"…"' : ''}${target !== 'en' ? ',"ko":"…"' : ''}}]`, { max_tokens: Math.min(32000, chunk.length * 120 + 500), temperature: 0.3, confirmed: true, title: 'Traducir capítulo' });
      (Array.isArray(r) ? r : []).forEach(x => out[x.k] = x);
    }
    editLayout(c, () => c.layout.items.forEach(x => x.layers.forEach(L => { const t = out[`${x.id}|${L.id}`]; if (t) { if (t.en) L.text_en = t.en; if (t.ko) L.text_ko = t.ko; } })));
    BSEL.lang = target === 'both' ? 'en' : target; touch(m); render(); toast('Capítulo traducido 🌐 Cambia el idioma con ES / EN / KO', 'ok');
  }, 'Traduciendo…');
};
