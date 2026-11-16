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
  return await file.text();
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
 "canon": [{"entity":"quién o qué","attribute":"atributo corto (cicatriz, color de ojos, edad, estado…)","value":"valor","since":número de capítulo o null}]
}
En "canon" pon solo hechos físicos o fijos importantes que no deben cambiar (marcas, colores, edades, quién murió y en qué capítulo, etc.).

DOCUMENTO:
${text}`;
}
function splitDoc(text, max) { if (text.length <= max) return [text]; const out = []; let i = 0; while (i < text.length) { let e = Math.min(text.length, i + max); if (e < text.length) { const p = text.lastIndexOf('\n\n', e); if (p > i + max * 0.5) e = p; } out.push(text.slice(i, e)); i = e; } return out; }
function mergeImport(a, b) {
  const out = { bible: { ...a.bible }, canon: [...(a.canon || []), ...(b.canon || [])] };
  for (const [k, v] of Object.entries(b.bible || {})) if (v) out.bible[k] = out.bible[k] && out.bible[k] !== v ? out.bible[k] + '\n\n' + v : v;
  for (const key of ['characters', 'places', 'powers', 'objects', 'factions', 'timeline']) {
    const list = [...(a[key] || [])];
    for (const e of b[key] || []) { const same = list.find(x => norm(x.name) === norm(e.name)); if (same) { for (const [k, v] of Object.entries(e)) if (v && !same[k]) same[k] = v; if (e.relations) same.relations = [...(same.relations || []), ...e.relations]; } else list.push(e); }
    out[key] = list;
  }
  return out;
}
ACT.importBible = async () => {
  const m = cur();
  const [file] = await pickFiles({ multiple: false, accept: '.docx,.pdf,.txt,.md,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain' });
  if (!file) return;
  let text = '';
  try { toast('Leyendo tu documento…'); text = (await readDocText(file)).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(); } catch (e) { return toast(e.message, 'err'); }
  if (text.length < 30) return toast('No encontré texto en ese archivo (si es un PDF escaneado, no tiene texto que leer).', 'err');
  const max = isPremium() ? 150000 : 90000; const parts = splitDoc(text, max);
  const chars = text.length;
  if (!isPremium() && !await confirmCost('Importar mi biblia', [aiLine(chars + 2500 * parts.length, Math.min(30000, Math.round(chars / 3)), 30000 * parts.length, `Leer “${file.name}” (${Math.round(chars / 1000)}k caracteres${parts.length > 1 ? ', ' + parts.length + ' partes' : ''})`)])) return;
  const btn = $('[data-a=importBible]');
  await busy(btn, async () => {
    let res = { bible: {}, characters: [], places: [], powers: [], objects: [], factions: [], timeline: [], canon: [] };
    for (let i = 0; i < parts.length; i++) {
      if (btn) btn.innerHTML = `<span class="spin"></span> Leyendo ${parts.length > 1 ? `parte ${i + 1}/${parts.length}` : 'tu biblia'}…`;
      const r = await aiJSON(importPrompt(m, parts[i], i + 1, parts.length), { max_tokens: 32000, temperature: 0.1, confirmed: true, title: parts.length > 1 ? `Importar biblia (parte ${i + 1} de ${parts.length})` : 'Importar mi biblia' });
      res = mergeImport(res, r);
    }
    showImportReview(m, res, file.name);
  }, 'Leyendo…');
};
const IMPORT_SECTIONS = [['characters', 'personajes'], ['places', 'lugares'], ['powers', 'poderes'], ['objects', 'objetos'], ['factions', 'facciones'], ['timeline', 'historia']];
function showImportReview(m, res, fname) {
  const rows = []; // {sec, t, e, dupe, mode}
  for (const [key, t] of IMPORT_SECTIONS) for (const e of res[key] || []) { if (!e?.name) continue; const dupe = (m[TYPES[t].key] || []).find(x => norm(x.name) === norm(e.name)); rows.push({ key, t, e, dupe, mode: dupe ? 'merge' : 'new' }); }
  const canon = (res.canon || []).filter(f => f.entity && f.attribute && f.value).map(f => ({ ...f, dupe: m.canon.some(c => norm(c.entity) === norm(f.entity) && norm(c.attribute) === norm(f.attribute)) }));
  const bibleF = [['synopsis', 'Sinopsis'], ['plot', 'Trama completa'], ['rules', 'Reglas del mundo'], ['genre', 'Género'], ['tone', 'Tono']].filter(([k]) => (res.bible || {})[k]);
  const sum = IMPORT_SECTIONS.map(([key, t]) => [TYPES[t], rows.filter(r => r.key === key).length]).filter(x => x[1]);
  const bg = modal(`<h2>📄 Esto encontré en “${esc(fname)}”</h2>
    <div class="row">${sum.map(([T, n]) => `<span class="chip neon">${T.icon} ${n} ${T.label.toLowerCase()}</span>`).join('')}${canon.length ? `<span class="chip">📌 ${canon.length} fichas canon</span>` : ''}${bibleF.length ? `<span class="chip">🧠 ${bibleF.length} partes de la Biblia</span>` : ''}</div>
    <p class="small muted">Nada se guarda hasta que tú lo apruebes. Desmarca lo que no quieras. Si algo ya existe, elige si completarlo, reemplazarlo u omitirlo.</p>
    <div class="col" style="gap:10px;max-height:56vh;overflow:auto">
      ${bibleF.length ? `<div class="panelbox"><h3>🧠 Biblia</h3>${bibleF.map(([k, l]) => `<label class="row nw small"><input type="checkbox" data-bib="${k}" checked><div class="grow"><b>${l}</b>${m.bible[k] ? ' <span class="chip warn">ya tienes texto: se agrega al final</span>' : ''}<div class="muted">${esc(String(res.bible[k]).slice(0, 220))}${String(res.bible[k]).length > 220 ? '…' : ''}</div></div></label>`).join('')}</div>` : ''}
      ${IMPORT_SECTIONS.map(([key, t]) => { const rs = rows.filter(r => r.key === key); if (!rs.length) return ''; const T = TYPES[t];
        return `<div class="panelbox"><div class="row between"><h3>${T.icon} ${T.label} (${rs.length})</h3><button class="sm ghost" data-allsec="${key}">Marcar / desmarcar todos</button></div>${rs.map(r => { const i = rows.indexOf(r); const sub = entSub(t, r.e); return `<div class="row nw between small" style="border-top:1px solid var(--line);padding-top:6px"><label class="row nw grow"><input type="checkbox" data-row="${i}" data-sec="${key}" checked><div><b>${esc(r.e.name)}</b> <span class="muted">${esc(sub.slice(0, 120))}</span></div></label>${r.dupe ? `<select data-mode="${i}" style="width:auto;min-height:34px;padding:4px 8px"><option value="merge">Ya existe → completar lo vacío</option><option value="replace">Ya existe → reemplazar</option><option value="new">Crear otro aparte</option></select>` : '<span class="chip ok">nuevo</span>'}</div>`; }).join('')}</div>`; }).join('')}
      ${canon.length ? `<div class="panelbox"><h3>📌 Fichas canon (${canon.length})</h3>${canon.map((f, i) => `<label class="row nw small"><input type="checkbox" data-canon="${i}" ${f.dupe ? '' : 'checked'}><span>${esc(f.entity)} · ${esc(f.attribute)} · <b>${esc(f.value)}</b>${f.since ? ' · desde Cap ' + esc(f.since) : ''}${f.dupe ? ' <span class="chip warn">ya tienes ese dato</span>' : ''}</span></label>`).join('')}</div>` : ''}
    </div>
    <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="ok">✔ GUARDAR LO MARCADO</button></div>`, { wide: true });
  bg.querySelectorAll('[data-allsec]').forEach(b => b.onclick = () => { const cbs = [...bg.querySelectorAll(`[data-sec="${b.dataset.allsec}"]`)]; const on = !cbs.every(c => c.checked); cbs.forEach(c => c.checked = on); });
  bg.querySelectorAll('[data-mode]').forEach(s => s.onchange = () => rows[+s.dataset.mode].mode = s.value);
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=ok]').onclick = () => {
    const counts = {}; const created = [];
    bg.querySelectorAll('[data-bib]').forEach(c => { if (!c.checked) return; const k = c.dataset.bib; const v = String(res.bible[k]).trim(); m.bible[k] = m.bible[k] && ['synopsis', 'plot', 'rules'].includes(k) ? m.bible[k] + '\n\n' + v : v; counts['Biblia'] = (counts['Biblia'] || 0) + 1; });
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
    bg.querySelectorAll('[data-canon]').forEach(c => { if (!c.checked) return; const f = canon[+c.dataset.canon]; m.canon.push({ id: uid('k_'), entity: f.entity, attribute: f.attribute, value: f.value, since: Number(f.since) || '', note: 'De la biblia importada' }); counts['Fichas canon'] = (counts['Fichas canon'] || 0) + 1; });
    if (!Object.keys(counts).length) return toast('No marcaste nada', 'err');
    if (m.sample) m.sampleTouched = true;
    touch(m); bg.close(); render();
    toast('Guardado ✔ ' + Object.entries(counts).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · '), 'ok');
  };
}
