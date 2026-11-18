/* =====================================================================
   📜 MI BIBLIA BASE (el documento maestro)
   Tu documento de biblia es la BASE. Lo editas aquí como un documento
   normal; lo que cambies o agregues se reparte desde aquí a todo el
   manhwa (fichas, canon, secciones, capítulos, paneles…).
   El 🪄 también escribe primero en este documento.
   Y si cambias algo directo en una ficha, la app te ofrece pasarlo
   al documento para que tu biblia siempre esté al día.
   ===================================================================== */
function composeDoc(m) {
  const b = m.bible; const L = [m.name.toUpperCase(), ''];
  const kv = (o, fields) => fields.filter(([k]) => o[k] != null && String(o[k]).trim()).map(([k, l]) => `${l}: ${o[k]}`);
  L.push('HISTORIA', ...kv(b, [['genre', 'Género'], ['tone', 'Tono'], ['synopsis', 'Sinopsis'], ['plot', 'Trama'], ['rules', 'Reglas del mundo']]), '');
  for (const [t, T] of Object.entries(TYPES)) { const arr = m[T.key] || []; if (!arr.length) continue; L.push(T.label.toUpperCase(), ''); for (const e of arr) L.push(e.name, ...kv(e, T.fields.filter(([k]) => !['name', 'loraId', 'loraWeight'].includes(k))), ''); }
  if (m.canon.length) L.push('FICHAS CANON', ...m.canon.map(f => `${f.entity} · ${f.attribute}: ${f.value}${f.since ? ' (desde cap ' + f.since + ')' : ''}`), '');
  for (const s of b.sections || []) L.push(s.title.toUpperCase(), s.text, '');
  const caps = chapterList(m).filter(c => c.title || c.premise); if (caps.length) L.push('CAPÍTULOS', ...caps.map(c => `Capítulo ${c.number}${c.title ? ': ' + c.title : ''}${c.premise ? '\n' + c.premise : ''}`), '');
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/* "foto" de las fichas para saber qué cambiaste fuera del documento */
function fieldsSnap(m) { const o = {}; for (const f of gxFields(m)) if (!f.p.startsWith('doc.') && !f.p.startsWith('pan.') && !/\.(story|novel)$/.test(f.p)) o[f.p] = [f.l, f.v]; return o; }
function master(m) {
  const b = m.bible;
  if (!b.master) {
    const src = (b.sources || []).at(-1);
    const text = src ? src.text : composeDoc(m);
    b.master = { text, syncedText: text, snap: null, at: Date.now(), from: src ? src.name : 'generado' };
    b.master.snap = fieldsSnap(m);
  }
  return b.master;
}
const mdSynced = m => { const M = master(m); M.syncedText = M.text; M.snap = fieldsSnap(m); M.at = Date.now(); };
/* ---------- diferencias por líneas ---------- */
function lineDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n'); let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let ea = A.length, eb = B.length; while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
  const a2 = A.slice(s, ea), b2 = B.slice(s, eb); const n = a2.length, mm = b2.length; const hunks = [];
  if (!n && !mm) return [];
  if (n * mm > 4e6) return [{ before: a2.join('\n'), after: b2.join('\n'), ctx: A[s - 1] || '' }];
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(mm + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = mm - 1; j >= 0; j--) dp[i][j] = a2[i] === b2[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, cur = null; const flush = () => { if (cur && (cur.b.length || cur.a.length)) hunks.push({ before: cur.b.join('\n'), after: cur.a.join('\n'), ctx: cur.ctx }); cur = null; };
  while (i < n || j < mm) {
    if (i < n && j < mm && a2[i] === b2[j]) { flush(); i++; j++; continue; }
    cur ||= { b: [], a: [], ctx: (j > 0 ? b2[j - 1] : A[s - 1]) || '' };
    if (j < mm && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) cur.a.push(b2[j++]); else cur.b.push(a2[i++]);
  }
  flush(); return hunks.filter(h => (h.before + h.after).trim());
}
function snapDiff(m) { const M = master(m); const now = fieldsSnap(m); const old = M.snap || {}; const out = [];
  for (const [p, [l, v]] of Object.entries(now)) { const o = old[p]?.[1]; if (o !== v) out.push({ l, before: o ?? '', after: v }); }
  for (const [p, [l, v]] of Object.entries(old)) if (!(p in now)) out.push({ l, before: v, after: '(borrado)' });
  return out;
}
/* ---------- la página ---------- */
function masterHTML(m) {
  const M = master(m); const pend = M.text !== M.syncedText ? lineDiff(M.syncedText, M.text).length : 0; const outside = snapDiff(m);
  const words = M.text.split(/\s+/).filter(Boolean).length;
  return `<div class="mdbar">
      <div id="mdPend">${pend ? `<div class="alert warn"><div class="grow">✏️ Cambiaste <b>${plural(pend, 'parte', 'partes')}</b> de tu biblia que todavía no se reparten al resto del manhwa.</div><button class="pri" data-a="mdSync">🔄 Repartir a todo mi manhwa</button></div>` : `<div class="alert ok small"><div>✔ Tu biblia y todo tu manhwa están al día.</div></div>`}</div>
      ${outside.length ? `<div class="alert info"><div class="grow">🗂️ Cambiaste <b>${plural(outside.length, 'cosa', 'cosas')}</b> directo en las fichas que todavía no están en este documento <span class="tiny dim">(${esc(outside.slice(0, 3).map(x => x.l).join(' · '))}${outside.length > 3 ? '…' : ''})</span>.</div><button data-a="mdPull">📥 Ponerlas en mi biblia</button></div>` : ''}
    </div>
    <div class="row between small muted" style="margin:6px 0"><span>📜 ${esc(M.from === 'generado' ? 'Creada con lo que tenías en la app' : 'Tu documento: ' + M.from)} · ${words.toLocaleString('es')} palabras · se guarda mientras escribes</span>
      <span class="row nw"><input id="mdFind" placeholder="🔎 Buscar" style="width:170px"><span id="mdFindN" class="tiny"></span></span></span></div>
    <div class="docpage" style="max-width:none"><textarea id="mdText" class="docf big mdtext" spellcheck="true" ${bindAttr(M, 'text')}>${esc(M.text)}</textarea></div>
    <div class="row" style="margin-top:10px"><button class="pri" data-a="mdSync" ${pend ? '' : 'disabled'}>🔄 Repartir mis cambios a todo</button><button data-a="dlMaster">⬇ Descargar mi biblia (Word)</button><button data-a="mdRebuild">🧱 Rehacer el documento con lo que tiene la app</button></div>`;
}
function mdMount() {
  if (Route.view !== 'bibliadoc' || (Route.a && Route.a !== 'base')) return;
  const t = $('#mdText'); if (!t) return; const m = cur(); const M = master(m); docGrow(t);
  let tm; t.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { const pend = M.text !== M.syncedText ? lineDiff(M.syncedText, M.text).length : 0; const el = $('#mdPend'); if (el) el.innerHTML = pend ? `<div class="alert warn"><div class="grow">✏️ Cambiaste <b>${plural(pend, 'parte', 'partes')}</b> de tu biblia que todavía no se reparten al resto del manhwa.</div><button class="pri" data-a="mdSync">🔄 Repartir a todo mi manhwa</button></div>` : '<div class="alert ok small"><div>✔ Tu biblia y todo tu manhwa están al día.</div></div>'; $$('[data-a=mdSync]').forEach(b => b.disabled = !pend); }, 700); });
  const f = $('#mdFind'); let pos = 0;
  if (f) { f.oninput = () => { pos = 0; find(false); }; f.onkeydown = e => { if (e.key === 'Enter') find(true); }; if (window.__docFindQ) { f.value = window.__docFindQ; window.__docFindQ = null; setTimeout(() => find(false), 150); } }
  function find(next) { const q = norm(f.value.trim()); if (q.length < 2) { $('#mdFindN').textContent = ''; return; } const hay = norm(t.value); const all = []; let i = hay.indexOf(q); while (i >= 0) { all.push(i); i = hay.indexOf(q, i + 1); } $('#mdFindN').textContent = all.length ? `${all.length} · Enter = siguiente` : 'no aparece'; if (!all.length) return; if (next) pos = (pos + 1) % all.length; const at = all[pos]; t.focus(); t.setSelectionRange(at, at + q.length); const lh = 26; const line = t.value.slice(0, at).split('\n').length; window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY + line * lh - 200, behavior: 'smooth' }); f.focus(); }
}
/* ---------- 🔄 documento → todo el manhwa ---------- */
ACT.mdSync = async el => {
  const m = cur(); const M = master(m); const hunks = lineDiff(M.syncedText, M.text);
  if (!hunks.length) { mdSynced(m); touch(m); render(); return toast('No hay cambios que repartir ✔', 'ok'); }
  const q = 'CAMBIÉ MI BIBLIA BASE ASÍ (reparte estos cambios a todo el manhwa; el documento ya está cambiado, NO lo toques):\n' + hunks.slice(0, 60).map((h, i) => `${i + 1}) ${h.ctx ? '[después de: «' + h.ctx.slice(0, 80) + '»] ' : ''}${h.before ? 'ANTES: «' + h.before.slice(0, 3000) + '»' : 'ANTES: (no existía)'}\n   AHORA: «${h.after.slice(0, 3000) || '(lo borré)'}»`).join('\n');
  let r; await busy(el, async () => { r = await aiJSON(gxPrompt(m, q, { noDoc: true }), { max_tokens: 16000, temperature: 0.2, title: 'Repartir mi biblia a todo', estOut: 4000 }); }, 'Repartiendo…');
  if (!r) return; gxReview(m, 'Repartir cambios de mi biblia', r, { noDoc: true, after: () => { mdSynced(m); } });
};
/* ---------- 📥 fichas → documento ---------- */
ACT.mdPull = async el => {
  const m = cur(); const M = master(m); const ch = snapDiff(m); if (!ch.length) return;
  const heads = docHeads(M.text);
  let r; await busy(el, async () => { r = await aiJSON(mdPullPrompt(m, ch), { max_tokens: 12000, temperature: 0.2, title: 'Pasar cambios a mi biblia' }); }, 'Escribiendo en tu biblia…');
  if (!r) return; gxReview(m, 'Pasar a mi biblia lo que cambié en las fichas', r, { onlyDoc: true, after: () => { M.snap = fieldsSnap(m); M.syncedText = M.text; } });
};
function mdPullPrompt(m, ch) { const M = master(m); const heads = docHeads(M.text); return `Eres el editor del documento de la biblia de "${m.name}". El autor cambió estas cosas en su manhwa y ahora hay que ESCRIBIRLAS EN SU DOCUMENTO DE LA BIBLIA para que esté al día. Respeta su forma de escribir y ponlas en la parte que corresponde.

CAMBIOS EN LAS FICHAS:
${ch.slice(0, 80).map(x => `- ${x.l}: «${String(x.before).slice(0, 600)}» → «${String(x.after).slice(0, 1500)}»`).join('\n')}

TÍTULOS Y PARTES DE SU DOCUMENTO:
${heads.join('\n')}

PÁRRAFOS DEL DOCUMENTO QUE TIENEN QUE VER:
${docParas(M.text, ch.map(x => x.l + ' ' + x.before + ' ' + x.after).join(' '), m).slice(0, 60000)}

Operaciones (solo sobre el documento):
- {"op":"doc_replace","find":"texto EXACTO del documento","replace":"texto nuevo","why":""}
- {"op":"doc_insert","after":"texto EXACTO del documento (por ej. el título de la parte) después del cual va","text":"lo nuevo","why":""}
Responde SOLO JSON: {"entendi":"","cambios":[…],"dudas":""}`; }
/* si un cambio llegó a las fichas pero no a la biblia, se escribe en la biblia sí o sí */
async function mdAutoWrite(m) {
  const ch = snapDiff(m); if (!ch.length) return 0;
  const tt = toast('📜 Escribiendo el cambio en tu biblia…');
  let r; try { r = await aiJSON(mdPullPrompt(m, ch), { max_tokens: 12000, temperature: 0.2, title: 'Escribir el cambio en mi biblia' }); } catch (e) { toast('No pude escribirlo en tu biblia: ' + e.message + '. Abre tu biblia y toca “Ponerlas en mi biblia”.', 'err'); return 0; }
  let n = 0; for (const x of r?.cambios || []) if ((x.op === 'doc_replace' || x.op === 'doc_insert') && docApply(m, x)) n++;
  if (!n) { const M = master(m); M.text = M.text.replace(/\s*$/, '') + '\n\n' + ch.map(x => `${x.l}: ${x.after}`).join('\n'); n = 1; }
  return n;
}
ACT.mdRebuild = async () => { const m = cur(); const M = master(m); if (!await confirmBox('Esto escribe tu biblia de nuevo usando lo que tiene la app (fichas, secciones, capítulos). Tu documento actual se guarda en “Versiones que subiste”. ¿Seguir?', { ok: 'Rehacer', danger: false })) return; (m.bible.sources ||= []).push({ id: uid('doc_'), name: 'Respaldo antes de rehacer', text: M.text, at: Date.now() }); M.text = composeDoc(m); M.from = 'generado'; mdSynced(m); touch(m); render(); toast('📜 Documento rehecho', 'ok'); };
ACT.dlMaster = async el => { const m = cur(); const M = master(m); await busy(el, async () => { await docxLib(); const { P, H } = D(); const blocks = M.text.split('\n').map(l => { const t = l.trim(); if (!t) return P(''); if (isHead(t)) return H(t.replace(/^#+\s*/, ''), t === t.toUpperCase() ? 1 : 2); return P(t.replace(/^[-•*]\s+/, '• ')); }); downloadBlob(await makeDocx('Biblia - ' + m.name, blocks), `Biblia - ${fileSafe(m.name)}.docx`); toast('📜 Tu biblia descargada en Word ✔', 'ok'); }, 'Creando Word…'); };
const isHead = t => /^#+\s/.test(t) || (t.length < 70 && !/[.,;:]$/.test(t) && (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) || /^(cap[ií]tulo|parte|libro|arco|acto)\b/i.test(t)));
function docHeads(text) { return text.split('\n').map(l => l.trim()).filter(isHead).slice(0, 200); }
function docParas(text, about, m) { const kw = gxKeywords(m, about); const P = text.split(/\n\s*\n/); return P.filter(p => gxHit(p, kw)).slice(0, 40).map(p => '«' + p.slice(0, 1500) + '»').join('\n'); }
/* aplicar operaciones sobre el documento */
function docApply(m, it) {
  const M = master(m);
  if (it.op === 'doc_replace') { if (!it.find || !M.text.includes(it.find)) return false; M.text = M.text.split(it.find).join(it.replace ?? ''); return true; }
  if (it.op === 'doc_insert') { const add = String(it.text || '').trim(); if (!add) return false; const anc = String(it.anchor ?? it.after ?? ''); it = { ...it, after: anc }; let i = anc ? M.text.indexOf(anc) : -1;
    if (i < 0) { M.text = M.text.replace(/\s*$/, '') + '\n\n' + add; return true; }
    let end = M.text.indexOf('\n\n', i + it.after.length); const lineEnd = M.text.indexOf('\n', i + it.after.length);
    if (isHead(it.after.trim()) && lineEnd >= 0) { let k = lineEnd; const nextHead = M.text.slice(lineEnd + 1).split('\n').findIndex(l => isHead(l.trim())); if (nextHead >= 0) { const lines = M.text.slice(lineEnd + 1).split('\n').slice(0, nextHead); k = lineEnd + 1 + lines.join('\n').length; } else k = M.text.length; M.text = M.text.slice(0, k).replace(/\s*$/, '') + '\n\n' + add + '\n' + M.text.slice(k).replace(/^\n*/, '\n'); return true; }
    if (end < 0) end = M.text.length; M.text = M.text.slice(0, end) + '\n' + add + M.text.slice(end); return true; }
  return false;
}
