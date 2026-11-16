/* =====================================================================
   Capítulos, editor de guion con IA, continuidad, cliffhangers, traducción
   ===================================================================== */
const STATUSES = ['Borrador', 'Generando', 'Listo', 'Publicado'];
const SIZES = { S: 'Pequeño', M: 'Mediano', L: 'Grande', XL: 'Enorme' };
const SIZE_H = { S: 0.62, M: 1, L: 1.4, XL: 1.9 };   // alto relativo al ancho
const DTYPES = { normal: 'Normal', grito: 'Grito', pensamiento: 'Pensamiento', narracion: 'Narración', susurro: 'Susurro' };
function newChapter(m, number, title = '', premise = '') {
  return { id: uid('ch_'), number, title, premise, status: 'Borrador', summary: '', panels: [], cliffhangers: [], chosenCliff: null, warnings: [], layout: { bg: '#ffffff', items: [] }, novel: '', createdAt: Date.now(), tone: 'auto' };
}
function mkPanel(p = {}) { return { id: uid('pn_'), size: 'M', shot: '', description: '', characters: [], dialogues: [], sfx: [], prompt_en: '', promptOverride: '', imageId: null, seed: null, ...p }; }
const statusChip = s => `<span class="chip ${s === 'Publicado' ? 'ok' : s === 'Listo' ? 'info' : s === 'Generando' ? 'warn' : ''}">${esc(s)}</span>`;

/* ---------------- Lista de capítulos ---------------- */
VIEWS.caps = () => {
  const m = cur(); const l = chapterList(m);
  return `<div class="head"><div><h1>📖 Capítulos</h1><p class="muted">${esc(m.name)} · ${plural(l.length, 'capítulo', 'capítulos')}</p></div>
    <div class="row"><button data-a="go" data-to="${mlink(m, 'lector', 'novela')}">🎧 LEER COMO NOVELA</button><button class="pri big" data-a="newCap">＋ Nuevo capítulo</button></div></div>
    ${l.length ? `<div class="col">${l.map(c => {
      const imgs = (c.panels || []).filter(p => p.imageId).length;
      return `<div class="card hov row between" data-a="go" data-to="${mlink(m, 'cap', c.id)}">
        <div class="row nw grow"><div style="font-size:26px;font-weight:800;color:#dcb8ff;width:64px">Cap ${c.number}</div>
        <div class="grow"><h3>${esc(c.title || '(sin título)')}</h3><div class="small muted">${esc((c.summary || c.premise || '').slice(0, 140))}</div>
        <div class="row" style="margin-top:6px">${statusChip(c.status)}<span class="chip">${plural((c.panels || []).length, 'panel', 'paneles')}</span><span class="chip">🖼️ ${imgs}</span>${(c.warnings || []).length ? `<span class="chip warn">⚠ ${c.warnings.length}</span>` : ''}</div></div></div>
        <div class="row"><button class="sm" data-a="go" data-to="${mlink(m, 'armador', c.id)}">🧩 Armador</button><button class="sm" data-a="dupCap" data-id="${c.id}">⧉ Duplicar</button><button class="sm danger" data-a="delCap" data-id="${c.id}">🗑️</button></div></div>`;
    }).join('')}</div>` : '<div class="empty">Sin capítulos. ¡Crea el primero!</div>'}`;
};
function similarity(a, b) { const A = new Set(norm(a).split(' ').filter(w => w.length > 3)), Bs = new Set(norm(b).split(' ').filter(w => w.length > 3)); if (!A.size || !Bs.size) return 0; let i = 0; A.forEach(w => Bs.has(w) && i++); return i / Math.min(A.size, Bs.size); }
ACT.newCap = async () => {
  const m = cur(); const n = ((lastChapter(m)?.number) || 0) + 1;
  const bg = modal(`<h2>Nuevo capítulo</h2><div class="grid2"><label class="f">Número<input id="cn" type="number" value="${n}"></label><label class="f">Título<input id="ct" autofocus placeholder="Ej. Pelea en la azotea"></label></div>
    <label class="f">¿Qué pasa? (premisa)<textarea id="cp" placeholder="Ej. Kael y Draven pelean en la azotea de la academia bajo la lluvia."></textarea></label>
    <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="ok">Crear</button></div>`);
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=ok]').onclick = async () => {
    const num = Number(bg.querySelector('#cn').value) || n, title = bg.querySelector('#ct').value.trim(), premise = bg.querySelector('#cp').value.trim();
    const same = chapterByNum(m, num);
    if (same && !await confirmBox(`Ya existe el Cap ${num} ("${esc(same.title)}"). ¿Crear otro con el mismo número?`, { ok: 'Crear igual', danger: false, title: 'Número repetido' })) return;
    const rep = premise && chapterList(m).find(c => similarity(premise, (c.premise || '') + ' ' + (c.summary || '')) > 0.6);
    if (rep && !await confirmBox(`Oye, esta historia se parece mucho al <b>Cap ${rep.number}: ${esc(rep.title)}</b> (“${esc((rep.summary || rep.premise).slice(0, 120))}…”). ¿Seguro que no la estás repitiendo?`, { ok: 'Sí, es diferente', danger: false, title: '🔁 Historia repetida' })) return;
    const c = newChapter(m, num, title, premise); m.chapters.push(c); if (m.sample) m.sampleTouched = true; touch(m); bg.close(); go(mlink(m, 'cap', c.id));
  };
};
ACT.dupCap = el => { const m = cur(); const c = chapterById(m, el.dataset.id); const d = clone(c); d.id = uid('ch_'); d.number = (lastChapter(m)?.number || 0) + 1; d.title = c.title + ' (copia)'; d.status = 'Borrador'; d.panels.forEach(p => p.id = uid('pn_')); d.layout.items.forEach(i => i.id = uid('it_')); m.chapters.push(d); touch(m); render(); toast('Capítulo duplicado'); };
ACT.delCap = async el => { const m = cur(); const c = chapterById(m, el.dataset.id); if (!await confirmBox(`¿Seguro que quieres borrar el <b>Cap ${c.number}: ${esc(c.title)}</b>? Se borrará su guion y armado (las imágenes quedan en la Galería).`)) return; m.chapters = m.chapters.filter(x => x.id !== c.id); touch(m); go(mlink(m, 'caps')); };

/* ---------------- Prompts para Fal.ai ---------------- */
function charByName(m, n) { const k = norm(n); return m.characters.find(c => norm(c.name) === k || (c.nickname && norm(c.nickname) === k)); }
function buildPanelPrompt(m, p) {
  const st = m.bible.style; const chars = (p.characters || []).map(n => charByName(m, n)).filter(Boolean);
  const loras = []; const parts = [];
  if (st.prefix) parts.push(st.prefix);
  chars.forEach(c => {
    const look = c.visualPrompt || c.appearance || '';
    parts.push([c.trigger, look ? `(${c.name}: ${look})` : c.name].filter(Boolean).join(' '));
    if (c.loraId) loras.push({ path: c.loraId, scale: Number(c.loraWeight) || 0.9 });
  });
  parts.push(p.prompt_en || p.description || '');
  if (p.shot) parts.push(p.shot);
  const ratio = SIZE_H[p.size] || 1.4;
  const width = Number(st.width) || 800;
  const height = Math.round(Math.min(2048, width * ratio) / 8) * 8;
  return { prompt: p.promptOverride || parts.filter(Boolean).join(', '), negative: st.negative || '', loras, width, height, steps: Number(st.steps) || 30, cfg: Number(st.cfg) || 7 };
}

/* ---------------- Editor de capítulo ---------------- */
VIEWS.cap = () => {
  const m = cur(); const c = chapterById(m, Route.a); if (!c) return '<div class="empty">Capítulo no encontrado.</div>';
  const w = c.warnings || [];
  const dead = localDeadCheck(m, c);
  const genN = (c.panels || []).filter(p => p.approved && !p.imageId).length;
  return `<div class="head"><div><h1>Cap ${c.number} · ${esc(c.title || 'Sin título')}</h1><div class="row" style="margin-top:6px">${statusChip(c.status)}<span class="chip">${plural(c.panels.length, 'panel', 'paneles')}</span></div></div>
    <div class="row"><button data-a="go" data-to="${mlink(m, 'caps')}">← Capítulos</button><button data-a="go" data-to="${mlink(m, 'armador', c.id)}">🧩 Armador</button><button data-a="dlChapter" data-id="${c.id}">⬇ Guion (Word)</button><button data-a="dlChapter" data-id="${c.id}" data-img="1">⬇ Word con imágenes</button><button data-a="dlChapterImgs" data-id="${c.id}">⬇ Imágenes</button><button class="danger" data-a="delCap" data-id="${c.id}">🗑️</button></div></div>

    <div class="grid2">
      <div class="panelbox"><h2>✍️ Escribir guion con IA</h2>
        <div class="grid2"><label class="f">Número<input type="number" ${bindAttr(c, 'number', { num: 1 })} value="${c.number}"></label><label class="f">Estado<select ${bindAttr(c, 'status')}>${STATUSES.map(s => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
        <label class="f">Título<input ${bindAttr(c, 'title')} value="${esc(c.title)}"></label>
        <label class="f">Describe el capítulo<textarea ${bindAttr(c, 'premise')} placeholder="Ej. Cap 12, pelea en la azotea entre Kael y Draven bajo la lluvia. Lira llega al final.">${esc(c.premise)}</textarea></label>
        <div class="grid2"><label class="f">Director de paneles<select ${bindAttr(c, 'tone')}>${[['auto', 'Automático'], ['pelea', 'Pelea (chico, chico, ¡GRANDE!)'], ['drama', 'Drama (grandes y lentos)'], ['romance', 'Romance'], ['misterio', 'Misterio / terror'], ['comedia', 'Comedia']].map(([v, l]) => `<option value="${v}" ${c.tone === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">Paneles<input id="npan" type="number" min="5" max="60" value="${c.panelTarget || 30}"></label></div>
        <div class="row"><button class="pri big" data-a="writeScript">✨ Escribir guion (${c.panelTarget || 30} paneles)</button><button data-a="pasteScript">📋 Ya lo tengo: pegar mi guion</button>${c.panels.length ? '<button data-a="applyDirector">🎬 Aplicar director</button>' : ''}</div>
        <p class="tiny dim">Usa el cerebro completo: personajes, LoRAs, trigger words, fichas canon y capítulos anteriores.</p>
      </div>
      <div class="col">
        <div class="panelbox"><h2>🛡️ Continuidad</h2>
          ${dead.map(x => `<div class="alert bad">☠️ ${esc(x)}</div>`).join('')}
          ${w.length ? w.map((x, i) => `<div class="alert ${x.severity === 'alta' ? 'bad' : 'warn'}"><div class="grow"><b>${esc(x.type || 'Aviso')}${x.panel ? ' · Panel ' + x.panel : ''}:</b> ${esc(x.message)}${x.suggestion ? `<div class="small" style="opacity:.85;margin-top:4px">💡 ${esc(x.suggestion)}</div>` : ''}</div><button class="sm icon ghost" data-a="dismissWarn" data-i="${i}">✕</button></div>`).join('') : (dead.length ? '' : '<p class="muted small">Sin avisos. Revisa la continuidad cuando tengas el guion.</p>')}
          <div class="row"><button data-a="checkCont">🔍 Revisar continuidad</button><button class="ok" data-a="finishCap">✅ Terminar capítulo</button></div>
          <p class="tiny dim">“Terminar capítulo” detecta nuevos hechos y te los propone. Tú das CONSERVAR.</p>
        </div>
        <div class="panelbox"><h2>🎨 Imágenes</h2>
          <div class="row"><button class="pri" data-a="genChapter" ${c.panels.length ? '' : 'disabled'}>⚡ GENERAR EN FAL.AI${genN ? ` (${genN} aprobados)` : ''}</button><button data-a="toBuilder">🧩 Enviar al armador</button><button data-a="translateCap">🌐 Traducir EN + KO</button></div>
          <div id="genProg"></div>
        </div>
        ${c.summary ? `<div class="panelbox"><h3>Resumen</h3><p class="small">${esc(c.summary)}</p></div>` : ''}
      </div>
    </div>

    <div class="row between" style="margin:22px 0 10px"><div><h2>🎞️ Guion · ${c.panels.length} paneles</h2><div class="small muted">✔ ${c.panels.filter(p => p.approved).length} aprobados para Fal.ai · solo los aprobados se generan</div></div>
      <div class="row"><button data-a="pasteScript">📋 Pegar mi guion</button><button data-a="addPanel" data-i="${c.panels.length}">＋ Añadir panel</button>${c.panels.length ? `<button class="ok" data-a="approveAll">✔ Aprobar todos</button>` : ''}</div></div>
    <div class="col" id="panels">${c.panels.map((p, i) => panelCard(m, c, p, i)).join('') || '<div class="empty">Aún no hay paneles. Escribe el guion con IA o añade paneles a mano.</div>'}</div>

    ${c.panels.length ? `<div class="panelbox" style="margin-top:22px"><div class="row between"><h2>🪝 Cliffhanger</h2><button data-a="genCliff">✨ ${c.cliffhangers.length ? 'Otras 3 opciones' : 'Dame 3 finales'}</button></div>
      ${c.cliffhangers.length ? `<div class="grid3">${c.cliffhangers.map((x, i) => `<div class="card ${c.chosenCliff === i ? 'hov' : ''}" style="${c.chosenCliff === i ? 'border-color:var(--neon);box-shadow:var(--glow)' : ''}"><h3>${esc(x.title || 'Opción ' + (i + 1))}</h3><p class="small">${esc(x.description)}</p><button class="sm ${c.chosenCliff === i ? 'ok' : ''}" data-a="pickCliff" data-i="${i}">${c.chosenCliff === i ? '✔ Elegido' : 'Elegir este final'}</button></div>`).join('')}</div>` : '<p class="muted small">Genera 3 finales para dejar a tus lectores enganchados.</p>'}</div>` : ''}`;
};
function apvHTML(p) { return p.approved ? `<span class="chip ok">✔ Aprobado para Fal.ai</span><button class="sm ghost" data-a="approvePanel" data-id="${p.id}">Quitar aprobación</button>` : `<span class="chip warn">Sin aprobar</span><button class="sm ok" data-a="approvePanel" data-id="${p.id}">✔ Aprobar</button>`; }
function panelCard(m, c, p, i) {
  const P = buildPanelPrompt(m, p);
  const U = ` data-onchange="unapprove" data-pid="${p.id}"`;
  return `<div class="pcard ${p.size}" id="pc_${p.id}">
    <div class="col" style="gap:8px"><div class="pimg" ${p.imageId ? `data-img="${p.imageId}"` : ''} data-a="panelImg" data-i="${i}">${p.imageId ? '' : '<span class="ph-t">Sin imagen<br>toca para subir</span>'}</div>
      <button class="sm" data-a="genPanel" data-i="${i}">⚡ Generar</button>${p.seed != null ? `<span class="tiny dim">seed ${p.seed}</span>` : ''}</div>
    <div class="col" style="gap:10px">
      <div class="row between"><div class="row"><span class="pnum">#${i + 1}</span><select style="width:auto;min-height:36px;padding:4px 8px" ${bindAttr(p, 'size')}${U}>${Object.entries(SIZES).map(([k, v]) => `<option value="${k}" ${p.size === k ? 'selected' : ''}>${k} · ${v}</option>`).join('')}</select><input style="width:170px;min-height:36px;padding:4px 10px" placeholder="Plano (ej. primer plano)" ${bindAttr(p, 'shot')}${U} value="${esc(p.shot)}"></div>
        <div class="row"><button class="sm icon" data-a="movePanel" data-i="${i}" data-d="-1" title="Subir">↑</button><button class="sm icon" data-a="movePanel" data-i="${i}" data-d="1" title="Bajar">↓</button><button class="sm icon" data-a="addPanel" data-i="${i + 1}" title="Insertar debajo">＋</button><button class="sm icon danger" data-a="delPanel" data-i="${i}" title="Borrar panel">🗑️</button></div></div>
      <div class="row apv" id="apv_${p.id}">${apvHTML(p)}</div>
      <label class="f">Descripción<textarea style="min-height:60px" ${bindAttr(p, 'description')}${U}>${esc(p.description)}</textarea></label>
      <label class="f">Personajes en el panel (separados por coma)<input data-a2="chars" data-i="${i}" data-change="setChars" value="${esc((p.characters || []).join(', '))}"></label>
      <div class="col" style="gap:6px"><span class="small muted" style="font-weight:600">Diálogos</span>
        ${(p.dialogues || []).map((d, j) => `<div class="dl"><input placeholder="Quién" ${bindAttr(d, 'who')} value="${esc(d.who)}"><select ${bindAttr(d, 'type')}>${Object.entries(DTYPES).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select><textarea placeholder="Texto" ${bindAttr(d, 'text')}>${esc(d.text)}</textarea><button class="sm icon danger" data-a="delDlg" data-i="${i}" data-j="${j}">✕</button>${d.en || d.ko ? `<div class="tiny dim" style="grid-column:1/-1">EN: ${esc(d.en || '—')} · KO: ${esc(d.ko || '—')}</div>` : ''}</div>`).join('')}
        <div><button class="sm" data-a="addDlg" data-i="${i}">＋ Diálogo</button></div></div>
      <label class="f">Efectos de sonido (BOOM, SLASH…)<input data-i="${i}" data-change="setSfx" value="${esc((p.sfx || []).join(', '))}"></label>
      <details><summary class="small muted" style="cursor:pointer">Prompt para Fal.ai ${P.loras.length ? `<span class="chip neon">${P.loras.length} LoRA</span>` : ''}</summary>
        <div class="col" style="gap:8px;margin-top:8px"><label class="f">Escena en inglés<textarea style="min-height:50px" ${bindAttr(p, 'prompt_en')}${U}>${esc(p.prompt_en)}</textarea></label>
        <div class="prompt">${esc(P.prompt)}${P.loras.length ? '\n\nLoRAs: ' + P.loras.map(l => `${l.path} @ ${l.scale}`).join(', ') : ''}\nNegativo: ${esc(P.negative)}\n${P.width}×${P.height} · pasos ${P.steps} · CFG ${P.cfg}</div>
        <label class="f">Prompt manual (opcional, reemplaza el automático)<textarea style="min-height:50px" ${bindAttr(p, 'promptOverride')}${U}>${esc(p.promptOverride || '')}</textarea></label></div></details>
    </div></div>`;
}
ACT.setChars = el => { const m = cur(); const c = chapterById(m, Route.a); const p = c.panels[+el.dataset.i]; p.characters = el.value.split(',').map(s => s.trim()).filter(Boolean); unapproveP(p); touch(m); };
function unapproveP(p) { if (!p.approved) return; p.approved = false; const el = document.getElementById('apv_' + p.id); if (el) el.innerHTML = apvHTML(p); }
ACT.unapprove = el => { const m = cur(); const c = chapterById(m, Route.a); const p = c?.panels.find(x => x.id === el.dataset.pid); if (p) unapproveP(p); };
ACT.approvePanel = el => { const m = cur(); const c = chapterById(m, Route.a); const p = c.panels.find(x => x.id === el.dataset.id); p.approved = !p.approved; touch(m); const box = document.getElementById('apv_' + p.id); if (box) box.innerHTML = apvHTML(p); };
ACT.approveAll = () => { const m = cur(); const c = chapterById(m, Route.a); c.panels.forEach(p => p.approved = true); touch(m); render(); toast(`${plural(c.panels.length, 'panel aprobado', 'paneles aprobados')} para Fal.ai`, 'ok'); };
ACT.setSfx = el => { const m = cur(); const c = chapterById(m, Route.a); c.panels[+el.dataset.i].sfx = el.value.split(',').map(s => s.trim()).filter(Boolean); touch(m); };
ACT.addPanel = el => { const m = cur(); const c = chapterById(m, Route.a); c.panels.splice(+el.dataset.i, 0, mkPanel()); touch(m); render(); };
ACT.delPanel = async el => { const m = cur(); const c = chapterById(m, Route.a); if (!await confirmBox(`¿Borrar el panel #${+el.dataset.i + 1}?`)) return; c.panels.splice(+el.dataset.i, 1); touch(m); render(); };
ACT.movePanel = el => { const m = cur(); const c = chapterById(m, Route.a); const i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= c.panels.length) return; [c.panels[i], c.panels[j]] = [c.panels[j], c.panels[i]]; touch(m); render(); };
ACT.addDlg = el => { const m = cur(); const c = chapterById(m, Route.a); c.panels[+el.dataset.i].dialogues.push({ who: '', type: 'normal', text: '' }); touch(m); render(); };
ACT.delDlg = el => { const m = cur(); const c = chapterById(m, Route.a); c.panels[+el.dataset.i].dialogues.splice(+el.dataset.j, 1); touch(m); render(); };
ACT.dismissWarn = el => { const m = cur(); const c = chapterById(m, Route.a); c.warnings.splice(+el.dataset.i, 1); touch(m); render(); };
ACT.panelImg = async el => {
  const m = cur(); const c = chapterById(m, Route.a); const p = c.panels[+el.dataset.i];
  const [f] = await pickFiles({ multiple: false }); if (!f) return;
  p.imageId = await addImage(m, f, { source: 'subida', panel: p.id }); touch(m); render();
};

/* Director de paneles (local) */
function directorSizes(c) {
  const t = c.tone; const ps = c.panels;
  ps.forEach((p, i) => {
    const hit = (p.sfx || []).length > 0 || /golpe|impacto|explot|corta|ataque|choque|cae|grita/i.test(p.description);
    if (t === 'pelea') p.size = hit ? 'L' : (i % 3 === 2 ? 'L' : 'S');
    else if (t === 'drama' || t === 'romance') p.size = (p.dialogues || []).some(d => d.type === 'pensamiento' || d.type === 'narracion') ? 'XL' : 'L';
    else if (t === 'misterio') p.size = i % 4 === 3 ? 'XL' : 'M';
    else if (t === 'comedia') p.size = hit ? 'M' : 'S';
  });
  if (ps.length) ps[ps.length - 1].size = ps[ps.length - 1].size === 'S' ? 'L' : ps[ps.length - 1].size;
}
ACT.applyDirector = () => { const m = cur(); const c = chapterById(m, Route.a); if (c.tone === 'auto') return toast('Elige un tipo en “Director de paneles” (pelea, drama…)'); directorSizes(c); touch(m); render(); toast('Tamaños de panel ajustados 🎬', 'ok'); };

/* Escribir guion */
ACT.writeScript = async el => {
  const m = cur(); const c = chapterById(m, Route.a);
  const n = Math.min(60, Math.max(5, Number($('#npan').value) || 30)); c.panelTarget = n;
  if (!c.premise.trim()) return toast('Describe primero qué pasa en el capítulo', 'err');
  if (c.panels.length && !await confirmBox(`Este capítulo ya tiene ${c.panels.length} paneles. ¿Reemplazarlos con un guion nuevo? (las imágenes quedan en la Galería)`, { ok: 'Reemplazar', title: 'Reescribir guion' })) return;
  const chars = m.characters.map(x => `${x.name}${x.trigger ? ' [trigger: ' + x.trigger + ']' : ''}: ${x.appearance || ''}`).join('\n');
  const director = { pelea: 'PELEA: paneles pequeños (S), pequeños (S) y GRANDE (L o XL) para cada golpe o impacto. Mucho SFX.', drama: 'DRAMA: paneles grandes (L/XL) y lentos, silencios, primeros planos de emociones.', romance: 'ROMANCE: paneles grandes, miradas, detalles de manos y ojos.', misterio: 'MISTERIO: paneles medianos con un XL de revelación, sombras.', comedia: 'COMEDIA: paneles pequeños y rápidos, reacciones exageradas.', auto: 'Elige el ritmo según la escena: pelea = S,S,L; drama = L lentos.' }[c.tone || 'auto'];
  const prompt = `Eres guionista profesional de manhwa/webtoon vertical. Escribe el guion del Cap ${c.number}${c.title ? ' "' + c.title + '"' : ''}.
PETICIÓN DEL AUTOR: ${c.premise}

CEREBRO DEL MANHWA (respeta TODO, especialmente fichas canon, estados y personalidades):
${brain(m, { skipChapterId: c.id, maxChars: 40000 })}

APARIENCIA DE PERSONAJES:
${chars}

DIRECTOR DE PANELES: ${director}

Escribe EXACTAMENTE ${n} paneles. Diálogos naturales en español, cortos (máx 20 palabras por globo). Efectos de sonido en MAYÚSCULAS (BOOM, SLASH, CRACK, WHOOSH…).
FORMATO: una línea JSON por objeto, sin nada más (JSONL):
{"t":"meta","title":"título del capítulo","summary":"resumen en 3 frases"}
{"t":"panel","size":"S|M|L|XL","shot":"plano (primer plano, plano medio, plano general, picado, contrapicado…)","description":"qué se ve, en español","characters":["Nombre exacto"],"dialogues":[{"who":"Nombre o Narración","type":"normal|grito|pensamiento|narracion|susurro","text":"…"}],"sfx":["BOOM"],"prompt_en":"visual scene description in English for an image model: action, pose, expression, setting, lighting, camera angle (no character names, no text)"}
… (${n} líneas de panel) …
{"t":"cliff","title":"…","description":"opción de final para enganchar"}  (3 líneas cliff)`;
  await busy(el, async () => {
    const { text, stop } = await ai(prompt, { max_tokens: 16000, temperature: 0.85, estOut: n * 260 + 400, title: `Escribir guion de ${n} paneles` });
    const rows = parseJSONL(text);
    const panels = rows.filter(r => r.t === 'panel');
    if (!panels.length) throw new Error('La IA no devolvió paneles. Intenta de nuevo.');
    const meta = rows.find(r => r.t === 'meta');
    c.panels = panels.map(p => mkPanel({ size: SIZES[p.size] ? p.size : 'M', shot: p.shot || '', description: p.description || '', characters: p.characters || [], dialogues: (p.dialogues || []).map(d => ({ who: d.who || '', type: DTYPES[d.type] ? d.type : 'normal', text: d.text || '' })), sfx: p.sfx || [], prompt_en: p.prompt_en || '' }));
    c.cliffhangers = rows.filter(r => r.t === 'cliff').map(x => ({ title: x.title, description: x.description }));
    c.chosenCliff = null;
    if (meta?.title && !c.title) c.title = meta.title;
    if (meta?.summary) c.draftSummary = meta.summary;
    if (m.sample) m.sampleTouched = true;
    touch(m); render();
    toast(`Guion listo: ${c.panels.length} paneles ✨ Revisa, edita y aprueba los que pasen a Fal.ai.${stop === 'max_tokens' ? ' (se cortó al final, añade los que falten)' : ''}`, 'ok');
    const dead = localDeadCheck(m, c); if (dead.length) toast('⚠ ' + dead[0], 'err');
  }, 'Escribiendo guion…');
};
ACT.genCliff = async el => {
  const m = cur(); const c = chapterById(m, Route.a);
  await busy(el, async () => {
    const last = c.panels.slice(-6).map(p => p.description + ' ' + p.dialogues.map(d => d.who + ': ' + d.text).join(' ')).join('\n');
    const r = await aiJSON(`Cerebro:\n${brain(m, { maxChars: 20000 })}\n\nCap ${c.number}: ${c.premise}\nÚltimos paneles:\n${last}\n\nDame 3 finales tipo cliffhanger distintos para dejar al lector desesperado por el siguiente capítulo. Respeta el canon. Formato: [{"title":"…","description":"2-3 frases"}]`, { max_tokens: 1500, estOut: 600, title: '3 finales cliffhanger' });
    c.cliffhangers = (Array.isArray(r) ? r : r.options || []).slice(0, 3); c.chosenCliff = null; touch(m); render();
  }, 'Pensando finales…');
};
ACT.pickCliff = el => { const m = cur(); const c = chapterById(m, Route.a); c.chosenCliff = +el.dataset.i; const x = c.cliffhangers[c.chosenCliff]; if (!c.panels.some(p => p.cliff)) c.panels.push(mkPanel({ size: 'XL', description: x.description, cliff: true, shot: 'plano dramático' })); touch(m); render(); toast('Final elegido: se añadió un panel final XL'); };

/* Continuidad local: muertos que aparecen vivos */
function localDeadCheck(m, c) {
  const out = [];
  const dead = m.canon.filter(f => /estado|vida|vivo|muert/i.test(f.attribute) && /muert|fallec|asesinad|murio|murió/i.test(f.value) && Number(f.since) && Number(f.since) < Number(c.number));
  for (const f of dead) {
    const n = norm(f.entity);
    const idx = (c.panels || []).findIndex(p => (p.characters || []).some(x => norm(x) === n) || (p.dialogues || []).some(d => norm(d.who) === n));
    if (idx >= 0 && !(c.panels[idx].description || '').match(/recuerdo|flashback|fantasma|sueño|visión/i)) out.push(`${f.entity} murió en el Cap ${f.since} y aparece en el panel ${idx + 1} de este Cap ${c.number}. Si es un recuerdo, escribe “flashback” en la descripción.`);
  }
  m.characters.filter(ch => ch.status === 'muerto').forEach(ch => {
    if (dead.some(f => norm(f.entity) === norm(ch.name))) return;
    const idx = (c.panels || []).findIndex(p => (p.dialogues || []).some(d => norm(d.who) === norm(ch.name)));
    if (idx >= 0) out.push(`${ch.name} está marcado como muerto en su ficha y habla en el panel ${idx + 1}.`);
  });
  return out;
}
function scriptText(c) { return c.panels.map((p, i) => `P${i + 1} [${p.size}] ${p.description} | personajes: ${(p.characters || []).join(', ')} | ${(p.dialogues || []).map(d => `${d.who} (${d.type}): ${d.text}`).join(' / ')}${(p.sfx || []).length ? ' | SFX: ' + p.sfx.join(' ') : ''}`).join('\n'); }
ACT.checkCont = async el => {
  const m = cur(); const c = chapterById(m, Route.a);
  if (!c.panels.length) return toast('Primero escribe el guion', 'err');
  await busy(el, async () => {
    const r = await aiJSON(`Eres el DETECTOR DE CONTINUIDAD y GUARDIÁN DE PERSONAJES de un manhwa. Compara el guion del Cap ${c.number} con el cerebro.
CEREBRO:
${brain(m, { skipChapterId: c.id })}

GUION DEL CAP ${c.number}:
${scriptText(c)}

Busca SOLO problemas reales:
1. Continuidad: contradicciones con fichas canon (cicatriz de lado distinto, color de ojos, objetos, lugares), personajes muertos que aparecen vivos sin explicación, reglas del mundo rotas.
2. Personajes: cambios de emoción o personalidad sin motivo respecto a capítulos anteriores (ej. estaba furioso y de repente feliz), habla fuera de personaje.
3. Repetición: escenas o tramas que ya se contaron en capítulos anteriores.
Formato: [{"type":"Continuidad|Personaje|Repetición","severity":"alta|media","panel":número o null,"message":"explicación clara y corta","suggestion":"cómo arreglarlo"}]. Si no hay problemas devuelve [].`, { max_tokens: 3000, temperature: 0.2, estOut: 800, title: 'Revisar continuidad' });
    c.warnings = Array.isArray(r) ? r : (r.warnings || []); touch(m); render();
    toast(c.warnings.length ? `Encontré ${c.warnings.length} posible(s) problema(s)` : 'Todo en orden ✔', c.warnings.length ? '' : 'ok');
  }, 'Revisando…');
};
ACT.finishCap = async el => {
  const m = cur(); const c = chapterById(m, Route.a);
  if (!c.panels.length) return toast('El capítulo no tiene guion todavía', 'err');
  await busy(el, async () => {
    const r = await aiJSON(`Analiza el Cap ${c.number} de este manhwa y extrae lo que cambió en la historia.
CEREBRO ACTUAL:
${brain(m, { skipChapterId: c.id, maxChars: 30000 })}
GUION:
${scriptText(c)}
Devuelve: {"summary":"resumen del capítulo en 3-5 frases","facts":[{"entity":"nombre","attribute":"atributo corto (estado, cicatriz, emoción, ubicación, relación con X, objeto, rango…)","value":"valor","note":"por qué"}]}
Incluye SOLO hechos NUEVOS o que CAMBIARON en este capítulo (no repitas fichas canon existentes). Incluye la emoción con la que termina cada personaje importante (atributo "emoción") y muertes (atributo "estado", valor "muerto"). Máximo 12 hechos.`, { max_tokens: 2500, temperature: 0.3, estOut: 900, title: 'Detectar hechos nuevos' });
    showFacts(m, c, r);
  }, 'Detectando hechos…');
};
function showFacts(m, c, r) {
  const facts = (r.facts || []).map(f => ({ ...f, id: uid('k_'), since: c.number }));
  const bg = modal(`<h2>🧠 Nuevos hechos detectados · Cap ${c.number}</h2><p class="muted small">Nada se guarda sin tu permiso. Da CONSERVAR a lo que sea canon.</p>
    <div class="panelbox"><div class="row between"><b>Resumen del capítulo</b><button class="sm ok" data-x="sum">✔ CONSERVAR</button></div><textarea id="fsum">${esc(r.summary || '')}</textarea></div>
    <div class="col" id="flist">${facts.map((f, i) => `<div class="card row nw between" data-fi="${i}"><div class="small grow"><b>${esc(f.entity)}</b> · ${esc(f.attribute)} · <b>${esc(f.value)}</b> · desde Cap ${c.number}${f.note ? `<div class="tiny dim">${esc(f.note)}</div>` : ''}</div><div class="row nw"><button class="sm ok" data-keep="${i}">✔ CONSERVAR</button><button class="sm danger" data-drop="${i}">✕</button></div></div>`).join('') || '<p class="muted">No detecté hechos nuevos.</p>'}</div>
    <div class="acts"><button data-x="all" class="ok">Conservar todo</button><button class="pri" data-x="done">Listo</button></div>`, { wide: true });
  const keep = i => { const f = facts[i]; if (!f || f.kept) return; f.kept = true; m.canon.push({ id: f.id, entity: f.entity, attribute: f.attribute, value: f.value, since: f.since, note: f.note || '' }); if (/estado/i.test(f.attribute) && /muert/i.test(f.value)) { const ch = charByName(m, f.entity); if (ch) ch.status = 'muerto'; } const row = bg.querySelector(`[data-fi="${i}"]`); row && (row.innerHTML = `<span class="chip ok">✔ Guardado: ${esc(f.entity)} · ${esc(f.attribute)} · ${esc(f.value)}</span>`); touch(m); };
  bg.querySelectorAll('[data-keep]').forEach(b => b.onclick = () => keep(+b.dataset.keep));
  bg.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => bg.querySelector(`[data-fi="${b.dataset.drop}"]`).remove());
  bg.querySelector('[data-x=sum]').onclick = e => { c.summary = bg.querySelector('#fsum').value.trim(); touch(m); e.target.outerHTML = '<span class="chip ok">✔ Guardado</span>'; };
  bg.querySelector('[data-x=all]').onclick = () => { facts.forEach((_, i) => bg.querySelector(`[data-fi="${i}"]`) && keep(i)); if (!c.summary) { c.summary = bg.querySelector('#fsum').value.trim(); } touch(m); toast('Todo conservado', 'ok'); };
  bg.querySelector('[data-x=done]').onclick = () => { if (c.status === 'Borrador') c.status = 'Listo'; touch(m); bg.close(); render(); };
}

/* Traducción */
ACT.translateCap = async el => {
  const m = cur(); const c = chapterById(m, Route.a);
  const items = []; c.panels.forEach((p, i) => { (p.dialogues || []).forEach((d, j) => d.text && items.push({ k: `${i}.${j}`, text: d.text })); (p.sfx || []).forEach((s, j) => items.push({ k: `${i}.s${j}`, text: s })); });
  if (!items.length) return toast('No hay diálogos que traducir', 'err');
  const per = isPremium() ? 1000 : 60;
  const chars = JSON.stringify(items).length + 400;
  if (!isPremium() && !await confirmCost('Traducir diálogos a inglés y coreano', [aiLine(chars * 1, Math.round(items.length * 45), 6000 * Math.ceil(items.length / per), `Traducir ${items.length} textos`)])) return;
  await busy(el, async () => {
    const out = {};
    for (let a = 0; a < items.length; a += per) {
      const chunk = items.slice(a, a + per);
      const r = await aiJSON(`Traduce estos diálogos de manhwa al INGLÉS y al COREANO, con tono natural de webtoon. Los efectos de sonido tradúcelos como onomatopeyas nativas (ej. BOOM → 쾅). Mantén la "k".
${JSON.stringify(chunk)}
Formato: [{"k":"…","en":"…","ko":"…"}]`, { max_tokens: Math.min(32000, 120 * chunk.length + 500), temperature: 0.3, confirmed: true, title: 'Traducir diálogos' });
      (Array.isArray(r) ? r : []).forEach(x => out[x.k] = x);
    }
    c.panels.forEach((p, i) => { (p.dialogues || []).forEach((d, j) => { const t = out[`${i}.${j}`]; if (t) { d.en = t.en; d.ko = t.ko; } }); p.sfxTr = (p.sfx || []).map((s, j) => out[`${i}.s${j}`] || { en: s, ko: s }); });
    // actualizar capas del armador que vienen de diálogos
    (c.layout.items || []).forEach(it => (it.layers || []).forEach(L => { if (L.src) { const [i, j] = L.src.split('.'); const p = c.panels[+i]; if (!p) return; if (j?.startsWith('s')) { const t = p.sfxTr?.[+j.slice(1)]; if (t) { L.text_en = t.en; L.text_ko = t.ko; } } else { const d = p.dialogues[+j]; if (d) { L.text_en = d.en || L.text_en; L.text_ko = d.ko || L.text_ko; } } } }));
    touch(m); render(); toast('Diálogos traducidos a inglés y coreano 🌐', 'ok');
  }, 'Traduciendo…');
};

/* Enviar paneles al armador con globos como capas editables */
ACT.toBuilder = () => {
  const m = cur(); const c = chapterById(m, Route.a);
  const withImg = c.panels.map((p, i) => ({ p, i })).filter(x => x.p.imageId);
  if (!withImg.length) { go(mlink(m, 'armador', c.id)); return toast('Aún no hay imágenes en los paneles. Sube o genera imágenes en el armador.'); }
  const existing = new Set((c.layout.items || []).map(it => it.fromPanel));
  for (const { p, i } of withImg) {
    if (existing.has(p.id)) continue;
    const it = { id: uid('it_'), imgId: p.imageId, fromPanel: p.id, gap: p.size === 'XL' ? 160 : p.size === 'S' ? 40 : 90, scale: 100, layers: [], anim: { enter: 'fade', kb: p.size === 'XL' ? 'in' : 'none', shake: (p.sfx || []).length > 0 && /BOOM|CRACK|BAM|POW|KABOOM/i.test((p.sfx || []).join(' ')), particles: 'none', parallax: false, dur: 0 } };
    let y = 0.04;
    (p.dialogues || []).forEach((d, j) => {
      const kind = d.type === 'narracion' ? 'narracion' : d.type === 'pensamiento' ? 'pensamiento' : d.type === 'grito' ? 'grito' : 'globo';
      const left = j % 2 === 0;
      it.layers.push(mkLayer(kind, { x: left ? 0.05 : 0.45, y, w: 0.5, h: kind === 'narracion' ? 0.1 : 0.16, text: d.text, text_en: d.en || '', text_ko: d.ko || '', src: `${i}.${j}`, who: d.who || '', tail: left ? 'bl' : 'br', anim: kind === 'narracion' ? 'type' : 'pop' }));
      y = Math.min(0.75, y + 0.19);
    });
    (p.sfx || []).forEach((s, j) => it.layers.push(mkLayer('sfx', { x: 0.5 - 0.2 + (j * 0.08), y: 0.6, w: 0.42, h: 0.18, text: s, text_en: p.sfxTr?.[j]?.en || s, text_ko: p.sfxTr?.[j]?.ko || '', src: `${i}.s${j}`, rot: -8 })));
    c.layout.items.push(it);
  }
  touch(m); go(mlink(m, 'armador', c.id)); toast('Paneles enviados al Editor de Manhwa con sus globos 🧩', 'ok');
};

/* ---------------- Pegar un guion propio (gratis, sin IA) ---------------- */
const DTYPE_WORDS = { pensando: 'pensamiento', pensamiento: 'pensamiento', piensa: 'pensamiento', grita: 'grito', gritando: 'grito', grito: 'grito', susurra: 'susurro', susurrando: 'susurro', susurro: 'susurro', narración: 'narracion', narracion: 'narracion' };
function parseManualScript(m, text) {
  const panels = []; let curP = null;
  const head = /^\s*(?:#+\s*)?(?:panel|vi[ñn]eta|cuadro|escena|p)\s*\.?\s*(\d+)\s*[:.\-)\]]?\s*(.*)$/i;
  const newP = () => { curP = mkPanel(); panels.push(curP); return curP; };
  for (const raw of String(text).split('\n')) {
    const l = raw.trim(); if (!l) continue;
    let mm;
    if ((mm = l.match(head))) { newP(); if (mm[2]) curP.description = mm[2].trim(); continue; }
    if (/^[-=*_]{3,}$/.test(l)) { newP(); continue; }
    const p = curP || newP();
    if ((mm = l.match(/^(?:sfx|efectos?|sonidos?|onomatopeyas?)\s*[:\-]\s*(.+)$/i))) { p.sfx.push(...mm[1].split(/[,/]/).map(x => x.trim().replace(/^["“]|["”]$/g, '')).filter(Boolean)); continue; }
    if ((mm = l.match(/^(?:tama[ñn]o|size)\s*[:\-]\s*(xl|l|m|s)\b/i))) { p.size = mm[1].toUpperCase(); continue; }
    if ((mm = l.match(/^(?:plano|shot|c[aá]mara)\s*[:\-]\s*(.+)$/i))) { p.shot = mm[1]; continue; }
    if ((mm = l.match(/^(?:prompt|prompt en ingl[eé]s)\s*[:\-]\s*(.+)$/i))) { p.prompt_en = mm[1]; continue; }
    if ((mm = l.match(/^(?:personajes?)\s*[:\-]\s*(.+)$/i))) { p.characters = mm[1].split(/[,y]/).map(x => x.trim()).filter(Boolean); continue; }
    if ((mm = l.match(/^(?:descripci[oó]n|desc|acci[oó]n|imagen|se ve)\s*[:\-]\s*(.+)$/i))) { p.description = (p.description ? p.description + ' ' : '') + mm[1]; continue; }
    if ((mm = l.match(/^(?:narraci[oó]n|narrador|cuadro de texto)\s*[:\-]\s*(.+)$/i))) { p.dialogues.push({ who: 'Narración', type: 'narracion', text: mm[1].replace(/^["“]|["”]$/g, '') }); continue; }
    if ((mm = l.match(/^([A-ZÁÉÍÓÚÑa-záéíóúñ][\wÁÉÍÓÚÑáéíóúñ' .]{0,24}?)\s*(?:\(([^)]+)\))?\s*:\s*(.+)$/))) {
      const tw = norm(mm[2] || ''); const type = Object.entries(DTYPE_WORDS).find(([k]) => tw.includes(norm(k)))?.[1] || (/^¡.*!$/.test(mm[3].trim()) && mm[3].length < 30 ? 'grito' : 'normal');
      p.dialogues.push({ who: mm[1].trim(), type, text: mm[3].trim().replace(/^["“—–-]\s*|["”]$/g, '') }); continue;
    }
    if ((mm = l.match(/^[—–]\s*(.+)$/))) { p.dialogues.push({ who: '', type: 'normal', text: mm[1] }); continue; }
    p.description = (p.description ? p.description + ' ' : '') + l;
  }
  // detectar personajes conocidos
  for (const p of panels) {
    const set = new Set(p.characters);
    p.dialogues.forEach(d => { const ch = charByName(m, d.who); if (ch) set.add(ch.name); });
    m.characters.forEach(ch => { if (ch.name && norm(p.description).split(' ').includes(norm(ch.name))) set.add(ch.name); });
    p.characters = [...set];
  }
  return panels.filter(p => p.description || p.dialogues.length || p.sfx.length);
}
ACT.pasteScript = () => {
  const m = cur(); const c = chapterById(m, Route.a);
  const bg = modal(`<h2>📋 Pegar mi guion</h2>
    <p class="small muted">Pega el guion que ya tienes. Separa cada panel con <span class="kbd">Panel 1</span>, <span class="kbd">Panel 2</span>… Los diálogos como <span class="kbd">Kael: texto</span>, pensamientos <span class="kbd">Kael (pensando): texto</span>, y efectos <span class="kbd">SFX: BOOM</span>. Opcional: <span class="kbd">Tamaño: L</span>, <span class="kbd">Plano: primer plano</span>, <span class="kbd">Prompt: …</span></p>
    <textarea id="msc" style="min-height:260px" placeholder="Panel 1&#10;Vista nocturna de Velmora bajo la lluvia.&#10;Narración: Hace cien años, el cielo se rompió.&#10;&#10;Panel 2&#10;Kael corre por el pasillo.&#10;Kael: ¡Llego tarde otra vez!&#10;SFX: TAP TAP"></textarea>
    <div id="mprev" class="small muted"></div>
    <div class="acts"><button data-x="no">Cancelar</button><button data-x="ai">🤖 Ordenarlo con IA</button>${c.panels.length ? '<button data-x="add">Añadir al final</button>' : ''}<button class="pri" data-x="rep">${c.panels.length ? 'Reemplazar guion' : 'Usar este guion'}</button></div>`, { wide: true });
  const ta = bg.querySelector('#msc');
  ta.oninput = debounce(() => { const ps = parseManualScript(m, ta.value); bg.querySelector('#mprev').textContent = ps.length ? `Detecté ${plural(ps.length, 'panel', 'paneles')} y ${ps.reduce((a, p) => a + p.dialogues.length, 0)} diálogos. Todos quedan SIN aprobar para que los revises.` : ''; }, 300);
  const use = async mode => {
    const ps = parseManualScript(m, ta.value); if (!ps.length) return toast('No detecté paneles. Escribe “Panel 1”, “Panel 2”…', 'err');
    if (mode === 'rep' && c.panels.length && !await confirmBox(`¿Reemplazar los ${c.panels.length} paneles actuales?`, { ok: 'Reemplazar' })) return;
    c.panels = mode === 'add' ? [...c.panels, ...ps] : ps; touch(m); bg.close(); render(); toast(`${plural(ps.length, 'panel cargado', 'paneles cargados')}. Revisa y aprueba ✔`, 'ok');
  };
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=rep]').onclick = () => use('rep');
  const ad = bg.querySelector('[data-x=add]'); if (ad) ad.onclick = () => use('add');
  bg.querySelector('[data-x=ai]').onclick = async e => {
    const txt = ta.value.trim(); if (!txt) return toast('Pega tu guion primero', 'err');
    const chars = m.characters.map(x => `${x.name}: ${x.appearance || ''}`).join('\n');
    const prompt = `Convierte este guion de manhwa escrito por el autor al formato de paneles. NO inventes ni cambies la historia ni los diálogos: respeta su texto, solo ordénalo. Si un panel no tiene tamaño, elige S/M/L/XL según el ritmo. Escribe "prompt_en" (descripción visual en inglés, sin nombres ni texto).
Personajes conocidos:\n${chars}
GUION DEL AUTOR:\n${txt}
FORMATO JSONL (una línea por panel, nada más):
{"t":"panel","size":"S|M|L|XL","shot":"…","description":"…","characters":["…"],"dialogues":[{"who":"…","type":"normal|grito|pensamiento|narracion|susurro","text":"…"}],"sfx":["…"],"prompt_en":"…"}`;
    await busy(e.target, async () => {
      const { text } = await ai(prompt, { max_tokens: 16000, estOut: Math.round(txt.length / 2.5) + 2000, title: 'Ordenar mi guion en paneles', temperature: 0.2 });
      const rows = parseJSONL(text).filter(r => r.t === 'panel' || r.description);
      if (!rows.length) throw new Error('No se pudieron leer los paneles. Intenta de nuevo.');
      const ps = rows.map(p => mkPanel({ size: SIZES[p.size] ? p.size : 'M', shot: p.shot || '', description: p.description || '', characters: p.characters || [], dialogues: (p.dialogues || []).map(d => ({ who: d.who || '', type: DTYPES[d.type] ? d.type : 'normal', text: d.text || '' })), sfx: p.sfx || [], prompt_en: p.prompt_en || '' }));
      if (c.panels.length && !await confirmBox(`La IA ordenó ${ps.length} paneles. ¿Reemplazar los ${c.panels.length} actuales? (Cancelar = añadir al final)`, { ok: 'Reemplazar', danger: true })) c.panels = [...c.panels, ...ps]; else c.panels = ps;
      touch(m); bg.close(); render(); toast(`${plural(ps.length, 'panel', 'paneles')} listos. Revisa y aprueba ✔`, 'ok');
    }, 'Ordenando…');
  };
};
