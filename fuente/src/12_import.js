/* =====================================================================
   IMPORTAR MI BIBLIA: sube un Word / PDF / texto con tu biblia ya hecha.
   La IA reparte todo (historia, personajes, lugares, poderes, objetos,
   facciones, línea de tiempo, fichas canon) y TÚ revisas antes de guardar.
   ===================================================================== */
const LIBS = {
  mammoth: 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
};
function loadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No pude cargar el lector de documentos. Revisa tu internet.')); document.head.appendChild(s); }); }
async function readDocText(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.doc') && !name.endsWith('.docx')) throw new Error('Ese es un Word antiguo (.doc). Ábrelo en Word y guárdalo como .docx, o expórtalo a PDF.');
  if (name.endsWith('.docx')) { await loadScript(LIBS.mammoth); const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); return r.value; }
  if (name.endsWith('.pdf')) {
    await loadScript(LIBS.pdf); const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const out = [];
    for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const tc = await pg.getTextContent(); let line = '', lastY = null; for (const it of tc.items) { const y = it.transform?.[5]; if (lastY != null && Math.abs(y - lastY) > 4) { out.push(line); line = ''; } line += it.str + (it.hasEOL ? '\n' : ''); lastY = y; } out.push(line, ''); }
    return out.join('\n');
  }
  if (name.endsWith('.odt')) { const z = await JSZip.loadAsync(file); const xml = await z.file('content.xml').async('string'); return xml.replace(/<text:(p|h)[^>]*>/g, '\n').replace(/<text:tab\/>/g, ' ').replace(/<text:s[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
  const t = await file.text();
  if (name.endsWith('.rtf') || t.startsWith('{\\rtf')) return t.replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^{}]*\}/g, '').replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '');
  const bad = (t.slice(0, 4000).match(/[\u0000-\u0008\uFFFD]/g) || []).length;
  if (bad > 20) throw new Error('No puedo leer ese tipo de archivo. Guárdalo como Word (.docx) o PDF, o copia el texto y pégalo en el cuadro.');
  return t;
}
function importPrompt(m, text, part, parts) {
  const f = k => TYPES[k].fields.filter(([x]) => !['loraId', 'loraWeight'].includes(x)).map(([x, l, t, o]) => `"${x}": ${l}${o ? ' (' + o.join('|') + ')' : ''}`).join(', ');
  return `Eres el archivista del manhwa "${m.name}". Lee la BIBLIA que escribió el autor y reparte TODO lo que diga en su lugar. No inventes nada que no esté en el texto; si un dato no aparece, deja el campo vacío o no lo pongas. Respeta los nombres exactamente como los escribió el autor. Escribe en español.
${parts > 1 ? `Este es el fragmento ${part} de ${parts} del documento.` : ''}
Devuelve SOLO este JSON:
{
 "bible": {"synopsis":"", "plot":"trama completa", "rules":"reglas del mundo", "genre":"", "tone":""},
 "characters": [{${f('personajes')}, "relations":[{"name":"nombre del otro personaje o lugar","kind":"${REL_KINDS.join('|')}","note":""}]}],
 "places": [{${f('lugares')}}],
 "powers": [{${f('poderes')}}],
 "objects": [{${f('objetos')}}],
 "factions": [{${f('facciones')}}],
 "timeline": [{${f('historia')}}],
 "canon": [{"entity":"quién o qué","attribute":"atributo corto (cicatriz, color de ojos, edad, estado…)","value":"valor","since":número de capítulo o null}],
 "chapters": [{"number":número,"title":"","premise":"qué pasa en ese capítulo, completo"}],
 "sections": [{"title":"nombre corto de la sección (Temas, Arcos, Glosario, Estilo de dibujo, Música, Notas…)","icon":"un emoji","text":"todo el contenido de esa sección, COMPLETO y fiel al documento; ordénalo con '- ' para listas y '# ' para subtítulos si ayuda"}]
}
MUY IMPORTANTE: NADA del documento debe quedar fuera. Si el autor tiene un plan o resumen de capítulos, ponlo en "chapters". Todo lo que no quepa en otra parte va en "sections": agrúpalo por tema, una sección por tema, con un nombre claro (ej. "Temas de la historia", "Arcos", "Glosario", "Estilo de dibujo", "Plan del final"), sin resumir ni perder nada.
En "canon" pon solo hechos físicos o fijos importantes que no deben cambiar (marcas, colores, edades, quién murió y en qué capítulo, etc.).

DOCUMENTO:
${text}`;
}
function splitDoc(text, max) { if (text.length <= max) return [text]; const out = []; let i = 0; while (i < text.length) { let e = Math.min(text.length, i + max); if (e < text.length) { const p = text.lastIndexOf('\n\n', e); if (p > i + max * 0.5) e = p; } out.push(text.slice(i, e)); i = e; } return out; }
function mergeImport(a, b) {
  const out = { bible: { ...a.bible }, canon: [...(a.canon || []), ...(b.canon || [])], sections: [...(a.sections || []), ...(a.extras || []), ...(b.sections || []), ...(b.extras || [])], chapters: [...(a.chapters || [])] };
  for (const c of b.chapters || []) { const same = out.chapters.find(x => Number(x.number) === Number(c.number) && c.number != null); if (same) { if (c.premise) same.premise = same.premise ? same.premise + '\n' + c.premise : c.premise; same.title ||= c.title; } else out.chapters.push(c); }
  for (const [k, v] of Object.entries(b.bible || {})) if (v) out.bible[k] = out.bible[k] && out.bible[k] !== v ? out.bible[k] + '\n\n' + v : v;
  for (const key of ['characters', 'places', 'powers', 'objects', 'factions', 'timeline']) {
    const list = [...(a[key] || [])];
    for (const e of b[key] || []) { const same = list.find(x => norm(x.name) === norm(e.name)); if (same) { for (const [k, v] of Object.entries(e)) if (v && !same[k]) same[k] = v; if (e.relations) same.relations = [...(same.relations || []), ...e.relations]; } else list.push(e); }
    out[key] = list;
  }
  return out;
}
ACT.importBible = () => {
  const m = cur();
  const bg = modal(`<h2>📄 Subir mi biblia</h2>
    <p class="small muted">Sube tu archivo <b>o</b> pega el texto. Reparto todo solo: historia, personajes, lugares, poderes, objetos, facciones, línea de tiempo y fichas canon. Tú revisas antes de guardar.</p>
    <div class="row"><button class="pri big" data-x="file">📁 Elegir archivo (Word, PDF, TXT, ODT, RTF)</button><span class="small muted" id="ibFile"></span></div>
    <label class="f">…o pega aquí el texto de tu biblia<textarea id="ibText" style="min-height:220px" placeholder="Pega aquí tu biblia completa (personajes, lugares, poderes, historia…)"></textarea></label>
    <div id="ibStatus" class="small"></div>
    <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="go">✨ Acomodar todo</button></div>`, { wide: true });
  const status = (msg, cls = '') => { const el = bg.querySelector('#ibStatus'); if (el) el.innerHTML = `<div class="alert ${cls || 'info'}">${msg}</div>`; };
  let fileText = '', fileName = '';
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=file]').onclick = async () => {
    const [file] = await pickFiles({ multiple: false, accept: '*/*' }); if (!file) return;
    status(`<span class="spin"></span> Leyendo “${esc(file.name)}”…`);
    try { fileText = (await readDocText(file)).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(); fileName = file.name; }
    catch (e) { fileText = ''; return status('⚠️ ' + esc(e.message), 'bad'); }
    if (fileText.length < 30) { fileText = ''; return status('⚠️ No encontré texto en ese archivo (si es un PDF escaneado o fotos, no tiene texto). Copia y pega el texto en el cuadro.', 'bad'); }
    bg.querySelector('#ibFile').textContent = `✔ ${file.name} · ${fileText.length.toLocaleString('es')} caracteres`;
    bg.querySelector('#ibText').value = fileText.slice(0, 200000);
    status(`✔ Leí tu archivo (${fileText.length.toLocaleString('es')} caracteres). Revisa el texto si quieres y toca <b>✨ Acomodar todo</b>.`, 'ok');
  };
  bg.querySelector('[data-x=go]').onclick = async e => {
    const text = (bg.querySelector('#ibText').value || '').trim();
    if (text.length < 30) return status('⚠️ Primero elige tu archivo o pega el texto de tu biblia.', 'bad');
    const name = fileName || 'Texto pegado';
    await runImport(m, text, name, status, e.target, bg);
  };
};
async function runImport(m, text, fname, status, btn, bg) {
  const max = isPremium() ? 150000 : 90000; const parts = splitDoc(text, max); const chars = text.length;
  if (S.settings.cc?.token && !CC.ok) { status('<span class="spin"></span> Buscando tu Claude Code…'); await ccPing(); }
  const viaCC = usingCC();
  if (!viaCC && S.settings.cc?.token) status('⚠️ Tu puente de Claude Code está <b>apagado</b> (ábrelo con doble clic en “INICIAR PUENTE”). Mientras, sigo con copiar y pegar.', 'warn');
  if (!isPremium() && !await confirmCost('Importar mi biblia', [aiLine(chars + 2500 * parts.length, Math.min(30000, Math.round(chars / 3)), 30000 * parts.length, `Leer “${fname}” (${Math.round(chars / 1000)}k caracteres${parts.length > 1 ? ', ' + parts.length + ' partes' : ''})`)])) return;
  btn.disabled = true; const t0 = Date.now(); let timer = null;
  try {
    let res = { bible: {}, characters: [], places: [], powers: [], objects: [], factions: [], timeline: [], canon: [] };
    for (let i = 0; i < parts.length; i++) {
      const lbl = parts.length > 1 ? `parte ${i + 1} de ${parts.length}` : 'tu biblia';
      clearInterval(timer);
      const tick = () => { const s = Math.round((Date.now() - t0) / 1000); status(viaCC ? `<span class="spin"></span> 🔌 Tu Claude Code está leyendo ${lbl}… <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b><br><span class="tiny">Puede tardar de 1 a 5 minutos según lo largo. No cierres esta ventana.</span>` : `${S.settings.cc?.token ? '⚠️ Tu puente de Claude Code está <b>apagado</b> (ábrelo con doble clic en “INICIAR PUENTE” para que sea automático). Mientras, ' : ''}<span class="spin"></span> esperando la respuesta de Claude para ${lbl}…`, S.settings.cc?.token ? 'warn' : ''); };
      tick(); timer = setInterval(tick, 1000);
      const r = await aiJSON(importPrompt(m, parts[i], i + 1, parts.length), { max_tokens: 32000, temperature: 0.1, confirmed: true, title: parts.length > 1 ? `Importar biblia (parte ${i + 1} de ${parts.length})` : 'Importar mi biblia' });
      res = mergeImport(res, r);
    }
    clearInterval(timer);
    const n = ['characters', 'places', 'powers', 'objects', 'factions', 'timeline', 'canon', 'chapters', 'sections'].reduce((a, k) => a + (res[k] || []).length, 0);
    if (!n && !Object.values(res.bible || {}).some(Boolean)) { status('⚠️ Claude no encontró nada que acomodar. Revisa que el texto sea tu biblia e intenta de nuevo.', 'bad'); return; }
    bg.close(); showImportReview(m, res, fname, text);
  } catch (e) {
    clearInterval(timer);
    status(e.message === 'Cancelado' ? 'Cancelado.' : '⚠️ ' + esc(e.message) + '<br><span class="tiny">Intenta otra vez. Si sigue fallando, mándame una captura de este mensaje.</span>', e.message === 'Cancelado' ? '' : 'bad');
  } finally { btn.disabled = false; }
}
const IMPORT_SECTIONS = [['characters', 'personajes'], ['places', 'lugares'], ['powers', 'poderes'], ['objects', 'objetos'], ['factions', 'facciones'], ['timeline', 'historia']];
function showImportReview(m, res, fname, srcText = '') {
  const extras = [...(res.sections || []), ...(res.extras || [])].filter(x => x && (x.text || '').trim()); const caps = (res.chapters || []).filter(x => x && (x.premise || x.title));
  const rows = []; // {sec, t, e, dupe, mode}
  for (const [key, t] of IMPORT_SECTIONS) for (const e of res[key] || []) { if (!e?.name) continue; const dupe = (m[TYPES[t].key] || []).find(x => norm(x.name) === norm(e.name)); rows.push({ key, t, e, dupe, mode: dupe ? 'merge' : 'new' }); }
  const canon = (res.canon || []).filter(f => f.entity && f.attribute && f.value).map(f => ({ ...f, dupe: m.canon.some(c => norm(c.entity) === norm(f.entity) && norm(c.attribute) === norm(f.attribute)) }));
  const bibleF = [['synopsis', 'Sinopsis'], ['plot', 'Trama completa'], ['rules', 'Reglas del mundo'], ['genre', 'Género'], ['tone', 'Tono']].filter(([k]) => (res.bible || {})[k]);
  const sum = IMPORT_SECTIONS.map(([key, t]) => [TYPES[t], rows.filter(r => r.key === key).length]).filter(x => x[1]);
  const gone = []; for (const [key, t] of IMPORT_SECTIONS) { const names = new Set((res[key] || []).map(e => norm(e?.name || ''))); for (const e of m[TYPES[t].key] || []) if (e.name && !names.has(norm(e.name))) gone.push({ t, e }); }
  const hasOld = !!(m.bible.master && (m.bible.master.text || '').trim()) || Object.keys(TYPES).some(k => (m[TYPES[k].key] || []).length);
  const bg = modal(`<h2>📄 Esto encontré en “${esc(fname)}”</h2>
    <div class="row">${sum.map(([T, n]) => `<span class="chip neon">${T.icon} ${n} ${T.label.toLowerCase()}</span>`).join('')}${canon.length ? `<span class="chip">📌 ${canon.length} fichas canon</span>` : ''}${bibleF.length ? `<span class="chip">🧠 ${bibleF.length} partes de la Biblia</span>` : ''}</div>
    ${hasOld ? `<div class="panelbox" style="border-color:var(--neon)"><h3 style="margin-top:0">¿Qué es este documento?</h3>
      <label class="row nw res" style="cursor:pointer"><input type="radio" name="ibkind" value="full"><div><b>📚 Mi biblia nueva y completa</b> <span class="small muted">(la reorganicé o la mejoré)</span><div class="small muted">Se vuelve tu biblia base. Lo que ya existe <b>se actualiza</b> con lo nuevo (sin perder fotos, LoRAs ni lo que el documento no mencione). Sinopsis, trama y secciones <b>se reemplazan</b> en vez de duplicarse. Te muestro lo que ya no aparece para que decidas si lo quitas.</div></div></label>
      <label class="row nw res" style="cursor:pointer"><input type="radio" name="ibkind" value="add"><div><b>➕ Solo cosas nuevas para agregar</b><div class="small muted">Tu biblia y tus fichas se quedan como están. Solo se agrega lo nuevo y se completa lo vacío. El texto de este documento se agrega al final de tu biblia.</div></div></label></div>` : ''}
    <p class="small muted">Nada se guarda hasta que tú lo apruebes. Desmarca lo que no quieras. Si algo ya existe, elige si completarlo, reemplazarlo u omitirlo.</p>
    <div class="col" style="gap:10px;max-height:56vh;overflow:auto">
      ${caps.length ? `<div class="panelbox"><h3>📖 Plan de capítulos (${caps.length})</h3>${caps.map((c, i) => `<label class="row nw small"><input type="checkbox" data-capi="${i}" checked><span><b>Cap ${esc(c.number ?? '?')}${c.title ? ' · ' + esc(c.title) : ''}</b> <span class="muted">${esc(String(c.premise || '').slice(0, 140))}</span>${chapterByNum(m, c.number) ? ' <span class="chip warn">ya existe → completo lo vacío</span>' : ''}</span></label>`).join('')}</div>` : ''}
      ${extras.length ? `<div class="panelbox"><h3>📘 Secciones de tu biblia (${extras.length})</h3><p class="tiny dim">Temas, arcos, glosario, estilo… cada uno queda como su propia sección en tu Biblia, y Claude lo usa.</p>${extras.map((x, i) => `<label class="row nw small"><input type="checkbox" data-ext="${i}" checked><span><b>${esc(x.icon || secIcon(x.title || ''))} ${esc(x.title || 'Sección')}</b> <span class="muted">${esc(String(x.text).slice(0, 140))}</span></span></label>`).join('')}</div>` : ''}
      ${srcText ? `<label class="alert ok small" style="cursor:pointer"><input type="checkbox" id="ibMaster" checked style="margin-right:8px"><div>📜 <b>Usar este documento como mi biblia base</b> (${srcText.length.toLocaleString('es')} caracteres, completo). Desde ahí se reparten tus cambios. ${m.bible.master && m.bible.master.from !== 'generado' ? 'Tu biblia anterior queda guardada en “Versiones que subiste”.' : ''}</div></label>` : ''}
      ${bibleF.length ? `<div class="panelbox"><h3>🧠 Biblia</h3>${bibleF.map(([k, l]) => `<label class="row nw small"><input type="checkbox" data-bib="${k}" checked><div class="grow"><b>${l}</b>${m.bible[k] ? ' <span class="chip warn">ya tienes texto: se agrega al final</span>' : ''}<div class="muted">${esc(String(res.bible[k]).slice(0, 220))}${String(res.bible[k]).length > 220 ? '…' : ''}</div></div></label>`).join('')}</div>` : ''}
      ${IMPORT_SECTIONS.map(([key, t]) => { const rs = rows.filter(r => r.key === key); if (!rs.length) return ''; const T = TYPES[t];
        return `<div class="panelbox"><div class="row between"><h3>${T.icon} ${T.label} (${rs.length})</h3><button class="sm ghost" data-allsec="${key}">Marcar / desmarcar todos</button></div>${rs.map(r => { const i = rows.indexOf(r); const sub = entSub(t, r.e); return `<div class="row nw between small" style="border-top:1px solid var(--line);padding-top:6px"><label class="row nw grow"><input type="checkbox" data-row="${i}" data-sec="${key}" checked><div><b>${esc(r.e.name)}</b> <span class="muted">${esc(sub.slice(0, 120))}</span></div></label>${r.dupe ? `<select data-mode="${i}" style="width:auto;min-height:34px;padding:4px 8px"><option value="merge">Ya existe → completar lo vacío</option><option value="replace">Ya existe → reemplazar</option><option value="new">Crear otro aparte</option></select>` : '<span class="chip ok">nuevo</span>'}</div>`; }).join('')}</div>`; }).join('')}
      ${gone.length ? `<div class="panelbox" id="ibGone" style="display:none"><h3>🗂️ Ya no aparecen en tu biblia nueva (${gone.length})</h3><p class="tiny dim">Se quedan como están. Marca solo los que quieras <b>quitar</b> de tu manhwa.</p>${gone.map((g, i) => `<label class="row nw small"><input type="checkbox" data-gone="${i}"><span>${TYPES[g.t].icon} <b>${esc(g.e.name)}</b> <span class="muted">${esc(String(g.e.role || g.e.description || '').slice(0, 90))}</span></span></label>`).join('')}</div>` : ''}
      ${canon.length ? `<div class="panelbox"><h3>📌 Fichas canon (${canon.length})</h3>${canon.map((f, i) => `<label class="row nw small"><input type="checkbox" data-canon="${i}" ${f.dupe ? '' : 'checked'}><span>${esc(f.entity)} · ${esc(f.attribute)} · <b>${esc(f.value)}</b>${f.since ? ' · desde Cap ' + esc(f.since) : ''}${f.dupe ? ' <span class="chip warn">ya tienes ese dato</span>' : ''}</span></label>`).join('')}</div>` : ''}
    </div>
    <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="ok">✔ GUARDAR LO MARCADO</button></div>`, { wide: true });
  bg.querySelectorAll('[data-allsec]').forEach(b => b.onclick = () => { const cbs = [...bg.querySelectorAll(`[data-sec="${b.dataset.allsec}"]`)]; const on = !cbs.every(c => c.checked); cbs.forEach(c => c.checked = on); });
  bg.querySelectorAll('[data-mode]').forEach(s => s.onchange = () => rows[+s.dataset.mode].mode = s.value);
  let kind = hasOld ? null : 'full';
  bg.querySelectorAll('[name=ibkind]').forEach(r => r.onchange = () => { kind = r.value; const full = kind === 'full';
    rows.forEach((row, i) => { if (!row.dupe) return; row.mode = full ? 'replace' : 'merge'; const sel = bg.querySelector(`[data-mode="${i}"]`); if (sel) sel.value = row.mode; });
    bg.querySelectorAll('[data-canon]').forEach(c => { if (canon[+c.dataset.canon].dupe) c.checked = full; });
    const mb = bg.querySelector('#ibMaster'); if (mb) { mb.checked = true; const lab = mb.closest('label')?.querySelector('div'); if (lab) lab.innerHTML = full ? '📜 <b>Usar este documento como mi biblia base</b> (la anterior queda en “Versiones que subiste”).' : '📜 <b>Agregar el texto de este documento al final de mi biblia</b>.'; }
    const gb = bg.querySelector('#ibGone'); if (gb) gb.style.display = full ? '' : 'none'; });
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=ok]').onclick = () => {
    if (!kind) return toast('Primero elige arriba qué es este documento: biblia nueva completa o cosas para agregar', 'err');
    const full = kind === 'full'; const before = JSON.stringify(m);
    const counts = {}; const created = [];
    bg.querySelectorAll('[data-bib]').forEach(c => { if (!c.checked) return; const k = c.dataset.bib; const v = String(res.bible[k]).trim(); m.bible[k] = !full && m.bible[k] && ['synopsis', 'plot', 'rules'].includes(k) && !m.bible[k].includes(v) ? m.bible[k] + '\n\n' + v : v; counts['Biblia'] = (counts['Biblia'] || 0) + 1; });
    for (const c of bg.querySelectorAll('[data-row]')) {
      if (!c.checked) continue; const r = rows[+c.dataset.row]; const T = TYPES[r.t]; const arr = (m[T.key] ||= []);
      const clean = {}; T.fields.forEach(([k, , ty]) => { const v = r.e[k]; if (v == null || v === '') return; clean[k] = ty === 'num' ? (Number(v) || 0) : String(v); });
      let target;
      if (r.dupe && r.mode === 'merge') { target = r.dupe; for (const [k, v] of Object.entries(clean)) if (!target[k]) target[k] = v; }
      else if (r.dupe && r.mode === 'replace') { target = r.dupe; Object.assign(target, clean); }
      else { target = { id: uid(r.t.slice(0, 1) + '_'), createdAt: Date.now(), relations: [], ...clean }; if (r.t === 'personajes') { target.status ||= 'vivo'; target.loraWeight = 0.9; } arr.push(target); }
      created.push({ target, rels: r.e.relations || [] });
      counts[T.label] = (counts[T.label] || 0) + 1;
    }
    // conexiones por nombre (después de crear todo)
    const all = Object.keys(TYPES).flatMap(k => m[TYPES[k].key] || []);
    for (const { target, rels } of created) for (const rl of rels) { const o = all.find(x => norm(x.name) === norm(rl.name)); if (o && o !== target && !(target.relations ||= []).some(x => x.target === o.id)) target.relations.push({ target: o.id, kind: REL_KINDS.includes(rl.kind) ? rl.kind : 'otro', note: rl.note || '' }); }
    bg.querySelectorAll('[data-canon]').forEach(c => { if (!c.checked) return; const f = canon[+c.dataset.canon]; const old = m.canon.find(x => norm(x.entity) === norm(f.entity) && norm(x.attribute) === norm(f.attribute)); if (old) { old.value = f.value; if (f.since) old.since = Number(f.since) || old.since; counts['Fichas canon'] = (counts['Fichas canon'] || 0) + 1; return; } m.canon.push({ id: uid('k_'), entity: f.entity, attribute: f.attribute, value: f.value, since: Number(f.since) || '', note: 'De la biblia importada' }); counts['Fichas canon'] = (counts['Fichas canon'] || 0) + 1; });
    bg.querySelectorAll('[data-capi]').forEach(cb => { if (!cb.checked) return; const x = caps[+cb.dataset.capi]; const num = Number(x.number) || ((chapterList(m).at(-1)?.number || 0) + 1); let ch = chapterByNum(m, num); if (ch) { if (!ch.premise) ch.premise = x.premise || ''; if (!ch.title) ch.title = x.title || ''; } else { ch = newChapter(m, num, x.title || '', x.premise || ''); m.chapters.push(ch); } counts['Capítulos'] = (counts['Capítulos'] || 0) + 1; });
    const ex = [...bg.querySelectorAll('[data-ext]')].filter(cb => cb.checked).map(cb => extras[+cb.dataset.ext]); if (ex.length) { secs(m); ex.forEach(x => { if (full) { const same = (m.bible.sections || []).find(s => norm(s.title) === norm(x.title || 'Notas')); if (same) { same.text = String(x.text).trim(); if (x.icon) same.icon = x.icon; return; } } secAdd(m, { title: x.title || 'Notas', text: x.text, icon: x.icon }); }); counts['Secciones'] = ex.length; }
    if (srcText) { (m.bible.sources ||= []).push({ id: uid('doc_'), name: fname, text: srcText, at: Date.now() }); if (bg.querySelector('#ibMaster')?.checked) { const M = master(m); if (full) { M.text = srcText; M.from = fname; } else M.text = M.text.replace(/\s*$/, '') + `\n\n— AGREGADO DE “${fname}” (${new Date().toLocaleDateString('es-MX')}) —\n\n` + srcText; setTimeout(() => { mdSynced(m); touch(m); }, 0); counts[full ? 'Biblia base nueva' : 'Texto agregado a tu biblia'] = 1; } else counts['Versión guardada'] = 1; }
    const del = [...bg.querySelectorAll('[data-gone]')].filter(c => c.checked && full).map(c => gone[+c.dataset.gone]);
    for (const g of del) { const T = TYPES[g.t]; m[T.key] = m[T.key].filter(x => x.id !== g.e.id); for (const k of Object.keys(TYPES)) for (const o of m[TYPES[k].key] || []) if (o.relations) o.relations = o.relations.filter(r => r.target !== g.e.id); }
    if (del.length) counts['Quitados'] = del.length;
    if (!Object.keys(counts).length) return toast('No marcaste nada', 'err');
    if (m.sample) m.sampleTouched = true;
    (async () => { const k = 'gundo_' + m.id; const arr = (await IDB.get('kv', k)) || []; arr.push({ at: Date.now(), data: before }); while (arr.length > 5) arr.shift(); await IDB.put('kv', k, arr); })();
    (m.changeLog ||= []).unshift({ at: Date.now(), text: `Subí “${fname}” (${full ? 'biblia nueva completa' : 'solo agregar'})`, n: Object.values(counts).reduce((a, b) => a + b, 0) });
    touch(m); bg.close(); render();
    toast('Guardado ✔ (puedes deshacerlo con ↩️ Deshacer el último) · ' + Object.entries(counts).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · '), 'ok');
  };
}
