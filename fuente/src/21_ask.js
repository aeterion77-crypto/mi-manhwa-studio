/* =====================================================================
   🔎 PREGÚNTALE A TU BIBLIA
   - Buscador al instante: dónde aparece algo (biblia, fichas, canon,
     capítulos, paneles) y un clic para ir ahí.
   - Pregunta a Claude: contesta con toda tu biblia y tus capítulos,
     diciendo de dónde lo sacó. No cambia nada.
   ===================================================================== */
function askHTML(m) {
  const a = window.__askAns && window.__askAns.mid === m.id ? window.__askAns : null;
  return `<div class="askbar"><div class="row nw" style="gap:8px;align-items:center"><span style="font-size:20px">🔎</span>
    <input id="askQ" placeholder="Pregúntale a tu biblia: “¿qué pasó en el cap 1?”, “¿quién es Oryndor?”, “¿cómo se llama la espada de Elías?”" value="${esc(a?.q || '')}">
    ${jobBtn('ask:' + m.id, 'Preguntar', 'class="pri" data-a="askRun"', 'Pensando…')}</div>
    <div id="askHits"></div>
    <div id="askOut">${a ? askAnsHTML(m, a) : ''}</div></div>`;
}
function askAnsHTML(m, a) {
  return `<div class="askans"><div class="row nw between"><b>💬 ${esc(a.q)}</b><button class="sm icon ghost" data-a="askClose">✕</button></div><div class="sectext" style="margin-top:6px">${prettyText(a.text)}</div>
    ${a.refs?.length ? `<div class="row" style="margin-top:6px;gap:6px">${a.refs.map(r => `<a class="chip" data-a="go" data-to="${r.to}" style="cursor:pointer">${esc(r.l)}</a>`).join('')}</div>` : ''}</div>`;
}
/* adónde lleva cada lugar */
function askLink(m, p) {
  const [k, a, b] = p.split('.');
  if (k === 'ent') { const t = findEntityType(m, a); return t ? mlink(m, 'wiki', t, a) : null; }
  if (k === 'cap' || k === 'pan') return mlink(m, 'cap', a);
  if (k === 'canon') return mlink(m, 'canon');
  return mlink(m, 'bibliadoc', 'base');
}
function askSnippet(v, q) { const i = norm(v).indexOf(norm(q)); if (i < 0) return esc(v.slice(0, 120)); const a = Math.max(0, i - 50), b = Math.min(v.length, i + q.length + 70); return (a ? '…' : '') + esc(v.slice(a, i)) + '<mark>' + esc(v.slice(i, i + q.length)) + '</mark>' + esc(v.slice(i + q.length, b)) + (b < v.length ? '…' : ''); }
const ASK_STOP = new Set('que qué quien quién quienes quiénes como cómo donde dónde cuando cuándo cual cuál cuales cuáles cuanto cuánto pasa pasó paso hace hizo tiene tenía tenia era fue son los las del una uno unos unas por para con sin sobre mis tus sus les dice dijo llama llamaba nombre capitulo capítulo cap esta está estaba hay había'.split(' '));
function askLocal(m, q) {
  q = q.replace(/[¿?¡!.,]/g, ' ').trim(); if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(w => w.length > 2 && !ASK_STOP.has(w.toLowerCase()) && !GX_STOP.has(norm(w))); const hits = [];
  if (!words.length) return [];
  if (words.length < q.split(/\s+/).length) q = words.join(' ');
  for (const f of gxFields(m)) {
    let term = norm(f.v).includes(norm(q)) ? q : null;
    if (!term && words.length > 1) term = words.find(w => norm(f.v).includes(norm(w)));
    if (!term) continue;
    const score = (norm(f.v).includes(norm(q)) ? 10 : 0) + (f.p.startsWith('ent.') && f.p.endsWith('.name') ? 8 : 0) + (f.p.startsWith('ent.') ? 3 : 0) + (f.p.startsWith('doc.') ? 1 : 0);
    hits.push({ ...f, term, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}
let askT;
function askMount() {
  const i = $('#askQ'); if (!i) return;
  i.oninput = () => { clearTimeout(askT); askT = setTimeout(() => { const m = cur(); const hits = askLocal(m, i.value); const box = $('#askHits'); if (!box) return;
    box.innerHTML = i.value.trim().length < 2 ? '' : hits.length ? `<div class="askhits">${hits.map(h => `<a class="askhit" data-a="askGo" data-to="${askLink(m, h.p) || ''}" data-q="${esc(h.term)}" data-doc="${h.p.startsWith('doc.') ? 1 : ''}"><b>${esc(h.l)}</b><span class="small">${askSnippet(h.v, h.term)}</span></a>`).join('')}<div class="tiny dim" style="padding:4px 8px">Enter = preguntarle a Claude</div></div>` : `<div class="tiny dim" style="padding:6px 4px">No aparece tal cual. Toca “Preguntar” y Claude lo busca por el sentido.</div>`; }, 200); };
  i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ACT.askRun(document.querySelector('[data-a=askRun]')); } };
}
ACT.askGo = el => { const to = el.dataset.to; if (!to) return; if (el.dataset.doc) window.__docFindQ = el.dataset.q; else window.__hlQ = el.dataset.q; location.hash = to.replace(/^#/, '#'); };
ACT.askClose = () => { window.__askAns = null; const o = $('#askOut'); if (o) o.innerHTML = ''; };
ACT.askRun = async el => {
  clearTimeout(askT); const hb = $('#askHits'); if (hb) hb.innerHTML = '';
  const m = cur(); const q = ($('#askQ')?.value || '').trim(); if (q.length < 2) return toast('Escribe tu pregunta', 'err');
  const kw = gxKeywords(m, q);
  const caps = chapterList(m).map(c => { const t = (c.story?.text || c.novel || '').trim(); const sc = (c.panels || []).length ? scriptText(c) : ''; const body = t || sc; if (!body) return ''; const asked = new RegExp('cap(í|i)?(tulo)?\\.?\\s*' + c.number + '\\b', 'i').test(q);
    if (asked) return `CAPÍTULO ${c.number}${c.title ? ' "' + c.title + '"' : ''} (completo):\n${body.slice(0, 30000)}`;
    const paras = body.split(/\n\s*\n/).filter(p => gxHit(p, kw)).slice(0, 12); return paras.length ? `CAPÍTULO ${c.number}${c.title ? ' "' + c.title + '"' : ''} (partes relacionadas):\n${paras.join('\n\n').slice(0, 8000)}` : (c.summary ? `CAPÍTULO ${c.number}: ${c.summary}` : ''); }).filter(Boolean).join('\n\n');
  const doc = typeof master === 'function' ? master(m).text : '';
  const docPart = doc.length < 60000 ? doc : doc.split(/\n\s*\n/).filter(p => gxHit(p, kw)).slice(0, 40).join('\n\n');
  const prompt = `Eres el archivista del manhwa "${m.name}". Responde la PREGUNTA del autor usando SOLO lo que está en su biblia, sus fichas y sus capítulos. Si algo no está escrito en ningún lado, dilo claro ("eso no está en tu biblia") y no inventes. Responde corto y directo en español (máx 180 palabras), con listas si ayudan. Al final, en una línea, di de dónde lo sacaste, ej. "Fuentes: ficha de Elías, Cap 1, sección Glosario".

CEREBRO DEL MANHWA:
${brain(m, { maxChars: 40000 })}

${docPart ? 'DOCUMENTO DE LA BIBLIA DEL AUTOR:\n' + docPart.slice(0, 60000) + '\n' : ''}
${caps}

PREGUNTA: ${q}`;
  let text; await busy(el, async () => { const r = await ai(prompt, { max_tokens: 1500, temperature: 0.2, estOut: 400, title: 'Pregunta: ' + q.slice(0, 40), job: { key: 'ask:' + m.id } }); text = (r.text || '').trim(); }, 'Pensando…');
  if (!text) return;
  const refs = []; const add = (l, to) => { if (to && !refs.some(r => r.to === to)) refs.push({ l, to }); };
  for (const t of Object.keys(TYPES)) for (const e of m[TYPES[t].key] || []) if (e.name && norm(text).includes(norm(e.name))) add(TYPES[t].icon + ' ' + e.name, mlink(m, 'wiki', t, e.id));
  for (const c of chapterList(m)) if (new RegExp('cap(í|i)?(tulo)?\\.?\\s*' + c.number + '\\b', 'i').test(text)) add('📖 Cap ' + c.number, mlink(m, 'cap', c.id));
  window.__askAns = { mid: m.id, q, text, refs: refs.slice(0, 8) };
  const o = $('#askOut'); if (o) o.innerHTML = askAnsHTML(m, window.__askAns); const h = $('#askHits'); if (h) h.innerHTML = '';
};
/* al llegar a una ficha o capítulo desde el buscador: resaltar la palabra */
function askHighlight() {
  const q = window.__hlQ; if (!q) return; window.__hlQ = null;
  setTimeout(() => {
    const t = [...document.querySelectorAll('#view textarea, #view input')].find(x => norm(x.value || '').includes(norm(q)));
    if (t) { const i = norm(t.value).indexOf(norm(q)); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (t.setSelectionRange) { t.focus({ preventScroll: true }); t.setSelectionRange(i, i + q.length); } t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1500); return; }
    const w = document.createTreeWalker($('#view'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (norm(n.nodeValue).includes(norm(q))) { const el = n.parentElement; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); break; } }
  }, 120);
}
