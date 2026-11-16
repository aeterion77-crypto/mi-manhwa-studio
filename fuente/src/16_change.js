/* =====================================================================
   🪄 CAMBIAR ALGO EN TODO MI MANHWA
   Le dices a Claude el cambio como en un chat ("Kael ahora tiene 19 años",
   "el maná ahora se llama aura", "Lira no muere en el cap 5") y la app busca
   TODO lo afectado: biblia, personajes, lugares, poderes, fichas canon,
   capítulos, texto escrito, versión novela, paneles y diálogos.
   Tú revisas cada cambio y lo apruebas. Se puede deshacer.
   ===================================================================== */
const GX_STOP = new Set('ahora este esta estos estas pero para como cuando donde porque sobre entre desde hasta tiene tienen ser será sera quiero cambia cambiar cambio todo todos toda todas también tambien solo más mas menos ella ellos ellas mismo misma capítulo capitulo cap personaje lugar poder historia manhwa biblia nuevo nueva hace hacer debe deben llama llamar'.split(' '));
function gxKeywords(m, q) {
  const words = new Set((q.match(/[\p{L}\d]{4,}/gu) || []).map(w => w.toLowerCase()).filter(w => !GX_STOP.has(w)));
  for (const k of Object.keys(TYPES)) for (const e of m[TYPES[k].key] || []) if (e.name && norm(q).includes(norm(e.name))) { words.add(e.name.toLowerCase()); (e.nickname || '').split(/[,\s]+/).filter(x => x.length > 2).forEach(x => words.add(x.toLowerCase())); }
  return [...words];
}
const gxHit = (txt, kw) => { const t = norm(txt || ''); return kw.some(k => t.includes(norm(k))); };
/* Todo lo editable del manhwa, con su "dirección" */
function gxFields(m) {
  const F = []; const add = (p, l, v, long = false) => { if (v != null && String(v).trim() !== '') F.push({ p, l, v: String(v), long }); };
  const b = m.bible; [['synopsis', 'Sinopsis'], ['plot', 'Trama completa'], ['rules', 'Reglas del mundo'], ['genre', 'Género'], ['tone', 'Tono']].forEach(([k, l]) => add('bible.' + k, 'Biblia · ' + l, b[k], k === 'plot'));
  for (const s of b.sections || []) { add(`sec.${s.id}.title`, `${s.icon} Sección · nombre`, s.title); add(`sec.${s.id}.text`, `${s.icon} ${s.title}`, s.text, s.text.length > 1500); }
  for (const t of Object.keys(TYPES)) { const T = TYPES[t]; for (const e of m[T.key] || []) for (const [k, l] of T.fields) if (!['loraId', 'loraWeight'].includes(k)) add(`ent.${e.id}.${k}`, `${T.icon} ${e.name} · ${l}`, e[k]); }
  for (const f of m.canon || []) { add(`canon.${f.id}.entity`, `📌 Ficha canon · quién`, f.entity); add(`canon.${f.id}.attribute`, `📌 ${f.entity} · atributo`, f.attribute); add(`canon.${f.id}.value`, `📌 ${f.entity} · ${f.attribute}`, f.value); add(`canon.${f.id}.note`, `📌 ${f.entity} · nota`, f.note); }
  for (const c of chapterList(m)) {
    const cl = `📖 Cap ${c.number}`;
    add(`cap.${c.id}.title`, cl + ' · Título', c.title); add(`cap.${c.id}.premise`, cl + ' · Idea', c.premise); add(`cap.${c.id}.summary`, cl + ' · Resumen', c.summary);
    add(`cap.${c.id}.story`, cl + ' · Texto escrito', c.story?.text, true); add(`cap.${c.id}.novel`, cl + ' · Versión novela', c.novel, true);
    (c.panels || []).forEach((p, i) => {
      const pl = `${cl} · Panel ${i + 1}`;
      add(`pan.${c.id}.${p.id}.description`, pl + ' · descripción', p.description); add(`pan.${c.id}.${p.id}.prompt_en`, pl + ' · prompt de imagen', p.prompt_en);
      add(`pan.${c.id}.${p.id}.characters`, pl + ' · personajes', (p.characters || []).join(', '));
      (p.dialogues || []).forEach((d, j) => { add(`pan.${c.id}.${p.id}.d${j}`, `${pl} · diálogo de ${d.who || '—'}`, d.text); add(`pan.${c.id}.${p.id}.w${j}`, `${pl} · quién habla`, d.who); });
    });
  }
  return F;
}
function gxGet(m, path) { return gxFields(m).find(f => f.p === path)?.v ?? ''; }
function gxSet(m, path, val) {
  const [kind, a, b, c] = path.split('.');
  if (kind === 'bible') { m.bible[a] = val; return true; }
  if (kind === 'sec') { const s = (m.bible.sections || []).find(x => x.id === a); if (!s) return false; s[b] = val; return true; }
  if (kind === 'ent') { const e = findEntity(m, a); if (!e) return false; const T = TYPES[findEntityType(m, a)]; const ty = T.fields.find(f => f[0] === b)?.[2]; e[b] = ty === 'num' ? (Number(val) || 0) : val; return true; }
  if (kind === 'canon') { const f = m.canon.find(x => x.id === a); if (!f) return false; f[b] = val; return true; }
  const ch = chapterById(m, a); if (!ch) return false;
  if (kind === 'cap') { if (b === 'story') story(ch).text = val; else ch[b] = val; return true; }
  if (kind === 'pan') {
    const p = ch.panels.find(x => x.id === b); if (!p) return false;
    if (c === 'characters') p.characters = val.split(',').map(s => s.trim()).filter(Boolean);
    else if (/^[dw]\d+$/.test(c)) { const d = p.dialogues[+c.slice(1)]; if (!d) return false; d[c[0] === 'd' ? 'text' : 'who'] = val; }
    else p[c] = val;
    p.approved = false; return true;
  }
  return false;
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = w => new RegExp(`(?<![\\p{L}\\d])${reEsc(w)}(?![\\p{L}\\d])`, 'gu');
/* el pedido para Claude: lo estructurado completo + lo largo solo donde se menciona */
function gxPrompt(m, q) {
  const kw = gxKeywords(m, q); let size = 0; const L = [];
  for (const f of gxFields(m)) {
    if (f.long) {
      const paras = f.v.split(/\n\s*\n/); const hits = paras.map((t, i) => [i, t]).filter(([, t]) => gxHit(t, kw));
      if (!hits.length) continue; const chunk = hits.slice(0, 25).map(([i, t]) => `  [párrafo ${i + 1}] ${t.slice(0, 1500)}`).join('\n');
      if (size + chunk.length > 140000) continue; L.push(`${f.p} | ${f.l} (solo los párrafos que mencionan el tema; usa "replace"):\n${chunk}`); size += chunk.length;
    } else {
      if (f.p.startsWith('pan.') && !gxHit(f.v, kw)) continue;
      const line = `${f.p} | ${f.l} = ${f.v.slice(0, 2000)}`; if (size + line.length > 160000) continue; L.push(line); size += line.length;
    }
  }
  return `Eres el editor de continuidad del manhwa "${m.name}". El autor quiere hacer este CAMBIO en su historia:
«${q}»

Encuentra TODO lo que hay que modificar para que el cambio quede igual en todos lados (biblia, fichas de personajes/lugares/poderes, fichas canon, capítulos, texto escrito, versión novela, paneles, diálogos, prompts de imagen en inglés) y propón cada modificación. Cambia SOLO lo necesario y conserva el estilo del autor. No inventes cosas que el autor no pidió. Si el cambio contradice algo importante o hay algo que no queda claro, dilo en "dudas".

AQUÍ ESTÁ TODO LO QUE TIENE EL MANHWA (formato: dirección | qué es = valor):
${L.join('\n')}

Operaciones posibles:
- {"path":"dirección","op":"set","value":"nuevo valor completo","why":"motivo corto"}  → para campos cortos
- {"path":"dirección","op":"replace","find":"texto EXACTO que existe en ese campo","replace":"texto nuevo","why":""}  → para textos largos (copia "find" exacto)
- {"op":"rename","from":"palabra o nombre exacto","to":"nuevo","why":""}  → si es un cambio de nombre o palabra que debe cambiar en TODO el manhwa (la app lo cambia en todos lados, incluso donde no te mostré)
- {"op":"canon","entity":"quién","attribute":"atributo","value":"valor","why":""}  → nueva ficha canon si el cambio es un hecho fijo importante

Responde SOLO con JSON:
{"entendi":"qué entendiste del cambio, 1 frase","cambios":[…],"dudas":"vacío si no hay"}`;
}
/* rename: cuántos lugares lo tienen */
function gxRenameHits(m, from) { const re = wordRe(from); return gxFields(m).filter(f => { re.lastIndex = 0; return re.test(f.v); }); }
async function gxSnapshot(m) { const k = 'gundo_' + m.id; const arr = (await IDB.get('kv', k)) || []; arr.push({ at: Date.now(), data: JSON.stringify(m) }); while (arr.length > 5) arr.shift(); await IDB.put('kv', k, arr); }
ACT.gxRun = async el => {
  const m = cur(); const q = ($('#gxQ')?.value || '').trim();
  if (q.length < 4) return toast('Escribe el cambio que quieres, como si me lo dijeras en el chat', 'err');
  let r; await busy(el, async () => { r = await aiJSON(gxPrompt(m, q), { max_tokens: 16000, temperature: 0.2, title: 'Cambiar en todo mi manhwa' }); }, 'Buscando en todo…');
  if (!r) return; gxReview(m, q, r);
};
function gxReview(m, q, r) {
  const items = [];
  for (const x of r.cambios || []) {
    if (x.op === 'rename' && x.from && x.to && x.from !== x.to) { const hits = gxRenameHits(m, x.from); if (hits.length) items.push({ ...x, label: `🔁 Cambiar “${x.from}” por “${x.to}” en TODO`, list: true, before: hits.slice(0, 6).map(h => h.l).join(' · ') + (hits.length > 6 ? ` · y ${hits.length - 6} más` : ''), after: `${hits.length} lugares` }); continue; }
    if (x.op === 'canon' && x.entity && x.attribute) { items.push({ ...x, label: `📌 Nueva ficha canon: ${x.entity} · ${x.attribute}`, before: '—', after: x.value }); continue; }
    const f = gxFields(m).find(ff => ff.p === x.path); if (!f) continue;
    if (x.op === 'replace') { if (!x.find || !f.v.includes(x.find) || x.find === x.replace) continue; items.push({ ...x, label: f.l, before: x.find, after: x.replace }); }
    else if (x.op === 'set') { if (String(x.value ?? '') === f.v) continue; items.push({ ...x, label: f.l, before: f.v, after: String(x.value ?? '') }); }
  }
  const cut = s => esc(String(s).length > 400 ? String(s).slice(0, 400) + '…' : s);
  const bg = modal(`<h2>🪄 Cambios para: “${esc(q)}”</h2>
    ${r.entendi ? `<p class="small"><b>Entendí:</b> ${esc(r.entendi)}</p>` : ''}
    ${r.dudas ? `<div class="alert warn small"><div><b>Ojo:</b> ${esc(r.dudas)}</div></div>` : ''}
    ${items.length ? `<p class="small muted">${items.length} cambios. Desmarca los que no quieras. Los paneles que cambien quedan sin aprobar para que los revises antes de dibujarlos otra vez.</p>
    <div style="max-height:58vh;overflow:auto">${items.map((it, i) => `<label class="row nw gxrow" style="align-items:flex-start;border-top:1px solid var(--line);padding:8px 0"><input type="checkbox" data-g="${i}" checked style="margin-top:4px"><div class="grow small"><b>${esc(it.label)}</b>${it.why ? ` <span class="tiny dim">· ${esc(it.why)}</span>` : ''}
      ${it.list ? `<div class="tiny muted" style="margin-top:4px">📍 ${cut(it.before)} → <b>${cut(it.after)}</b></div>` : `<div class="gxdiff"><div class="gxb">${cut(it.before)}</div><div class="gxa">${cut(it.after)}</div></div>`}</div></label>`).join('')}</div>`
      : '<div class="alert info"><div>Claude no encontró nada que cambiar. Intenta decirlo de otra forma o con más detalle.</div></div>'}
    <div class="acts"><button data-x="no">Cancelar</button>${items.length ? '<button class="pri" data-x="ok">✔ HACER LOS CAMBIOS MARCADOS</button>' : ''}</div>`, { wide: true });
  bg.querySelector('[data-x=no]').onclick = () => bg.remove();
  const ok = bg.querySelector('[data-x=ok]'); if (!ok) return;
  ok.onclick = async () => {
    const sel = [...bg.querySelectorAll('[data-g]')].filter(c => c.checked).map(c => items[+c.dataset.g]); if (!sel.length) return toast('No marcaste ningún cambio', 'err');
    await gxSnapshot(m); let n = 0; const touched = new Set();
    for (const it of sel) {
      if (it.op === 'rename') { const re = wordRe(it.from); for (const f of gxFields(m)) { re.lastIndex = 0; if (re.test(f.v)) { re.lastIndex = 0; if (gxSet(m, f.p, f.v.replace(re, it.to))) { n++; touched.add(f.p); } } } continue; }
      if (it.op === 'canon') { m.canon.push({ id: uid('k_'), entity: it.entity, attribute: it.attribute, value: it.value, since: '', note: 'Por cambio: ' + q.slice(0, 80) }); n++; continue; }
      const cur0 = gxGet(m, it.path);
      if (it.op === 'replace') { if (cur0.includes(it.find)) { gxSet(m, it.path, cur0.split(it.find).join(it.replace)); n++; touched.add(it.path); } }
      else if (gxSet(m, it.path, it.after)) { n++; touched.add(it.path); }
    }
    const pans = [...touched].filter(p => p.startsWith('pan.')).map(p => p.split('.').slice(1, 3).join('.')); const withImg = new Set(pans.filter(k => { const [c, p] = k.split('.'); return chapterById(m, c)?.panels.find(x => x.id === p)?.imageId; }));
    (m.changeLog ||= []).unshift({ at: Date.now(), text: q, n }); m.changeLog = m.changeLog.slice(0, 30);
    touch(m); bg.remove(); const qi = $('#gxQ'); if (qi) qi.value = ''; render();
    toast(`🪄 Listo: ${n} cambios hechos en todo tu manhwa.${withImg.size ? ` ${withImg.size} paneles que ya tenían imagen quedaron sin aprobar (revísalos y vuelve a dibujarlos si quieres).` : ''} Puedes deshacerlo.`, 'ok');
  };
}
ACT.gxUndo = async () => {
  const m = cur(); const k = 'gundo_' + m.id; const arr = (await IDB.get('kv', k)) || []; const last = arr.pop();
  if (!last) return toast('No hay cambios para deshacer', 'err');
  if (!await confirmBox(`¿Deshacer el último cambio global (${fmtDate(last.at)})? Todo el manhwa regresa a como estaba antes de ese cambio.`, { ok: 'Deshacer', danger: false })) return;
  const snap = JSON.parse(last.data); for (const key of Object.keys(m)) delete m[key]; Object.assign(m, snap); await IDB.put('kv', k, arr); touch(m); render(); toast('↩️ Deshecho', 'ok');
};
function gxHTML(m) {
  const log = m.changeLog || [];
  return `<div class="panelbox" style="margin-bottom:16px;border-color:var(--neon)">
    <h2 style="margin-top:0">🪄 Cambiar algo en todo mi manhwa</h2>
    <p class="small muted">Escríbelo como en el chat. Claude busca dónde aparece en tu biblia, personajes, lugares, poderes, fichas canon, capítulos, texto, versión novela, paneles y diálogos, y te muestra cada cambio para que lo apruebes.</p>
    <textarea id="gxQ" style="min-height:80px" placeholder="Ej. “Kael ahora tiene 19 años y sus ojos son dorados”, “el maná ahora se llama aura”, “Lira no muere en el cap 5, solo queda herida”, “la Academia Umbra ahora se llama Academia Noctis”"></textarea>
    <div class="row" style="margin-top:8px"><button class="pri" data-a="gxRun">🪄 Hacer el cambio en todos lados</button><button data-a="gxUndo">↩️ Deshacer el último</button></div>
    ${log.length ? `<details style="margin-top:8px"><summary class="small muted">Cambios que has hecho (${log.length})</summary>${log.map(x => `<div class="small" style="padding:4px 0;border-top:1px solid var(--line)">${fmtDate(x.at)} · ${esc(x.text)} <span class="muted">(${x.n} cambios)</span></div>`).join('')}</details>` : ''}
  </div>`;
}

/* documentos originales guardados */
ACT.srcView = el => { const d = cur().bible.sources.find(x => x.id === el.dataset.id); const bg = modal(`<h2>📄 ${esc(d.name)}</h2><div style="white-space:pre-wrap;max-height:65vh;overflow:auto;font-family:Georgia,serif;line-height:1.6">${esc(d.text)}</div><div class="acts"><button class="pri" data-x="ok">Cerrar</button></div>`, { wide: true }); bg.querySelector('[data-x=ok]').onclick = () => bg.remove(); };
ACT.srcDl = el => { const d = cur().bible.sources.find(x => x.id === el.dataset.id); downloadBlob(new Blob([d.text], { type: 'text/plain;charset=utf-8' }), fileSafe(d.name.replace(/\.[a-z0-9]+$/i, '')) + ' (original).txt'); };
ACT.srcDel = async el => { const m = cur(); if (!await confirmBox('¿Borrar este documento original? (lo que ya se acomodó en tu Biblia no se borra)', { ok: 'Borrar' })) return; m.bible.sources = m.bible.sources.filter(x => x.id !== el.dataset.id); touch(m); render(); };
