/* =====================================================================
   Panel de manhwas, Biblia, Wiki, Canon, Ideas, Búsqueda, Galería
   ===================================================================== */
const REL_KINDS = ['amigo', 'enemigo', 'enamorado', 'familia', 'rival', 'aliado', 'maestro', 'alumno', 'vive en', 'pertenece a', 'usa', 'creó', 'otro'];
const TYPES = {
  personajes: { key: 'characters', label: 'Personajes', one: 'personaje', icon: '👤', fields: [
    ['name', 'Nombre'], ['nickname', 'Apodo'], ['age', 'Edad'], ['role', 'Qué hace / rol'], ['status', 'Estado', 'select', ['vivo', 'muerto', 'desaparecido', 'desconocido']],
    ['power', 'Poder', 'area'], ['weakness', 'Debilidad', 'area'], ['trauma', 'Trauma', 'area'], ['goal', 'Objetivo', 'area'],
    ['appearance', 'Apariencia (cómo se ve)', 'area'], ['evolution', 'Evolución (Cap 1 vs Cap 30)', 'area'],
    ['trigger', 'Trigger word (LoRA)'], ['loraId', 'LoRA ID / URL'], ['loraWeight', 'Peso LoRA', 'num'], ['notes', 'Notas', 'area']] },
  lugares: { key: 'places', label: 'Lugares', one: 'lugar', icon: '🏰', fields: [
    ['name', 'Nombre'], ['kind', 'Tipo', 'select', ['Ciudad', 'Reino', 'Escuela', 'Dimensión', 'Edificio', 'Región', 'Otro']], ['description', 'Descripción', 'area'], ['climate', 'Clima'], ['inhabitants', 'Quién vive ahí', 'area'], ['rules', 'Reglas', 'area'], ['notes', 'Notas', 'area']] },
  poderes: { key: 'powers', label: 'Poderes y sistema', one: 'poder', icon: '⚡', fields: [
    ['name', 'Nombre'], ['kind', 'Tipo', 'select', ['Sistema de poder', 'Poder', 'Técnica', 'Rango', 'Maldición', 'Otro']], ['description', 'Cómo funciona', 'area'], ['ranks', 'Rangos / niveles', 'area'], ['cost', 'Costo de usarlo', 'area'], ['users', 'Quién lo usa'], ['notes', 'Notas', 'area']] },
  objetos: { key: 'objects', label: 'Objetos y armas', one: 'objeto', icon: '🗡️', fields: [
    ['name', 'Nombre'], ['kind', 'Tipo', 'select', ['Arma', 'Artefacto', 'Reliquia', 'Objeto', 'Otro']], ['description', 'Descripción', 'area'], ['owner', 'Dueño'], ['power', 'Poder / efecto', 'area'], ['cost', 'Costo de usarlo', 'area'], ['notes', 'Notas', 'area']] },
  facciones: { key: 'factions', label: 'Facciones y gremios', one: 'facción', icon: '🛡️', fields: [
    ['name', 'Nombre'], ['kind', 'Tipo', 'select', ['Facción', 'Gremio', 'Familia', 'Organización', 'Reino', 'Otro']], ['description', 'Descripción', 'area'], ['leader', 'Líder'], ['goals', 'Objetivos', 'area'], ['notes', 'Notas', 'area']] },
  historia: { key: 'timeline', label: 'Historia del mundo', one: 'evento', icon: '⏳', fields: [
    ['name', 'Evento'], ['when', 'Cuándo (ej. Hace 100 años)'], ['order', 'Orden (número, menor = más antiguo)', 'num'], ['description', 'Qué pasó', 'area'], ['notes', 'Notas', 'area']] }
};
const typeOfKey = key => Object.keys(TYPES).find(k => TYPES[k].key === key);

/* ---------------- Manhwa de ejemplo ---------------- */
function sampleManhwa() {
  const m = newManhwa('Mi Primer Manhwa');
  m.sample = true;
  Object.assign(m.bible, {
    genre: 'Fantasía oscura · acción · academia', tone: 'Épico, intenso, con momentos de humor',
    synopsis: 'Kael, un chico sin poder en un mundo donde todos despiertan una Resonancia a los 16, descubre a los 17 que su sombra está viva… y que fue ella quien borró a sus padres.',
    plot: 'Kael entra a la Academia Aurora en Velmora para encontrar respuestas sobre la desaparición de sus padres. Con ayuda de Lira descubre que el Gremio del Alba oculta la verdad sobre la Gran Fractura. Draven, un antiguo alumno, quiere usar la sombra de Kael para abrir de nuevo la Fractura.',
    rules: 'La Resonancia despierta a los 16 años. Usarla cuesta energía vital: si se abusa, el cabello se vuelve blanco. Nadie puede tener dos Resonancias. Las sombras no tienen voluntad propia… excepto la de Kael.'
  });
  const kael = { id: uid('c_'), name: 'Kael', nickname: 'El Sin Eco', age: '17', role: 'Protagonista, estudiante de la Academia Aurora', status: 'vivo', power: 'Sombra viviente que absorbe ataques', weakness: 'Si se aleja de la luz pierde el control de la sombra', trauma: 'La desaparición de sus padres hace 10 años', goal: 'Descubrir qué pasó con sus padres', appearance: 'Chico delgado, cabello negro despeinado, ojos grises, cicatriz pequeña en la ceja izquierda, chaqueta negra del uniforme abierta', evolution: 'Cap 1: inseguro y solitario. Cap 30: líder que acepta su sombra.', trigger: 'kaelmh', loraId: '', loraWeight: 0.9, notes: '', relations: [], createdAt: Date.now() };
  const lira = { id: uid('c_'), name: 'Lira', nickname: 'Chispa', age: '17', role: 'Compañera de clase, prodigio de la Resonancia de luz', status: 'vivo', power: 'Luz sólida', weakness: 'Se agota rápido; impulsiva', trauma: 'Presión de su familia noble', goal: 'Ser la primera Rango S de su generación', appearance: 'Chica de cabello rubio corto, ojos ámbar, uniforme blanco, guantes dorados', evolution: '', trigger: 'liramh', loraId: '', loraWeight: 0.85, relations: [{ target: kael.id, kind: 'aliado', note: 'Al principio rivales' }], createdAt: Date.now() };
  const draven = { id: uid('c_'), name: 'Draven', nickname: 'El Profeta Gris', age: '29', role: 'Villano, exalumno expulsado', status: 'vivo', power: 'Controla ecos de Resonancias robadas', weakness: 'Cada eco robado le quita un recuerdo', trauma: 'Fue expulsado por un experimento fallido', goal: 'Reabrir la Gran Fractura', appearance: 'Hombre alto, cabello gris largo, abrigo negro con bordes plateados, ojos violetas', trigger: 'dravenmh', loraWeight: 0.9, relations: [{ target: kael.id, kind: 'enemigo', note: 'Quiere su sombra' }], createdAt: Date.now() };
  kael.relations.push({ target: lira.id, kind: 'aliado', note: '' });
  m.characters.push(kael, lira, draven);
  m.bible.protagonistId = kael.id;
  const vel = { id: uid('p_'), name: 'Velmora', kind: 'Ciudad', description: 'Ciudad vertical construida sobre la cicatriz de la Gran Fractura. De noche las torres brillan en azul.', climate: 'Lluvioso y frío', inhabitants: 'Estudiantes, gremios y mercaderes de reliquias', rules: 'Prohibido usar Resonancia fuera de las zonas marcadas', relations: [], createdAt: Date.now() };
  const aca = { id: uid('p_'), name: 'Academia Aurora', kind: 'Escuela', description: 'Academia de élite para despertar y entrenar Resonancias.', climate: '', inhabitants: 'Estudiantes de 16 a 20 años', rules: 'Duelos solo en la arena', relations: [{ target: vel.id, kind: 'pertenece a', note: '' }], createdAt: Date.now() };
  m.places.push(vel, aca);
  m.powers.push({ id: uid('w_'), name: 'Resonancia', kind: 'Sistema de poder', description: 'Energía que despierta a los 16 años y toma la forma del alma de cada persona.', ranks: 'F, E, D, C, B, A, S', cost: 'Energía vital; el abuso vuelve blanco el cabello', users: 'Casi todos', relations: [], createdAt: Date.now() });
  m.objects.push({ id: uid('o_'), name: 'Espada Umbra', kind: 'Arma', description: 'Espada negra que solo corta lo que la sombra toca.', owner: 'Kael', power: 'Corta Resonancias', cost: 'Pesa más cuanto más miedo siente quien la usa', relations: [], createdAt: Date.now() });
  m.factions.push({ id: uid('f_'), name: 'Gremio del Alba', kind: 'Gremio', description: 'Gremio que protege Velmora y oculta la verdad de la Fractura.', leader: 'Desconocido', goals: 'Mantener la Fractura cerrada a cualquier costo', relations: [], createdAt: Date.now() });
  m.timeline.push(
    { id: uid('t_'), name: 'La Gran Fractura', when: 'Hace 100 años', order: 1, description: 'Una grieta en el cielo dio origen a la Resonancia.', relations: [] },
    { id: uid('t_'), name: 'Desaparecen los padres de Kael', when: 'Hace 10 años', order: 2, description: 'Investigaban la Fractura para el Gremio del Alba.', relations: [] }
  );
  m.canon.push(
    { id: uid('k_'), entity: 'Kael', attribute: 'cicatriz', value: 'ceja izquierda', since: 1, note: '' },
    { id: uid('k_'), entity: 'Kael', attribute: 'color de ojos', value: 'gris', since: 1, note: '' },
    { id: uid('k_'), entity: 'Lira', attribute: 'color de cabello', value: 'rubio corto', since: 1, note: '' }
  );
  const c1 = newChapter(m, 1, 'El chico sin eco', 'Kael llega tarde a la ceremonia de despertar y su sombra se mueve sola frente a todos.');
  c1.status = 'Borrador';
  c1.panels = [
    mkPanel({ size: 'XL', shot: 'plano general', description: 'Vista nocturna de Velmora, torres que brillan en azul bajo la lluvia.', characters: [], dialogues: [{ who: 'Narración', type: 'narracion', text: 'Hace cien años, el cielo se rompió.' }], sfx: [], prompt_en: 'night city of tall towers glowing blue, rain, giant crack in the sky, wide establishing shot' }),
    mkPanel({ size: 'M', shot: 'plano medio', description: 'Kael corre por un pasillo de la academia, jadeando.', characters: ['Kael'], dialogues: [{ who: 'Kael', type: 'normal', text: '¡No, no, no! ¡Llego tarde otra vez!' }], sfx: ['TAP TAP'], prompt_en: 'boy running through a grand academy corridor, motion lines, panicked expression' }),
    mkPanel({ size: 'S', shot: 'primer plano', description: 'La sombra de Kael en el suelo sonríe.', characters: ['Kael'], dialogues: [], sfx: ['...'], prompt_en: 'close up of a shadow on the floor smiling with white eyes, creepy' }),
    mkPanel({ size: 'L', shot: 'plano general', description: 'Toda la ceremonia voltea a ver a Kael. Lira lo mira con desprecio.', characters: ['Kael', 'Lira'], dialogues: [{ who: 'Lira', type: 'normal', text: '¿Ese es el chico sin eco?' }], sfx: [], prompt_en: 'ceremony hall full of students turning to look at the boy at the entrance, blonde girl with amber eyes looking down on him' })
  ];
  m.chapters.push(c1);
  m.chapters.push(newChapter(m, 2, 'La academia de las sombras', 'Primer día de clases: Kael y Lira son obligados a ser compañeros.'));
  return m;
}

/* ---------------- Panel principal ---------------- */
function lastChapter(m) { const l = chapterList(m); return l[l.length - 1]; }
function progress(m) { const l = m.chapters || []; if (!l.length) return 0; const s = { 'Borrador': 0.15, 'Generando': 0.4, 'Listo': 0.8, 'Publicado': 1 }; return Math.round(100 * l.reduce((a, c) => a + (s[c.status] || 0), 0) / l.length); }
VIEWS.home = () => {
  const list = Object.values(S.manhwas).filter(m => S.showArchived ? m.archived : !m.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const archivedN = Object.values(S.manhwas).filter(m => m.archived).length;
  return `<div class="head"><div><h1>${S.showArchived ? 'Manhwas archivados' : 'Mis Manhwas'}</h1><p class="muted">Cada manhwa tiene su propio cerebro, historia, personajes y LoRAs. Nunca se mezclan.</p></div>
    <div class="row"><button class="ghost" data-a="toggleArchived">${S.showArchived ? '← Ver activos' : `🗄️ Archivados (${archivedN})`}</button><button class="pri big" data-a="newManhwa">＋ CREAR NUEVO MANHWA</button></div></div>
    ${!S.user ? `<div class="alert info" style="margin-bottom:16px">💾 Estás en modo local. <b>&nbsp;Inicia sesión en Configuración</b>&nbsp;para guardar en la nube, ver lo mismo en celular y PC, y usar la IA y Fal.ai.</div>` : ''}
    <div class="cards">
    ${S.showArchived ? '' : `<div class="newcard" data-a="newManhwa"><div class="plus">＋</div>CREAR NUEVO MANHWA</div>`}
    ${list.map(m => {
      const lc = lastChapter(m); const p = progress(m);
      return `<div class="mcard" data-a="go" data-to="${mlink(m, 'biblia')}">
        <div class="mcover" ${m.coverImg ? `data-img="${m.coverImg}" data-mid="${m.id}"` : `style="background:linear-gradient(160deg,#2a1145,#0f0f14 70%)"`}>${m.coverImg ? '' : `<div class="ini">${esc((m.name || '?').slice(0, 1).toUpperCase())}</div>`}${m.archived ? '<span class="chip warn arch">Archivado</span>' : ''}</div>
        <div class="body"><h3>${esc(m.name)}</h3>
        <div class="small muted">${lc ? `Último: Cap ${lc.number} · ${esc(lc.title || '')}` : 'Sin capítulos'} · ${plural((m.chapters || []).length, 'capítulo', 'capítulos')}</div>
        <div class="row nw small"><div class="bar grow"><i style="width:${p}%"></i></div><span class="muted">${p}%</span></div>
        <div class="acts">
          <button class="sm" data-a="renameManhwa" data-id="${m.id}">✏️ Renombrar</button>
          <button class="sm" data-a="dupManhwa" data-id="${m.id}">⧉ Duplicar</button>
          <button class="sm" data-a="archManhwa" data-id="${m.id}">${m.archived ? '↩ Desarchivar' : '🗄️ Archivar'}</button>
          <button class="sm danger" data-a="delManhwa" data-id="${m.id}">🗑️ Borrar</button>
        </div></div></div>`;
    }).join('')}
    </div>${!list.length && S.showArchived ? '<div class="empty">No tienes manhwas archivados.</div>' : ''}`;
};
ACT.toggleArchived = () => { S.showArchived = !S.showArchived; render(); };
ACT.newManhwa = async () => {
  const bg = modal(`<h2>Crear nuevo manhwa</h2>
    <label class="f">Nombre<input id="nm" autofocus placeholder="Ej. El Último Cazador"></label>
    <label class="f">Sinopsis (opcional)<textarea id="ns" placeholder="¿De qué trata?"></textarea></label>
    <label class="f">Género (opcional)<input id="ng" placeholder="Fantasía, acción, romance…"></label>
    <div class="acts"><button data-x="no">Cancelar</button><button class="pri" data-x="ok">Crear manhwa</button></div>`);
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=ok]').onclick = () => {
    const name = bg.querySelector('#nm').value.trim(); if (!name) return toast('Ponle un nombre', 'err');
    const dupe = Object.values(S.manhwas).find(x => norm(x.name) === norm(name));
    const m = newManhwa(name); m.bible.synopsis = bg.querySelector('#ns').value.trim(); m.bible.genre = bg.querySelector('#ng').value.trim();
    S.manhwas[m.id] = m; touch(m); bg.close(); toast('Manhwa creado ✨', 'ok'); go(mlink(m, 'biblia'));
    if (dupe) toast(`Ojo: ya tenías otro manhwa llamado "${dupe.name}".`);
  };
};
ACT.renameManhwa = async el => { const m = S.manhwas[el.dataset.id]; const n = await promptBox('Renombrar manhwa', m.name); if (n && n.trim()) { m.name = n.trim(); touch(m); render(); } };
ACT.archManhwa = el => { const m = S.manhwas[el.dataset.id]; m.archived = !m.archived; touch(m); toast(m.archived ? 'Manhwa archivado' : 'Manhwa restaurado'); render(); };
ACT.delManhwa = async el => {
  const m = S.manhwas[el.dataset.id];
  if (!await confirmBox(`¿Seguro que quieres borrar este manhwa? <b>"${esc(m.name)}"</b> y todo su cerebro, capítulos e imágenes se borrarán para siempre.`, { title: 'Borrar manhwa' })) return;
  const ids = Object.keys(m.images || {});
  delete S.manhwas[m.id]; await IDB.del('manhwas', m.id);
  for (const i of ids) IDB.del('images', i).catch(() => { });
  if (S.user) {
    try {
      await sb.from('manhwas').delete().eq('id', m.id);
      const paths = Object.values(m.images || {}).map(x => x.path).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) await sb.storage.from('studio').remove(paths.slice(i, i + 100));
    } catch (e) { }
  }
  toast('Manhwa borrado'); render();
};
ACT.dupManhwa = async el => {
  const src = S.manhwas[el.dataset.id];
  await busy(el, async () => {
    const m = clone(src); m.id = uid('m_'); m.name = src.name + ' (copia)'; m.createdAt = m.updatedAt = Date.now(); delete m.sample;
    // copiar imágenes con IDs nuevos para que nunca se mezclen
    const map = {}; m.images = {};
    for (const [oldId, meta] of Object.entries(src.images || {})) {
      const b = await getImageBlob(src, oldId); if (!b) continue;
      const nid = uid('img_'); await IDB.put('images', nid, b);
      m.images[nid] = { ...meta, id: nid, path: null }; map[oldId] = nid;
    }
    const s = JSON.stringify(m).replace(/img_[a-z0-9]+/g, x => map[x] || x);
    const mm = JSON.parse(s); mm.images = Object.fromEntries(Object.entries(m.images));
    S.manhwas[mm.id] = mm; touch(mm); toast('Manhwa duplicado', 'ok'); render();
  }, 'Duplicando…');
};

/* ---------------- Biblia ---------------- */
VIEWS.biblia = () => {
  const m = cur(); const b = m.bible; const st = b.style;
  const caps = chapterList(m);
  return `<div class="head"><div><h1>🧠 ${esc(m.name)}</h1><p class="muted">La Biblia es la memoria total de este manhwa. Todo lo que escribas aquí lo usa la IA.</p></div>
    <div class="row"><button class="pri" data-a="importBible">📄 SUBIR MI BIBLIA (Word / PDF)</button><button class="pri" data-a="dlBible">📥 DESCARGAR MI BIBLIA (Word)</button><button class="pri" data-a="dlAll">📦 DESCARGAR TODO</button><button data-a="dlBibleOnly">⬇ Solo historia</button><button data-a="go" data-to="${mlink(m, 'caps')}">📖 Capítulos (${caps.length})</button><button data-a="go" data-to="${mlink(m, 'lector', 'novela')}">🎧 Leer como novela</button></div></div>
    <div class="alert info small" style="margin-bottom:14px"><div>📄 ¿Ya tienes tu biblia escrita? Súbela en Word (.docx), PDF o texto y reparto todo solo: historia, personajes, lugares, poderes, objetos, facciones, línea de tiempo y fichas canon. Tú revisas y apruebas antes de guardar.<br>📥 <b>Descargar mi biblia</b> crea un Word siempre actualizado con todo lo que tienes en la app (con fotos y LoRAs). <b>Descargar todo</b> agrega imágenes, videos, audios y archivos LoRA en un .zip. Cada personaje, lugar, sección, capítulo, imagen y video también tiene su propio botón ⬇.</div></div>
    ${typeof gxHTML === 'function' ? gxHTML(m) : ''}
    <div class="grid2">
      <div class="panelbox"><h2>Historia</h2>
        <label class="f">Nombre del manhwa<input ${bindAttr(m, 'name')} value="${esc(m.name)}"></label>
        <div class="grid2"><label class="f">Género<input ${bindAttr(b, 'genre')} value="${esc(b.genre)}"></label><label class="f">Tono<input ${bindAttr(b, 'tone')} value="${esc(b.tone)}"></label></div>
        <label class="f">Sinopsis<textarea ${bindAttr(b, 'synopsis')}>${esc(b.synopsis)}</textarea></label>
        <label class="f">Trama completa<textarea style="min-height:160px" ${bindAttr(b, 'plot')}>${esc(b.plot)}</textarea></label>
        <label class="f">Reglas del mundo<textarea style="min-height:120px" ${bindAttr(b, 'rules')}>${esc(b.rules)}</textarea></label>
        <label class="f">🗂️ Otros apuntes (todo lo demás de tu biblia: temas, arcos, glosario, notas)<textarea style="min-height:120px" ${bindAttr(b, 'extras')}>${esc(b.extras || '')}</textarea></label>
        ${(b.sources || []).length ? `<div class="small" style="margin-top:6px"><b>📄 Mis documentos originales</b>${b.sources.map(d => `<div class="row nw between" style="border-top:1px solid var(--line);padding:4px 0"><span>${esc(d.name)} <span class="muted">· ${fmtDate(d.at)} · ${Math.round(d.text.length / 1000)}k caracteres</span></span><span class="row nw"><button class="sm" data-a="srcView" data-id="${d.id}">👁 Ver</button><button class="sm" data-a="srcDl" data-id="${d.id}">⬇</button><button class="sm icon danger" data-a="srcDel" data-id="${d.id}">🗑️</button></span></div>`).join('')}</div>` : ''}
        <label class="f">Protagonista (para portadas)<select ${bindAttr(b, 'protagonistId')}><option value="">—</option>${m.characters.map(c => `<option value="${c.id}" ${b.protagonistId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      </div>
      <div class="col">
        <div class="panelbox"><h2>Estilo global de imágenes</h2>
          <div class="grid2">
            <label class="f">Modelo base<input ${bindAttr(st, 'model')} value="${esc(st.model)}"></label>
            <label class="f">Pasos<input type="number" ${bindAttr(st, 'steps', { num: 1 })} value="${st.steps}"></label>
            <label class="f">CFG<input type="number" step="0.5" ${bindAttr(st, 'cfg', { num: 1 })} value="${st.cfg}"></label>
            <div class="grid2"><label class="f">Ancho<input type="number" ${bindAttr(st, 'width', { num: 1 })} value="${st.width}"></label><label class="f">Alto<input type="number" ${bindAttr(st, 'height', { num: 1 })} value="${st.height}"></label></div>
          </div>
          <label class="f">Prompt de estilo (va al inicio de cada panel)<textarea ${bindAttr(st, 'prefix')}>${esc(st.prefix)}</textarea></label>
          <label class="f">Prompt negativo<textarea ${bindAttr(st, 'negative')}>${esc(st.negative)}</textarea></label>
          <p class="tiny dim">El modelo real que usa Fal.ai se elige en Configuración (FLUX con LoRA por defecto, o tu checkpoint Pony/SDXL).</p>
        </div>
        <div class="panelbox"><h2>Memoria del manhwa</h2>
          <div class="grid3">
            ${Object.entries(TYPES).map(([k, t]) => `<div class="res" data-a="go" data-to="${mlink(m, 'wiki', k)}"><div style="font-size:22px">${t.icon}</div><b>${(m[t.key] || []).length}</b> <span class="small muted">${t.label}</span></div>`).join('')}
          </div>
          <div class="row"><span class="chip neon">📌 ${m.canon.length} fichas canon</span><span class="chip">💡 ${m.plotIdeas.length} giros guardados</span><span class="chip">🔤 ${m.nameBank.length} nombres guardados</span></div>
        </div>
        ${m.plotIdeas.length ? `<div class="panelbox"><h3>Giros de trama guardados</h3>${m.plotIdeas.map(p => `<div class="row nw between"><div class="small"><b>${esc(p.name)}</b> — ${esc(p.description)}</div><button class="sm icon danger" data-a="delPlotIdea" data-id="${p.id}">🗑️</button></div>`).join('<hr>')}</div>` : ''}
        ${m.nameBank.length ? `<div class="panelbox"><h3>Banco de nombres</h3><div class="row">${m.nameBank.map(n => `<span class="chip">${esc(n.name)} <a href="#" data-a="delName" data-id="${n.id}">✕</a></span>`).join('')}</div></div>` : ''}
      </div>
    </div>`;
};
ACT.delPlotIdea = async el => { const m = cur(); if (!await confirmBox('¿Borrar este giro de trama?')) return; m.plotIdeas = m.plotIdeas.filter(x => x.id !== el.dataset.id); touch(m); render(); };
ACT.delName = el => { const m = cur(); m.nameBank = m.nameBank.filter(x => x.id !== el.dataset.id); touch(m); render(); };

/* ---------------- Wiki: lista ---------------- */
function entSub(t, e) {
  if (t === 'personajes') return [e.age && e.age + ' años', e.role, e.status && e.status !== 'vivo' ? '⚠ ' + e.status : ''].filter(Boolean).join(' · ');
  if (t === 'historia') return e.when || '';
  return [e.kind, (e.description || '').slice(0, 90)].filter(Boolean).join(' · ');
}
function entThumb(m, t, e) {
  const img = e.imageId || e.sheet?.front;
  return `<div class="thumb" ${img ? `data-img="${img}"` : ''}>${img ? '' : TYPES[t].icon}</div>`;
}
VIEWS.wiki = () => {
  const m = cur(); const t = Route.a || 'personajes'; const T = TYPES[t];
  if (Route.b === 'nuevo') return entityForm(m, t, null);
  if (Route.b) { const e = (m[T.key] || []).find(x => x.id === Route.b); if (!e) return `<div class="empty">No existe.</div>`; return Route.c === 'editar' ? entityForm(m, t, e) : entityView(m, t, e); }
  let arr = [...(m[T.key] || [])];
  if (t === 'historia') arr.sort((a, b) => (a.order || 0) - (b.order || 0)); else arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const wikiAudio = { personajes: 'personajes', lugares: 'lugares', poderes: 'poderes' }[t];
  return `<div class="head"><div><h1>${T.icon} ${T.label}</h1><p class="muted">Constructor de universo de <b>${esc(m.name)}</b>.</p></div>
    <div class="row">${wikiAudio ? `<button data-a="go" data-to="${mlink(m, 'lector', 'universo', wikiAudio)}">🎧 Escuchar solo ${T.label.toLowerCase()}</button>` : `<button data-a="go" data-to="${mlink(m, 'lector', 'universo')}">🎧 Escuchar mi universo</button>`}
    <button data-a="dlSection" data-t="${t}">⬇ Descargar ${T.label.toLowerCase()} (Word)</button><button data-a="go" data-to="${mlink(m, 'ideas', t)}">💡 Dame ideas</button><button class="pri" data-a="go" data-to="${mlink(m, 'wiki', t, 'nuevo')}">＋ Nuevo ${T.one}</button></div></div>
    <input id="wfilter" placeholder="Filtrar ${T.label.toLowerCase()}…" style="margin-bottom:14px">
    ${arr.length ? `<div class="cards" id="wlist">${arr.map(e => `<div class="card hov ecard" data-name="${esc(norm(e.name))}" data-a="go" data-to="${mlink(m, 'wiki', t, e.id)}">${entThumb(m, t, e)}<div class="grow"><h3>${esc(e.name || '(sin nombre)')}</h3><div class="small muted">${esc(entSub(t, e))}</div>${t === 'personajes' && (e.loraId || e.trigger) ? `<div class="row" style="margin-top:6px">${e.trigger ? `<span class="chip neon">${esc(e.trigger)}</span>` : ''}${e.loraId ? '<span class="chip ok">LoRA</span>' : ''}</div>` : ''}</div></div>`).join('')}</div>`
      : `<div class="empty">Aún no hay ${T.label.toLowerCase()}. Crea uno o pide ideas.</div>`}`;
};
AFTER.wiki = () => { const f = $('#wfilter'); if (f) f.oninput = () => { const q = norm(f.value); $$('#wlist .card').forEach(c => c.classList.toggle('hidden', q && !c.dataset.name.includes(q))); }; };

function chaptersMentioning(m, name) {
  const n = norm(name); if (!n) return [];
  return chapterList(m).filter(c => norm(chapterText(c)).split(' ').join(' ').includes(n)).map(c => c.number);
}
function chapterText(c) {
  return [c.title, c.premise, c.summary, c.novel, ...(c.panels || []).flatMap(p => [p.description, ...(p.characters || []), ...(p.dialogues || []).flatMap(d => [d.who, d.text])])].filter(Boolean).join(' \n ');
}
function entityView(m, t, e) {
  const T = TYPES[t];
  const rel = (e.relations || []).map(r => { const x = findEntity(m, r.target); const tt = findEntityType(m, r.target); return x ? `<span class="chip">${esc(r.kind)} → <a href="${mlink(m, 'wiki', tt, x.id)}">${esc(x.name)}</a>${r.note ? ' · ' + esc(r.note) : ''}</span>` : ''; }).join(' ');
  const back = []; for (const k of Object.keys(TYPES)) for (const x of m[TYPES[k].key] || []) for (const r of x.relations || []) if (r.target === e.id) back.push(`<span class="chip"><a href="${mlink(m, 'wiki', k, x.id)}">${esc(x.name)}</a> la/lo considera: ${esc(r.kind)}</span>`);
  const caps = chaptersMentioning(m, e.name);
  const canon = m.canon.filter(f => norm(f.entity) === norm(e.name));
  return `<div class="head"><div class="row nw">${entThumb(m, t, e).replace('class="thumb"', 'class="thumb" style="width:84px;height:84px"')}<div><h1>${esc(e.name)}</h1><p class="muted">${T.icon} ${T.one}${e.nickname ? ' · "' + esc(e.nickname) + '"' : ''}</p></div></div>
    <div class="row"><button data-a="go" data-to="${mlink(m, 'wiki', t)}">← ${T.label}</button>${t === 'personajes' ? `<button data-a="go" data-to="${mlink(m, 'lora', e.id)}">🧪 Laboratorio LoRA</button>` : ''}<button data-a="dlEntity" data-t="${t}" data-id="${e.id}">⬇ Word</button>${t === 'personajes' ? `<button data-a="dlCharImgs" data-id="${e.id}">⬇ Imágenes</button>${e.loraId ? `<button data-a="dlLora" data-id="${e.id}">⬇ LoRA</button>` : ''}` : ''}<button class="pri" data-a="go" data-to="${mlink(m, 'wiki', t, e.id, 'editar')}">✏️ Editar</button><button class="danger" data-a="delEntity" data-t="${t}" data-id="${e.id}">🗑️ Borrar</button></div></div>
    <div class="grid2">
      <div class="panelbox"><dl class="kv">${T.fields.filter(([k]) => k !== 'name' && e[k] !== undefined && e[k] !== '').map(([k, l]) => `<dt>${esc(l)}</dt><dd>${esc(e[k])}</dd>`).join('')}</dl></div>
      <div class="col">
        <div class="panelbox"><h3>Conexiones</h3><div class="row">${rel || '<span class="muted small">Sin conexiones.</span>'}</div>${back.length ? `<div class="row">${back.join(' ')}</div>` : ''}<div><button class="sm" data-a="connect" data-id="${e.id}">🔗 Editar conexiones</button></div></div>
        <div class="panelbox"><h3>Aparece en</h3><div class="row">${caps.length ? caps.map(n => { const c = chapterByNum(m, n); return `<a class="chip neon" href="${mlink(m, 'cap', c.id)}">Cap ${n}</a>`; }).join(' ') : '<span class="muted small">Aún no aparece en ningún capítulo.</span>'}</div></div>
        <div class="panelbox"><h3>📌 Fichas canon</h3>${canon.length ? canon.map(f => `<div class="small">${esc(f.attribute)} · <b>${esc(f.value)}</b>${f.since ? ` · desde Cap ${f.since}` : ''}</div>`).join('') : '<span class="muted small">Sin hechos fijos.</span>'}<div><button class="sm" data-a="go" data-to="${mlink(m, 'canon')}">Ir a Fichas Canon</button></div></div>
        ${t === 'personajes' && e.sheet ? `<div class="panelbox"><h3>Hoja de modelo</h3><div class="sheet">${SHEET_SLOTS.map(([k, l]) => `<div class="slot" ${e.sheet[k] ? `data-img="${e.sheet[k]}"` : ''}><span>${l}</span></div>`).join('')}</div></div>` : ''}
        ${t === 'personajes' && (e.history || []).length ? `<div class="panelbox"><h3>Cambios del personaje</h3>${e.history.map(h => `<div class="small"><span class="dim">${fmtDate(h.at)}</span> — ${esc(h.change)}</div>`).join('')}</div>` : ''}
      </div></div>`;
}
function entityForm(m, t, e) {
  const T = TYPES[t]; const isNew = !e;
  const draft = e ? clone(e) : (window._ideaDraft && window._ideaDraft.t === t ? window._ideaDraft.e : { relations: [] });
  window._ideaDraft = null; window._formDraft = draft;
  const imgField = (t === 'personajes' || t === 'lugares');
  return `<div class="head"><div><h1>${isNew ? 'Nuevo ' + T.one : 'Editar ' + esc(e.name)}</h1></div><div class="row"><button data-a="go" data-to="${isNew ? mlink(m, 'wiki', t) : mlink(m, 'wiki', t, e.id)}">Cancelar</button><button class="pri" data-a="saveEntity" data-t="${t}" data-id="${e ? e.id : ''}">💾 Guardar</button></div></div>
    <div class="panelbox"><div class="grid2">
    ${T.fields.map(([k, l, ty, opts]) => {
      const v = draft[k] ?? '';
      if (ty === 'area') return `<label class="f" style="grid-column:1/-1">${esc(l)}<textarea ${bindAttr(draft, k)}>${esc(v)}</textarea></label>`;
      if (ty === 'select') return `<label class="f">${esc(l)}<select ${bindAttr(draft, k)}><option value=""></option>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
      if (ty === 'num') return `<label class="f">${esc(l)}<input type="number" step="any" ${bindAttr(draft, k, { num: 1 })} value="${esc(v)}"></label>`;
      return `<label class="f">${esc(l)}<input ${k === 'name' ? 'autofocus' : ''} ${bindAttr(draft, k)} value="${esc(v)}"></label>`;
    }).join('')}
    </div>
    ${imgField ? `<div class="row"><div class="thumb" style="width:90px;height:90px" id="fimg" ${draft.imageId ? `data-img="${draft.imageId}"` : ''}>${draft.imageId ? '' : '📷'}</div><button data-a="formImage">📷 ${draft.imageId ? 'Cambiar' : 'Subir'} foto</button>${draft.imageId ? '<button class="danger sm" data-a="formImageDel">Quitar</button>' : ''}</div>` : ''}
    </div>`;
}
ACT.formImage = async () => { const m = cur(); const [f] = await pickFiles({ multiple: false }); if (!f) return; window._formDraft.imageId = await addImage(m, f, { source: 'subida' }); const el = $('#fimg'); el.dataset.img = window._formDraft.imageId; el.textContent = ''; hydrateImages(el.parentElement); };
ACT.formImageDel = () => { window._formDraft.imageId = null; const el = $('#fimg'); el.style.backgroundImage = ''; el.textContent = '📷'; };

/* Detector de repetidos */
function findDuplicates(m, name, selfId) {
  const n = norm(name); if (!n) return [];
  const out = [];
  for (const [k, T] of Object.entries(TYPES)) for (const x of m[T.key] || []) {
    if (x.id === selfId || !x.name) continue;
    const d = lev(x.name, name);
    if (norm(x.name) === n) out.push({ k, x, exact: true });
    else if (n.length >= 4 && d <= 1) out.push({ k, x, exact: false });
  }
  return out;
}
ACT.saveEntity = async el => {
  const m = cur(); const t = el.dataset.t; const T = TYPES[t]; const d = window._formDraft;
  if (!d.name || !d.name.trim()) return toast('El nombre es obligatorio', 'err');
  d.name = d.name.trim();
  const dupes = findDuplicates(m, d.name, el.dataset.id || null);
  if (dupes.length) {
    const x = dupes[0]; const caps = chaptersMentioning(m, x.x.name);
    const where = caps.length ? ` en el Cap ${caps[0]}` : '';
    const msg = x.exact ? `Oye, ya tienes un ${TYPES[x.k].one} que se llama <b>${esc(x.x.name)}</b>${where}. ¿Quieres usar ese o crear uno nuevo con otro nombre?`
      : `Ojo: <b>${esc(d.name)}</b> se parece mucho a <b>${esc(x.x.name)}</b> (${TYPES[x.k].one}${where}). ¿Es el mismo?`;
    const r = await choiceBox('🔁 Posible repetido', msg, [{ label: 'Usar el existente', value: 'use' }, { label: 'Cambiar el nombre', value: 'rename' }, { label: 'Crear de todos modos', value: 'force', cls: 'danger' }]);
    if (r === 'use') return go(mlink(m, 'wiki', x.k, x.x.id));
    if (r !== 'force') return;
  }
  const arr = m[T.key];
  let isNew = false;
  if (el.dataset.id) { const i = arr.findIndex(x => x.id === el.dataset.id); arr[i] = { ...arr[i], ...d }; }
  else { d.id = uid(t.slice(0, 1) + '_'); d.createdAt = Date.now(); d.relations = d.relations || []; arr.push(d); isNew = true; }
  if (m.sample) m.sampleTouched = true;
  touch(m); toast('Guardado ✔', 'ok');
  const id = el.dataset.id || d.id;
  go(mlink(m, 'wiki', t, id));
  if (isNew) setTimeout(() => ACT.connect({ dataset: { id } }, null, true), 250);
};
ACT.delEntity = async el => {
  const m = cur(); const T = TYPES[el.dataset.t]; const e = m[T.key].find(x => x.id === el.dataset.id);
  if (!await confirmBox(`¿Seguro que quieres borrar ${T.one === 'facción' ? 'la' : 'el'} ${T.one} <b>${esc(e.name)}</b>?`)) return;
  m[T.key] = m[T.key].filter(x => x.id !== e.id);
  for (const k of Object.keys(TYPES)) for (const x of m[TYPES[k].key] || []) x.relations = (x.relations || []).filter(r => r.target !== e.id);
  touch(m); toast('Borrado'); go(mlink(m, 'wiki', el.dataset.t));
};
/* Conexiones */
ACT.connect = (el, ev, asNew) => {
  const m = cur(); const e = findEntity(m, el.dataset.id); if (!e) return;
  const rel = clone(e.relations || []);
  const all = []; for (const [k, T] of Object.entries(TYPES)) for (const x of m[T.key] || []) if (x.id !== e.id) all.push({ k, x });
  if (!all.length) return;
  const bg = modal(`<h2>🔗 ¿Con quién se conecta ${esc(e.name)}?</h2><p class="muted small">${asNew ? 'Acabas de crear algo nuevo. ' : ''}Marca las conexiones (amigo, enemigo, enamorado, vive en…).</p>
    <div class="col" style="max-height:52vh;overflow:auto">${all.map(({ k, x }) => { const r = rel.find(r => r.target === x.id); return `<div class="row nw"><input type="checkbox" data-t="${x.id}" ${r ? 'checked' : ''}><span class="grow small">${TYPES[k].icon} ${esc(x.name)}</span><select data-k="${x.id}" style="width:140px;min-height:38px;padding:6px">${REL_KINDS.map(o => `<option ${r && r.kind === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`; }).join('')}</div>
    <div class="acts"><button data-x="no">${asNew ? 'Ahora no' : 'Cancelar'}</button><button class="pri" data-x="ok">Guardar conexiones</button></div>`);
  bg.querySelector('[data-x=no]').onclick = () => bg.close();
  bg.querySelector('[data-x=ok]').onclick = () => {
    e.relations = $$('input[data-t]', bg).filter(i => i.checked).map(i => ({ target: i.dataset.t, kind: bg.querySelector(`select[data-k="${i.dataset.t}"]`).value, note: (rel.find(r => r.target === i.dataset.t) || {}).note || '' }));
    touch(m); bg.close(); render(); toast('Conexiones guardadas', 'ok');
  };
};

/* ---------------- Fichas Canon ---------------- */
VIEWS.canon = () => {
  const m = cur();
  const names = [...new Set([...m.characters, ...m.places, ...m.objects, ...m.factions, ...m.powers].map(x => x.name).filter(Boolean))];
  const list = [...m.canon].sort((a, b) => (a.entity || '').localeCompare(b.entity || '') || (a.since || 0) - (b.since || 0));
  return `<div class="head"><div><h1>📌 Fichas Canon</h1><p class="muted">Hechos fijos de tu historia: <span class="kbd">Kael · cicatriz · ceja izquierda · desde Cap 3</span>. El detector de continuidad los usa para avisarte.</p></div>
    <div class="row"><button data-a="dlCanon">⬇ Descargar (Word)</button><button class="pri" data-a="addCanon">＋ Nueva ficha</button></div></div>
    <datalist id="entnames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="alert info" style="margin-bottom:14px">💡 Para muertes usa el atributo <b>estado</b> con valor <b>muerto</b>. Para emociones usa <b>emoción</b>. Así te aviso si alguien aparece vivo o cambia de humor sin motivo.</div>
    ${list.length ? `<div class="panelbox scrollx"><table class="t"><thead><tr><th>Quién / qué</th><th>Atributo</th><th>Valor</th><th>Desde Cap</th><th>Nota</th><th></th></tr></thead><tbody>
    ${list.map(f => `<tr><td><input list="entnames" ${bindAttr(f, 'entity')} value="${esc(f.entity)}"></td><td><input ${bindAttr(f, 'attribute')} value="${esc(f.attribute)}"></td><td><input ${bindAttr(f, 'value')} value="${esc(f.value)}"></td><td style="width:90px"><input type="number" ${bindAttr(f, 'since', { num: 1 })} value="${esc(f.since)}"></td><td><input ${bindAttr(f, 'note')} value="${esc(f.note || '')}"></td><td><button class="sm icon danger" data-a="delCanon" data-id="${f.id}">🗑️</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Sin fichas. Se crean al terminar capítulos o a mano.</div>'}`;
};
ACT.addCanon = () => { const m = cur(); m.canon.push({ id: uid('k_'), entity: '', attribute: '', value: '', since: (lastChapter(m)?.number) || 1, note: '' }); touch(m); render(); setTimeout(() => { const i = $$('table.t input[list]'); const el = i.find(x => !x.value); el && el.focus(); }, 50); };
ACT.delCanon = async el => { const m = cur(); if (!await confirmBox('¿Borrar esta ficha canon?')) return; m.canon = m.canon.filter(f => f.id !== el.dataset.id); touch(m); render(); };

/* ---------------- Generador de ideas ---------------- */
const IDEA_KINDS = {
  personajes: { label: 'Personaje', t: 'personajes' }, villano: { label: 'Villano', t: 'personajes' }, lugares: { label: 'Ciudad / lugar', t: 'lugares' },
  poderes: { label: 'Poder', t: 'poderes' }, objetos: { label: 'Objeto / arma', t: 'objetos' }, facciones: { label: 'Facción / gremio', t: 'facciones' },
  historia: { label: 'Evento histórico', t: 'historia' }, giro: { label: 'Giro de trama', t: null }, nombres: { label: 'Nombres', t: null }
};
let IDEAS = { kind: 'personajes', ask: '', list: [], discarded: [] };
VIEWS.ideas = () => {
  const m = cur();
  if (Route.a && IDEA_KINDS[Route.a] && IDEAS.kind !== Route.a && !IDEAS._fromRoute) { IDEAS = { kind: Route.a, ask: '', list: [], discarded: [] }; }
  IDEAS._fromRoute = false;
  return `<div class="head"><div><h1>💡 Dame ideas</h1><p class="muted">La IA conoce todo tu manhwa. Nunca guarda nada sin que tú des <b>CONSERVAR</b>. Tú decides.</p></div></div>
    <div class="panelbox"><div class="row">${Object.entries(IDEA_KINDS).map(([k, v]) => `<button class="tab ${IDEAS.kind === k ? 'on' : ''}" data-a="ideaKind" data-k="${k}">${v.label}</button>`).join('')}</div>
    <label class="f">¿Qué necesitas? (opcional)<input id="ideaAsk" value="${esc(IDEAS.ask)}" placeholder="Ej. Necesito una ciudad fría del norte donde viva un culto"></label>
    <div><button class="pri big" data-a="giveIdeas">✨ DAME IDEAS</button></div></div>
    <div class="cards" style="margin-top:18px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${IDEAS.list.map((it, i) => ideaCard(it, i)).join('')}</div>`;
};
function ideaCard(it, i) {
  if (it.loading) return `<div class="card"><span class="spin"></span> Pensando otra idea…</div>`;
  const k = IDEAS.kind; const t = IDEA_KINDS[k].t;
  let body = '';
  if (k === 'nombres') body = `<h3>${esc(it.name)}</h3><div class="small muted">${esc(it.meaning || '')}</div>`;
  else if (!t) body = `<h3>${esc(it.name)}</h3><p class="small">${esc(it.description)}</p>`;
  else body = `<h3>${esc(it.name)}</h3>${TYPES[t].fields.filter(([f]) => f !== 'name' && it[f]).slice(0, 7).map(([f, l]) => `<div class="small"><span class="muted">${esc(l)}:</span> ${esc(it[f])}</div>`).join('')}`;
  return `<div class="card idea">${body}${it.fit ? `<div class="alert info small">🧩 ${esc(it.fit)}</div>` : ''}<div class="acts"><button class="ok grow" data-a="keepIdea" data-i="${i}">✔ CONSERVAR</button><button class="danger grow" data-a="dropIdea" data-i="${i}">✕ DESCARTAR</button></div></div>`;
}
ACT.ideaKind = el => { IDEAS = { kind: el.dataset.k, ask: '', list: [], discarded: [] }; IDEAS._fromRoute = true; go(mlink(cur(), 'ideas', el.dataset.k)); };
function ideaPrompt(m, n) {
  const k = IDEAS.kind; const t = IDEA_KINDS[k].t;
  const fields = t ? TYPES[t].fields.filter(([f]) => !['loraId', 'loraWeight', 'notes', 'order'].includes(f)).map(([f, l]) => `"${f}": ${l}`).join(', ') : '';
  const shape = k === 'nombres' ? '[{"name":"...","meaning":"origen o significado y para quién sirve"}] (da 8 nombres)' :
    t ? `[{${fields}, "fit": "cómo encaja con MI historia (1-2 frases)"}]` : `[{"name":"título corto del giro","description":"el giro explicado en 3-5 frases","fit":"en qué capítulo o momento usarlo"}]`;
  const existing = t ? (m[TYPES[t].key] || []).map(x => x.name).join(', ') : '';
  return `Eres un guionista experto en manhwa coreano. Este es el cerebro del manhwa:\n${brain(m, { maxChars: 30000 })}\n\nDame ${k === 'nombres' ? '' : n + ' '}opciones COMPLETAS y originales de: ${IDEA_KINDS[k].label}${k === 'villano' ? ' (un villano memorable con motivación comprensible)' : ''}.
${IDEAS.ask ? 'Lo que pide el autor: ' + IDEAS.ask : ''}
No repitas nombres que ya existen (${existing || 'ninguno'})${IDEAS.discarded.length ? ' ni estas ideas descartadas: ' + IDEAS.discarded.join(', ') : ''}. Respeta las fichas canon y reglas del mundo. Todo en español.
Formato: ${shape}`;
}
ACT.giveIdeas = async el => {
  const m = cur(); IDEAS.ask = $('#ideaAsk').value.trim();
  await busy(el, async () => {
    const r = await aiJSON(ideaPrompt(m, 3), { max_tokens: 3500, estOut: 1500, title: 'Dame ideas' });
    IDEAS.list = Array.isArray(r) ? r : (r.ideas || r.opciones || []);
    IDEAS._fromRoute = true; render();
  }, 'Pensando…');
};
ACT.dropIdea = async el => {
  const m = cur(); const i = +el.dataset.i; IDEAS.discarded.push(IDEAS.list[i].name);
  if (IDEAS.kind === 'nombres') { IDEAS.list.splice(i, 1); IDEAS._fromRoute = true; render(); return; }
  IDEAS.list[i] = { loading: true }; IDEAS._fromRoute = true; render();
  try { const r = await aiJSON(ideaPrompt(m, 1), { max_tokens: 1500, estOut: 600, title: 'Otra idea' }); const arr = Array.isArray(r) ? r : [r]; IDEAS.list[i] = arr[0]; }
  catch (e) { if (e.message !== 'Cancelado') toast(e.message, 'err'); IDEAS.list.splice(i, 1); }
  IDEAS._fromRoute = true; if (Route.view === 'ideas') render();
};
ACT.keepIdea = el => {
  const m = cur(); const i = +el.dataset.i; const it = IDEAS.list[i]; const k = IDEAS.kind; const t = IDEA_KINDS[k].t;
  if (k === 'nombres') { m.nameBank.push({ id: uid('n_'), name: it.name, meaning: it.meaning }); touch(m); IDEAS.list.splice(i, 1); IDEAS._fromRoute = true; render(); return toast(`"${it.name}" guardado en tu banco de nombres`, 'ok'); }
  if (!t) { m.plotIdeas.push({ id: uid('g_'), name: it.name, description: it.description + (it.fit ? '\n(' + it.fit + ')' : '') }); touch(m); IDEAS.list.splice(i, 1); IDEAS._fromRoute = true; render(); return toast('Giro guardado en la Biblia', 'ok'); }
  const e = { relations: [] }; TYPES[t].fields.forEach(([f]) => { if (it[f] != null) e[f] = String(it[f]); });
  if (k === 'villano') e.role = e.role || 'Villano';
  if (it.fit) e.notes = (e.notes ? e.notes + '\n' : '') + 'Cómo encaja: ' + it.fit;
  if (t === 'historia' && e.order) e.order = Number(e.order) || 0;
  window._ideaDraft = { t, e }; IDEAS.list.splice(i, 1);
  toast('Revisa y da Guardar para conservarlo'); go(mlink(m, 'wiki', t, 'nuevo'));
};

/* ---------------- Búsqueda global ---------------- */
VIEWS.buscar = () => {
  const q = Route.a || ''; const nq = norm(q);
  $('#gsearch').value = q;
  if (!nq) return `<div class="empty">Escribe algo en el buscador.</div>`;
  const snip = (txt) => { const s = String(txt || ''); const i = norm(s).indexOf(nq); if (i < 0) return esc(s.slice(0, 120)); const a = Math.max(0, i - 50); return (a ? '…' : '') + esc(s.slice(a, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length, i + q.length + 70)) + '…'; };
  const groups = [];
  for (const m of Object.values(S.manhwas)) {
    const hits = [];
    if (norm(m.name).includes(nq)) hits.push({ to: mlink(m, 'biblia'), label: '🧠 Nombre del manhwa', s: snip(m.name) });
    for (const f of ['synopsis', 'plot', 'rules']) if (norm(m.bible[f]).includes(nq)) hits.push({ to: mlink(m, 'biblia'), label: '🧠 Biblia', s: snip(m.bible[f]) });
    for (const [k, T] of Object.entries(TYPES)) for (const e of m[T.key] || []) {
      const fld = T.fields.find(([f]) => norm(e[f]).includes(nq));
      if (fld) hits.push({ to: mlink(m, 'wiki', k, e.id), label: `${T.icon} ${T.one[0].toUpperCase() + T.one.slice(1)}: <b>${esc(e.name)}</b>`, s: fld[0] === 'name' ? '' : `${esc(fld[1])}: ${snip(e[fld[0]])}` });
    }
    for (const c of chapterList(m)) {
      const where = [];
      if (norm(c.title + ' ' + c.premise + ' ' + c.summary).includes(nq)) where.push(snip([c.title, c.premise, c.summary].join(' · ')));
      (c.panels || []).forEach((p, i) => { const t = [p.description, ...(p.characters || []), ...(p.dialogues || []).map(d => d.who + ': ' + d.text)].join(' · '); if (norm(t).includes(nq)) where.push(`Panel ${i + 1}: ${snip(t)}`); });
      if (where.length) hits.push({ to: mlink(m, 'cap', c.id), label: `📖 Cap ${c.number}: <b>${esc(c.title || '')}</b>`, s: where.slice(0, 3).join('<br>') + (where.length > 3 ? `<br><span class="dim">+${where.length - 3} más</span>` : '') });
    }
    for (const f of m.canon) if (norm([f.entity, f.attribute, f.value].join(' ')).includes(nq)) hits.push({ to: mlink(m, 'canon'), label: '📌 Ficha canon', s: snip(`${f.entity} · ${f.attribute} · ${f.value}${f.since ? ' · desde Cap ' + f.since : ''}`) });
    if (hits.length) groups.push({ m, hits });
  }
  const total = groups.reduce((a, g) => a + g.hits.length, 0);
  return `<div class="head"><div><h1>🔎 "${esc(q)}"</h1><p class="muted">${total ? `${plural(total, 'resultado', 'resultados')} en ${plural(groups.length, 'manhwa', 'manhwas')}` : 'Sin resultados.'}</p></div></div>
    ${groups.map(g => `<div class="sect"><h2>${esc(g.m.name)}${g.m.archived ? ' <span class="chip warn">archivado</span>' : ''}</h2><div class="col">${g.hits.map(h => `<div class="res" data-a="go" data-to="${h.to}"><div>${h.label}</div>${h.s ? `<div class="small muted" style="margin-top:4px">${h.s}</div>` : ''}</div>`).join('')}</div></div>`).join('')}`;
};

/* ---------------- Galería ---------------- */
VIEWS.galeria = () => {
  const m = cur(); const imgs = Object.values(m.images || {}).sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="head"><div><h1>🗃️ Galería</h1><p class="muted">${plural(imgs.length, 'imagen', 'imágenes')} de este manhwa (subidas y generadas). ♥ guarda la semilla y configuración.</p></div><div class="row"><button data-a="dlAll">📦 Descargar todo</button><button class="pri" data-a="galUpload">📤 Subir imágenes</button></div></div>
    ${imgs.length ? `<div class="igrid">${imgs.map(i => `<div class="ithumb"><img data-img="${i.id}" alt=""><button class="heart sm" data-a="likeImg" data-id="${i.id}">${i.liked ? '♥' : '♡'}</button><div class="cap"><span>${esc(i.source || '')}${i.seed != null ? ' · seed ' + i.seed : ''}</span><button class="sm icon" data-a="dlImg" data-id="${i.id}" title="Descargar">⬇</button><button class="sm icon danger" data-a="delImg" data-id="${i.id}">🗑️</button></div></div>`).join('')}</div>` : '<div class="empty">Sin imágenes todavía.</div>'}`;
};
ACT.galUpload = async () => { const m = cur(); const fs = await pickFiles(); for (const f of fs) await addImage(m, f, { source: 'subida' }); render(); toast(`${fs.length} imagen(es) agregadas`, 'ok'); };
ACT.delImg = async el => { const m = cur(); if (!await confirmBox('¿Seguro que quieres borrar esta imagen? Se quitará de paneles y armador.')) return; await deleteImage(m, el.dataset.id); render(); };
ACT.likeImg = el => { const m = cur(); const i = m.images[el.dataset.id]; i.liked = !i.liked; touch(m); el.textContent = i.liked ? '♥' : '♡'; if (i.liked) toast(i.seed != null ? `Guardada con semilla ${i.seed} y su configuración` : 'Marcada como favorita'); };
