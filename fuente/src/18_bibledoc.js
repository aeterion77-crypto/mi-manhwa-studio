/* =====================================================================
   📖 MI BIBLIA COMPLETA (ver y editar a mano, como un documento)
   Toda la biblia en una sola página que se lee como tu documento.
   Cada texto está conectado a su lugar real de la app: lo que cambies
   aquí se guarda y se sincroniza al momento (fichas, cerebro, Claude, nube).
   ===================================================================== */
function docField(obj, key, { label = '', big = false, ph = '', title = false, num = false, opts = null } = {}) {
  const v = obj[key] ?? '';
  if (opts) return `<div class="docrow">${label ? `<span class="doclab">${esc(label)}</span>` : ''}<select class="docsel" ${bindAttr(obj, key)}><option value=""></option>${opts.map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
  return `<div class="docrow ${title ? 'doctitle' : ''}">${label ? `<span class="doclab">${esc(label)}</span>` : ''}<textarea class="docf ${big ? 'big' : ''}" rows="1" spellcheck="true" placeholder="${esc(ph || (label ? 'Escribe aquí…' : ''))}" ${bindAttr(obj, key, { num })}>${esc(v)}</textarea></div>`;
}
VIEWS.bibliadoc = () => {
  const m = cur(); const b = m.bible; const tab = Route.a || 'base';
  const S2 = typeof secs === 'function' ? secs(m) : [];
  const toc = [['dh', '🧠 Historia'], ...Object.entries(TYPES).map(([t, T]) => ['d-' + t, `${T.icon} ${T.label}`]), ['dcanon', '📌 Fichas canon'], ...(S2.length ? [['dsecs', '📘 Secciones']] : []), ['dcaps', '📖 Capítulos']];
  const head = `<div class="head"><div><h1>📜 Mi biblia</h1><p class="muted">${tab === 'base' ? 'Tu documento de la biblia es la base: edítalo aquí como en Word, agrega lo que quieras y toca “Repartir” para que se acomode en todo tu manhwa.' : tab === 'viva' ? 'Así quedó repartida tu biblia en la app. Lo que edites aquí cambia directo en cada ficha (y la app te ofrece pasarlo a tu documento).' : 'Las versiones de tu biblia tal como las subiste (respaldo).'}</p></div>
    <div class="row"><button data-a="go" data-to="${mlink(m, 'biblia')}">← Biblia</button><button data-a="dlMaster">⬇ Word</button></div></div>
    <div class="row" style="margin-bottom:12px"><button class="${tab === 'base' ? 'pri' : ''}" data-a="go" data-to="${mlink(m, 'bibliadoc', 'base')}">📜 Mi biblia (documento base)</button><button class="${tab === 'viva' ? 'pri' : ''}" data-a="go" data-to="${mlink(m, 'bibliadoc', 'viva')}">🗂️ Cómo quedó repartida</button><button class="${tab === 'original' ? 'pri' : ''}" data-a="go" data-to="${mlink(m, 'bibliadoc', 'original')}">📚 Versiones que subiste${(b.sources || []).length ? ' (' + b.sources.length + ')' : ''}</button></div>`;
  if (tab === 'base') return head + gxBar(m, 'Agrega, cambia o quita algo de tu historia y lo escribo en tu biblia y lo reparto. Ej. “Tomás, el amigo de Elías, no existe: quítalo y arregla esa parte”') + masterHTML(m);
  if (tab === 'original') {
    const docs = b.sources || [];
    return head + (docs.length ? docs.map(d => `<div class="docpage"><div class="row between"><h2 style="margin:0">📄 ${esc(d.name)}</h2><span class="small muted">${fmtDate(d.at)} · ${d.text.split(/\s+/).length.toLocaleString('es')} palabras</span></div>
      <p class="tiny dim">Así la subiste ese día (respaldo). Tu biblia actual, con todos tus cambios, está en “📜 Mi biblia”.</p>
      <textarea class="docf big" rows="1" ${bindAttr(d, 'text')}>${esc(d.text)}</textarea></div>`).join('') : '<div class="empty">Todavía no has subido un documento. Usa “📄 SUBIR MI BIBLIA” en la Biblia.</div>');
  }
  const ent = (t, T) => {
    const arr = [...(m[T.key] || [])]; if (t === 'historia') arr.sort((a, c) => (a.order || 0) - (c.order || 0));
    return `<section class="docsec" id="d-${t}"><div class="row between"><h2>${T.icon} ${T.label} <span class="small muted">(${arr.length})</span></h2><button class="sm" data-a="docAdd" data-t="${t}">＋ Agregar ${T.one}</button></div>
      ${arr.length ? arr.map(e => `<article class="docent" id="e-${e.id}">${docField(e, 'name', { title: true, ph: 'Nombre' })}
        ${T.fields.filter(([k]) => !['name', 'loraId', 'loraWeight'].includes(k)).map(([k, l, ty, o]) => docField(e, k, { label: l, big: ty === 'area', num: ty === 'num', opts: ty === 'select' ? o : null })).join('')}
        ${(e.relations || []).length ? `<div class="docrow"><span class="doclab">Relaciones</span><span class="small">${e.relations.map(r => `${esc(r.kind)} → <b>${esc(findEntity(m, r.target)?.name || '?')}</b>`).join(' · ')}</span></div>` : ''}
        <div class="row" style="justify-content:flex-end"><button class="sm ghost" data-a="go" data-to="${mlink(m, 'wiki', t, e.id)}">Abrir ficha →</button></div></article>`).join('') : `<p class="muted small">Vacío.</p>`}</section>`;
  };
  return head + gxBar(m) + `<div class="doclayout">
    <nav class="doctoc"><div class="tiny dim" style="margin-bottom:6px">ÍNDICE</div>${toc.map(([id, l]) => `<a data-a="secScroll" data-id="${id}">${l}</a>`).join('')}
      <input id="docFind" placeholder="🔎 Buscar en mi biblia" style="margin-top:10px"><div class="tiny dim" id="docFindN"></div>
      <div class="tiny dim" style="margin-top:10px">✔ Se guarda solo mientras escribes</div></nav>
    <div class="docpage">
      <div class="docrow doctitle" style="font-size:30px"><textarea class="docf" rows="1" ${bindAttr(m, 'name')}>${esc(m.name)}</textarea></div>
      <section class="docsec" id="dh"><h2>🧠 Historia</h2>
        ${docField(b, 'genre', { label: 'Género' })}${docField(b, 'tone', { label: 'Tono' })}
        ${docField(b, 'synopsis', { label: 'Sinopsis', big: true })}${docField(b, 'plot', { label: 'Trama completa', big: true })}${docField(b, 'rules', { label: 'Reglas del mundo', big: true })}</section>
      ${Object.entries(TYPES).map(([t, T]) => ent(t, T)).join('')}
      <section class="docsec" id="dcanon"><div class="row between"><h2>📌 Fichas canon <span class="small muted">(${m.canon.length})</span></h2><button class="sm" data-a="docAddCanon">＋ Agregar ficha</button></div>
        ${m.canon.length ? `<div class="doccanon">${m.canon.map(f => `<div class="row nw" style="gap:6px">${['entity', 'attribute', 'value'].map((k, i) => `<textarea class="docf" rows="1" style="flex:${i === 2 ? 2 : 1}" placeholder="${['quién', 'qué', 'valor'][i]}" ${bindAttr(f, k)}>${esc(f[k] ?? '')}</textarea>`).join('')}<textarea class="docf" rows="1" style="width:70px;flex:none" placeholder="desde cap" ${bindAttr(f, 'since')}>${esc(f.since ?? '')}</textarea></div>`).join('')}</div>` : '<p class="muted small">Vacío.</p>'}</section>
      ${S2.length ? `<section class="docsec" id="dsecs"><div class="row between"><h2>📘 Secciones de mi biblia</h2><button class="sm" data-a="secNew">＋ Nueva sección</button></div>${S2.map(s => `<article class="docent" id="${s.id}"><div class="docrow doctitle"><span style="font-size:22px">${s.icon}</span><textarea class="docf" rows="1" ${bindAttr(s, 'title')}>${esc(s.title)}</textarea></div><textarea class="docf big" rows="1" ${bindAttr(s, 'text')}>${esc(s.text)}</textarea></article>`).join('')}</section>` : ''}
      <section class="docsec" id="dcaps"><h2>📖 Capítulos <span class="small muted">(${chapterList(m).length})</span></h2>
        ${chapterList(m).map(c => `<article class="docent"><div class="docrow doctitle"><span>Cap ${c.number} ·</span><textarea class="docf" rows="1" placeholder="Título" ${bindAttr(c, 'title')}>${esc(c.title || '')}</textarea></div>${docField(c, 'premise', { label: 'Qué pasa', big: true })}${docField(c, 'summary', { label: 'Resumen', big: true })}<div class="row" style="justify-content:flex-end"><button class="sm ghost" data-a="go" data-to="${mlink(m, 'cap', c.id)}">Abrir capítulo →</button></div></article>`).join('') || '<p class="muted small">Sin capítulos.</p>'}</section>
    </div></div>`;
};
function docGrow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
function docMount() {
  if (Route.view !== 'bibliadoc') return;
  $$('.docf').forEach(docGrow);
  if (!window.__docGrowOn) { window.__docGrowOn = true; document.addEventListener('input', e => { if (e.target.classList?.contains('docf')) docGrow(e.target); }); }
  const f = $('#docFind'); let hits = [], hi = 0;
  if (f) { f.oninput = () => { const q = norm(f.value.trim()); $$('.docf.hit').forEach(x => x.classList.remove('hit')); hits = q.length < 2 ? [] : $$('.docf').filter(t => norm(t.value).includes(q)); hits.forEach(x => x.classList.add('hit')); hi = 0; $('#docFindN').textContent = q.length < 2 ? '' : hits.length ? `${hits.length} lugares · Enter = siguiente` : 'No aparece'; if (hits[0]) hits[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    f.onkeydown = e => { if (e.key === 'Enter' && hits.length) { hi = (hi + 1) % hits.length; hits[hi].scrollIntoView({ block: 'center', behavior: 'smooth' }); hits[hi].focus(); const q = norm(f.value.trim()); const i = norm(hits[hi].value).indexOf(q); if (i >= 0) hits[hi].setSelectionRange(i, i + q.length); } }; }
}
ACT.docAdd = el => { const m = cur(); const t = el.dataset.t; const T = TYPES[t]; const e = { id: uid(T.key[0] + '_'), name: 'Nuevo ' + T.one, relations: [], createdAt: Date.now() }; if (t === 'historia') e.order = (m[T.key] || []).length + 1; (m[T.key] ||= []).push(e); touch(m); render(); setTimeout(() => { const a = document.getElementById('e-' + e.id); a?.scrollIntoView({ block: 'center' }); const ta = a?.querySelector('textarea'); ta?.focus(); ta?.select(); }, 60); };
ACT.docAddCanon = () => { const m = cur(); m.canon.push({ id: uid('k_'), entity: '', attribute: '', value: '', since: '', note: '' }); touch(m); render(); setTimeout(() => { const r = [...document.querySelectorAll('.doccanon .row')].pop(); r?.scrollIntoView({ block: 'center' }); r?.querySelector('textarea')?.focus(); }, 60); };
