/* =====================================================================
   ✍️ ESCRIBIR CON CLAUDE (estilo NovelAI)
   Tú escribes y Claude continúa, te da ideas, reescribe lo que marques
   y te corrige. Claude conoce todo el cerebro del manhwa. Después lo
   conviertes en guion de paneles o lo guardas como versión novela.
   ===================================================================== */
function story(c) { const s = (c.story ||= { text: '', note: '', want: '', undo: [], last: null, answer: '', fixes: [] }); s.undo ||= []; s.fixes ||= []; return s; }
function stSnap(c) { const s = story(c); s.undo.push(s.text); if (s.undo.length > 40) s.undo.shift(); }
function stArea() { return $('#stTxt'); }
function stSync(m, c) { const t = stArea(); if (t) { story(c).text = t.value; touch(m); } }
function coWriteHTML(m, c) {
  const s = story(c); const words = s.text.trim() ? s.text.trim().split(/\s+/).length : 0;
  return `<div class="panelbox cowrite" style="margin-top:16px">
    <div class="row between"><h2 style="margin:0">✍️ Escribir con Claude <span class="tiny dim" style="font-weight:400">· como NovelAI</span></h2><span class="small muted" id="stCount">${words} palabras</span></div>
    <p class="small muted" style="margin:6px 0 10px">Escribe tú directo en el cuadro, pega lo que ya tenías, o pídele a Claude que siga. Claude conoce a tus personajes, lugares, poderes y fichas canon. Lo que escribe Claude queda marcado para que lo revises.</p>
    <div class="grid2">
      <label class="f">📝 Nota para Claude (estilo y tono de este capítulo)<input ${bindAttr(s, 'note')} value="${esc(s.note)}" placeholder="Ej. narración en tercera persona, oscuro, frases cortas, mucho diálogo"></label>
      <label class="f">🎯 ¿Qué quieres que pase ahora? (opcional)<input id="stWant" value="${esc(s.want || '')}" placeholder="Ej. Lira llega y detiene a Draven"></label>
    </div>
    <textarea id="stTxt" class="sttxt" spellcheck="true" placeholder="Empieza a escribir tu capítulo aquí… o toca ✨ Continuar y Claude empieza.">${esc(s.text)}</textarea>
    <div class="row" style="margin-top:8px">
      <button class="pri" data-a="stCont">✨ Continuar</button>
      <button data-a="stRetry" ${s.last ? '' : 'disabled'} title="Borra lo último que escribió Claude y lo vuelve a escribir distinto">🔁 Otra versión</button>
      <button data-a="stUndo" ${s.undo.length ? '' : 'disabled'}>↩️ Deshacer</button>
      <button data-a="stIdeas">💡 3 ideas de qué pasa después</button>
      <button data-a="stRewrite" title="Marca un pedazo de texto y toca aquí">✏️ Reescribir lo que marqué</button>
      <button data-a="stFix">🩹 Corrígeme</button>
      <button data-a="stAsk">💬 Pregúntale a Claude</button>
    </div>
    ${s.answer ? `<div class="alert info" style="margin-top:10px"><div class="grow"><b>Claude:</b> ${esc(s.answer).replace(/\n/g, '<br>')}</div><button class="sm icon ghost" data-a="stAnsClose">✕</button></div>` : ''}
    ${s.fixes.length ? `<div class="sect" style="margin-top:10px"><h3 style="margin:0 0 6px">🩹 Correcciones de Claude (${s.fixes.length})</h3>${s.fixes.map((f, i) => `<div class="alert warn" style="margin-bottom:6px"><div class="grow"><div class="small"><s style="opacity:.7">${esc(f.original)}</s></div><div class="small"><b>→ ${esc(f.fix)}</b></div>${f.why ? `<div class="tiny dim">${esc(f.why)}</div>` : ''}</div><div class="col" style="gap:4px"><button class="sm ok" data-a="stFixApply" data-i="${i}">Aplicar</button><button class="sm ghost" data-a="stFixSkip" data-i="${i}">Ignorar</button></div></div>`).join('')}<div class="row"><button class="sm ok" data-a="stFixAll">Aplicar todas</button><button class="sm ghost" data-a="stFixClear">Ignorar todas</button></div></div>` : ''}
    <div class="row" style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px">
      <button class="ok" data-a="stToScript" ${words ? '' : 'disabled'}>🎞️ Convertir en guion de paneles</button>
      <button data-a="stToNovel" ${words ? '' : 'disabled'}>🎧 Guardar como versión novela</button>
      <button data-a="stFromNovel" ${c.novel && !words ? '' : 'disabled'}>📖 Traer la versión novela</button>
      <button data-a="stDl" ${words ? '' : 'disabled'}>⬇ Word</button>
    </div>
  </div>`;
}
function coWriteMount() {
  if (Route.view !== 'cap') return; const m = cur(); const c = chapterById(m, Route.a); if (!c) return;
  const t = stArea(); if (!t) return;
  let tm; t.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { story(c).text = t.value; touch(m); const w = t.value.trim() ? t.value.trim().split(/\s+/).length : 0; const el = $('#stCount'); if (el) el.textContent = w + ' palabras'; }, 400); };
  const w = $('#stWant'); if (w) w.oninput = () => { story(c).want = w.value; };
  const s = story(c);
  if (s.last && s.last.end <= t.value.length && s.focus) { t.focus(); t.setSelectionRange(s.last.start, s.last.end); t.scrollTop = t.scrollHeight; s.focus = false; }
}
const stCtx = (m, c) => `CEREBRO DEL MANHWA "${m.name}" (respeta TODO: personalidades, poderes, reglas, fichas canon, quién está vivo):
${brain(m, { skipChapterId: c.id, maxChars: 30000 })}

CAPÍTULO ${c.number}${c.title ? ' "' + c.title + '"' : ''}${c.premise ? '\nIdea del capítulo: ' + c.premise : ''}
${story(c).note ? 'NOTA DEL AUTOR (estilo y tono, obedécela): ' + story(c).note : ''}`;
async function stCall(m, c, el, prompt, title, max = 2500) {
  let out; await busy(el, async () => { const { text } = await ai(prompt, { max_tokens: max, temperature: 0.9, estOut: Math.round(max * 0.5), title }); out = text; }, 'Claude escribiendo…');
  return out;
}
const cleanGen = t => String(t || '').replace(/^```[a-z]*\n?|```$/gim, '').replace(/^(claro|aquí|perfecto)[^\n]*\n+/i, '').trim();
async function stContinue(el, retry = false) {
  const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); const s = story(c);
  if (retry && s.last) { s.text = s.text.slice(0, s.last.start).replace(/\s+$/, ''); }
  const want = ($('#stWant')?.value || '').trim(); s.want = want;
  const tail = s.text.slice(-12000);
  const prompt = `Eres coautor de una novela/manhwa, como NovelAI. ${tail ? 'CONTINÚA el texto del autor desde donde quedó' : 'EMPIEZA el capítulo'}: escribe de 2 a 4 párrafos nuevos (máx 350 palabras).
Mantén EXACTAMENTE su estilo, voz narrativa, tiempo verbal y forma de escribir diálogos. No repitas lo ya escrito, no resumas, no cierres el capítulo a menos que te lo pidan. Escribe en español.
${want ? 'LO QUE EL AUTOR QUIERE QUE PASE AHORA: ' + want : 'Haz avanzar la escena de forma natural e interesante.'}
${retry ? 'Escribe una versión DISTINTA a la anterior.' : ''}

${stCtx(m, c)}

TEXTO DEL AUTOR HASTA AHORA:
"""
${tail || '(vacío)'}
"""

Responde SOLO con el texto nuevo que va después, sin comillas, sin títulos y sin comentarios.`;
  const out = cleanGen(await stCall(m, c, el, prompt, retry ? 'Otra versión' : 'Continuar mi capítulo'));
  if (!out) return;
  if (!retry) stSnap(c);
  const sep = s.text && !/\n$/.test(s.text) ? '\n\n' : '';
  const start = s.text.length + sep.length; s.text = s.text + sep + out; s.last = { start, end: s.text.length }; s.focus = true;
  touch(m); render(); toast('✨ Claude escribió ' + out.split(/\s+/).length + ' palabras (quedaron marcadas). Edítalas como quieras.', 'ok');
}
ACT.stCont = el => stContinue(el, false);
ACT.stRetry = el => stContinue(el, true);
ACT.stUndo = () => { const m = cur(); const c = chapterById(m, Route.a); const s = story(c); if (!s.undo.length) return; s.text = s.undo.pop(); s.last = null; touch(m); render(); toast('Deshecho ↩️'); };
ACT.stIdeas = async el => {
  const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); const s = story(c);
  let r; await busy(el, async () => { r = await aiJSON(`Eres coautor de este manhwa. Lee lo que lleva el autor y propón 3 caminos DISTINTOS de lo que podría pasar a continuación (uno tranquilo, uno sorprendente, uno intenso). Respeta el cerebro del manhwa.

${stCtx(m, c)}

TEXTO HASTA AHORA:
"""
${s.text.slice(-10000) || '(todavía vacío: propón cómo empezar)'}
"""
Formato: {"ideas":[{"title":"título corto","what":"qué pasa, en 2 frases"}]}`, { max_tokens: 1500, title: '3 ideas de qué pasa después' }); }, 'Pensando…');
  if (!r?.ideas?.length) return;
  const pick = await choiceBox('💡 ¿Qué pasa después?', r.ideas.map((x, i) => `<div style="margin:8px 0"><b>${i + 1}. ${esc(x.title)}</b><div class="small">${esc(x.what)}</div></div>`).join('') + '<p class="small muted">Elige una y Claude la escribe, o cópiala en “¿Qué quieres que pase ahora?”.</p>', [...r.ideas.map((x, i) => ({ label: `✍️ Escribir la ${i + 1}`, value: i, cls: i === 0 ? 'pri' : '' })), { label: 'Ninguna', value: -1 }]);
  if (pick == null || pick < 0) return;
  const idea = r.ideas[pick]; s.want = `${idea.title}: ${idea.what}`; const w = $('#stWant'); if (w) w.value = s.want;
  await stContinue(document.querySelector('[data-a=stCont]'), false);
};
ACT.stRewrite = async el => {
  const m = cur(); const c = chapterById(m, Route.a); const t = stArea(); stSync(m, c);
  const a = t.selectionStart, b = t.selectionEnd; if (b - a < 3) return toast('Primero marca (selecciona) el pedazo de texto que quieres cambiar', 'err');
  const sel = t.value.slice(a, b);
  const how = await choiceBox('✏️ ¿Cómo lo reescribo?', `<div class="small muted" style="max-height:120px;overflow:auto;border-left:3px solid var(--neon);padding-left:8px">${esc(sel.slice(0, 600))}${sel.length > 600 ? '…' : ''}</div>`, [{ label: '🔥 Más dramático', value: 'más dramático e intenso' }, { label: '✂️ Más corto', value: 'más corto y directo' }, { label: '💥 Más acción', value: 'con más acción y movimiento' }, { label: '🗣️ Mejores diálogos', value: 'con diálogos más naturales y con personalidad' }, { label: '🎨 Más descripción', value: 'más descriptivo y visual' }, { label: '✍️ Otra cosa…', value: '__custom', cls: 'pri' }]);
  if (!how) return; let inst = how;
  if (how === '__custom') { inst = await promptBox('✍️ ¿Cómo lo quieres?', '', { label: 'Dilo normal, ej. "que Kael suene más frío"' }); if (!inst) return; }
  const out = cleanGen(await stCall(m, c, el, `Reescribe SOLO este fragmento ${inst}. Mantén el estilo del autor, los mismos hechos (salvo que te pida cambiarlos) y que encaje con lo que va antes y después.

${stCtx(m, c)}

ANTES DEL FRAGMENTO: """${t.value.slice(Math.max(0, a - 1500), a)}"""
FRAGMENTO A REESCRIBIR: """${sel}"""
DESPUÉS: """${t.value.slice(b, b + 800)}"""

Responde SOLO con el fragmento reescrito.`, 'Reescribir fragmento', 2000));
  if (!out) return; const s = story(c); stSnap(c); s.text = t.value.slice(0, a) + out + t.value.slice(b); s.last = { start: a, end: a + out.length }; s.focus = true; touch(m); render(); toast('✏️ Reescrito (quedó marcado). ↩️ Deshacer si no te gusta.', 'ok');
};
ACT.stFix = async el => {
  const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); const s = story(c);
  if (!s.text.trim()) return toast('Todavía no hay texto que corregir', 'err');
  let r; await busy(el, async () => { r = await aiJSON(`Eres editor profesional de este manhwa. Revisa el texto del autor y propón correcciones concretas: ortografía y acentos, frases confusas, errores de CONTINUIDAD contra el cerebro (apariencia, poderes, quién está vivo, fichas canon), personajes fuera de personalidad y ritmo. NO cambies su estilo. Máximo 15 correcciones, las más importantes.

${stCtx(m, c)}

TEXTO:
"""
${s.text.slice(-20000)}
"""
"original" debe ser un pedazo EXACTO copiado del texto (para poder reemplazarlo).
Formato: {"fixes":[{"original":"texto exacto","fix":"texto corregido","why":"por qué, corto"}],"general":"comentario general en 1-2 frases"}`, { max_tokens: 4000, title: 'Corregir mi capítulo' }); }, 'Revisando…');
  if (!r) return; s.fixes = (r.fixes || []).filter(f => f.original && s.text.includes(f.original) && f.fix !== f.original);
  s.answer = r.general || ''; touch(m); render(); toast(s.fixes.length ? `🩹 ${s.fixes.length} correcciones. Aplica las que quieras.` : 'Claude no encontró nada que corregir 👌', 'ok');
};
function stApplyFix(c, i) { const s = story(c); const f = s.fixes[i]; if (f && s.text.includes(f.original)) s.text = s.text.replace(f.original, f.fix); s.fixes.splice(i, 1); }
ACT.stFixApply = el => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); stSnap(c); stApplyFix(c, +el.dataset.i); touch(m); render(); };
ACT.stFixSkip = el => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); story(c).fixes.splice(+el.dataset.i, 1); touch(m); render(); };
ACT.stFixAll = () => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); stSnap(c); while (story(c).fixes.length) stApplyFix(c, 0); touch(m); render(); toast('Correcciones aplicadas ✔ (↩️ Deshacer si quieres)', 'ok'); };
ACT.stFixClear = () => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); story(c).fixes = []; touch(m); render(); };
ACT.stAnsClose = () => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); story(c).answer = ''; touch(m); render(); };
ACT.stAsk = async el => {
  const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); const s = story(c);
  const q = await promptBox('💬 Pregúntale a Claude', '', { label: 'Lo que quieras: "¿qué le falta a esta escena?", "¿cómo hago que Draven dé más miedo?", "¿esto choca con algo de la biblia?"', multiline: true, ok: 'Preguntar' });
  if (!q) return;
  const out = await stCall(m, c, el, `Eres coautor y editor de este manhwa. Responde la pregunta del autor de forma útil, concreta y corta (máx 200 palabras), en español.

${stCtx(m, c)}

TEXTO DEL CAPÍTULO:
"""
${s.text.slice(-12000) || '(vacío)'}
"""
PREGUNTA DEL AUTOR: ${q}`, 'Pregunta a Claude', 1500);
  if (!out) return; s.answer = out.trim(); touch(m); render();
};
ACT.stToNovel = async () => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); if (c.novel && !await confirmBox('Este capítulo ya tiene versión novela. ¿Reemplazarla con lo que escribiste aquí?', { ok: 'Reemplazar', danger: false })) return; c.novel = story(c).text; touch(m); toast('🎧 Guardado como versión novela. Ya lo puedes escuchar en “Leer como novela”.', 'ok'); };
ACT.stFromNovel = () => { const m = cur(); const c = chapterById(m, Route.a); stSnap(c); story(c).text = c.novel || ''; touch(m); render(); };
ACT.stDl = async el => { const m = cur(); const c = chapterById(m, Route.a); stSync(m, c); await busy(el, async () => { await docxLib(); const { H, P } = D(); downloadBlob(await makeDocx(`Cap ${c.number}`, [H(`Capítulo ${c.number}${c.title ? ': ' + c.title : ''}`, 1), ...story(c).text.split(/\n+/).map(t => P(t))]), `${fileSafe(m.name)} - Cap ${c.number} (texto).docx`); }, 'Creando…'); };
ACT.stToScript = async el => {
  const m = cur(); const c = chapterById(m, Route.a); stSync(m, c);
  if (!c.premise?.trim()) c.premise = 'Adapta a paneles la historia escrita del capítulo.';
  window.__stScript = true; try { await ACT.writeScript(el); } finally { window.__stScript = false; }
};

/* ---------- Tarjetitas: quién trabaja aquí ---------- */
function wkTip(k, txt) {
  if (typeof wkOn !== 'function' || !wkOn()) return '';
  const W = WK[k];
  return `<div class="wktip"><span style="font-size:22px">${W.icon}</span><div class="grow small">Aquí trabaja <b>${W.name}</b>: ${txt}</div><a class="tiny" data-a="go" data-to="#/trabajadores" style="cursor:pointer;white-space:nowrap">ver los 4 →</a></div>`;
}
