/* =====================================================================
   HABLANDO: le dices qué cambiar (voz o texto) y se aplica en vivo.
   1) Intérprete local en español (gratis, instantáneo).
   2) Lo que no entienda → Claude Code (si está conectado) o Claude.
   Siempre con DESHACER.
   ===================================================================== */
function cmdBarHTML(kind) {
  const ph = kind === 'manhwa' ? 'Dime qué cambiar: “pon este panel más grande, sube el diálogo de Kael, pon el BOOM más arriba”' : 'Dime qué hacer: “quita silencios, pon música épica del 0:30 al 0:50”';
  return `<div class="cmdbar"><button class="icon mic" id="cmdMic" data-a="cmdMic" title="Hablar">🎙️</button><input id="cmdIn" placeholder="${esc(ph)}" autocomplete="off"><button class="pri" data-a="cmdRun">Hacer</button><button data-a="cmdUndo">↶ DESHACER</button>${ccPillHTML()}</div><div id="cmdLog" class="tiny" style="min-height:16px;margin:4px 2px 0;color:var(--muted)"></div>`;
}
function ccPillHTML() { return `<button class="sm cc-pill ${CC.ok ? 'on' : ''}" data-a="ccOpen" id="ccPill">🔌 CONECTADO A CLAUDE CODE: ${CC.ok ? 'SÍ' : 'NO'}</button>`; }
let CMD_KIND = 'manhwa';
function bindCmdBar(kind) {
  CMD_KIND = kind; const i = $('#cmdIn'); if (!i) return;
  i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ACT.cmdRun(); } };
}
function cmdLog(msg, cls = '') { const l = $('#cmdLog'); if (l) { l.innerHTML = msg; l.style.color = cls === 'err' ? 'var(--bad)' : cls === 'ok' ? 'var(--ok)' : 'var(--muted)'; } }
ACT.cmdUndo = () => CMD_KIND === 'manhwa' ? ACT.bUndo() : ACT.vUndo();
ACT.cmdRun = async () => {
  const i = $('#cmdIn'); const text = (i?.value || '').trim(); if (!text) return;
  i.value = '';
  try { await (CMD_KIND === 'manhwa' ? runManhwaCmd(text) : runVideoCmd(text)); }
  catch (e) { if (e.message !== 'Cancelado') cmdLog('⚠️ ' + esc(e.message), 'err'); }
};
/* ---------- micrófono (reconocimiento de voz del navegador) ---------- */
let REC = null;
ACT.cmdMic = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Tu navegador no tiene dictado por voz. Usa Chrome, Edge o Safari, o escribe la instrucción.', 'err');
  if (REC) { REC.stop(); return; }
  const r = new SR(); r.lang = 'es-MX'; r.interimResults = true; r.continuous = false; REC = r;
  const btn = $('#cmdMic'); btn?.classList.add('rec'); cmdLog('🎙️ Te escucho…');
  r.onresult = e => { let fin = '', tmp = ''; for (const res of e.results) (res.isFinal ? (fin += res[0].transcript) : (tmp += res[0].transcript)); const i = $('#cmdIn'); if (i) i.value = fin || tmp; if (fin) { REC = null; btn?.classList.remove('rec'); ACT.cmdRun(); } };
  r.onerror = e => { cmdLog(e.error === 'not-allowed' ? 'Permite el micrófono para hablar.' : 'No te escuché bien, intenta de nuevo.', 'err'); };
  r.onend = () => { REC = null; btn?.classList.remove('rec'); };
  r.start();
};

/* ---------- utilidades de lenguaje ---------- */
const NUMW = { un: 1, uno: 1, una: 1, primer: 1, primero: 1, primera: 1, dos: 2, segundo: 2, segunda: 2, tres: 3, tercer: 3, tercero: 3, tercera: 3, cuatro: 4, cuarto: 4, cuarta: 4, cinco: 5, quinto: 5, quinta: 5, seis: 6, sexto: 6, siete: 7, septimo: 7, ocho: 8, octavo: 8, nueve: 9, noveno: 9, diez: 10, decimo: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30 };
const COLORS = { rojo: '#e5232e', roja: '#e5232e', amarillo: '#ffe14d', amarilla: '#ffe14d', blanco: '#ffffff', blanca: '#ffffff', negro: '#111111', negra: '#111111', azul: '#2f7bff', verde: '#2ecc71', morado: '#b44dff', morada: '#b44dff', naranja: '#ff8a1f', rosa: '#ff5fa2', gris: '#8a8a8a', dorado: '#f5c542', dorada: '#f5c542', celeste: '#5fd3ff' };
function numIn(s) { const m = s.match(/\b(\d+)\b/); if (m) return +m[1]; for (const w of s.split(/\s+/)) if (NUMW[w] != null) return NUMW[w]; return null; }
function splitClauses(text) { return text.split(/[;.\n]|,\s*(?:y\s+)?|\s+y\s+(?=(?:luego|despu[eé]s|tambi[eé]n|pon|ponle|sube|baja|mueve|haz|hazlo|agrega|añade|quita|borra|elimina|cambia|agranda|achica|gira|rota|duplica|traduce|aumenta|reduce|centra|acerca|aleja|corta|recorta|activa|desactiva|silencia|ve|ir|que)\b)/i).map(s => s.trim()).filter(Boolean); }
function amount(s) { return /un poco|poquito|ligeramente|tantito/.test(s) ? 0.5 : /mucho|bastante|much[ií]simo|todo/.test(s) ? 2 : 1; }

/* ---------- intérprete del Editor de Manhwa ---------- */
function speakerOf(c, L) { if (L.who) return L.who; if (L.src && !String(L.src).includes('s')) { const [i, j] = L.src.split('.'); return c.panels?.[+i]?.dialogues?.[+j]?.who || ''; } return ''; }
function findLayers(c, it, s) {
  const pool = it ? it.layers : c.layout.items.flatMap(x => x.layers);
  const names = new Set(); for (const L of c.layout.items.flatMap(x => x.layers)) { const w = speakerOf(c, L); if (w) names.add(norm(w)); }
  const who = [...names].find(n => n && new RegExp(`\\b${n}\\b`).test(s));
  const quoted = (s.match(/["“'‘]([^"”'’]+)["”'’]/) || [])[1];
  let res = [];
  if (who) res = pool.filter(L => norm(speakerOf(c, L)) === who);
  if (!res.length && quoted) res = pool.filter(L => norm(layerText(L, 'es')).includes(norm(quoted)));
  if (!res.length) { const sfxWord = pool.filter(L => L.kind === 'sfx' || L.kind === 'texto').find(L => { const t = norm(layerText(L, 'es')); return t && s.includes(t.split(' ')[0]); }); if (sfxWord) res = [sfxWord]; }
  if (!res.length) {
    const kinds = [[/\b(sfx|efecto de sonido|onomatopeya|boom|slash|crack|whoosh)\b/, 'sfx'], [/\bgrito\b/, 'grito'], [/\bpensamiento\b/, 'pensamiento'], [/\bnarraci[oó]n\b/, 'narracion'], [/\b(logo)\b/, 'logo'], [/\b(sticker|calcoman[ií]a)\b/, 'sticker'], [/\btexto\b/, 'texto'], [/\b(globo|di[aá]logo|burbuja)\b/, 'globo']];
    for (const [re, k] of kinds) if (re.test(s)) { res = pool.filter(L => k === 'logo' ? L.logo : L.kind === k || (k === 'globo' && ['globo', 'grito', 'pensamiento'].includes(L.kind))); break; }
  }
  if (!res.length && BSEL.layer && /\b(esto|eso|este|esta|lo|la|seleccionad)/.test(s)) { const L = pool.find(l => l.id === BSEL.layer); if (L) res = [L]; }
  return /\btodos|todas\b/.test(s) ? res : res.slice(0, 1);
}
function panelRef(c, s) {
  const items = c.layout.items; if (!items.length) return null;
  if (/[uú]ltimo panel|panel final/.test(s)) return items[items.length - 1];
  if (/primer panel/.test(s)) return items[0];
  const mm = s.match(/panel(?:es)?\s+(?:n[uú]mero\s+)?(\d+|\w+)/); if (mm) { const n = /^\d+$/.test(mm[1]) ? +mm[1] : NUMW[mm[1]]; if (n && items[n - 1]) return items[n - 1]; }
  return items.find(i => i.id === BSEL.item) || items[0];
}
function runManhwaClause(m, c, raw) {
  const s = norm(raw).replace(/[¿?¡!]/g, ''); const k = amount(s);
  const it = panelRef(c, s); const explicitPanel = /panel/.test(s);
  const done = msg => ({ ok: true, msg });
  if (/^(deshaz|deshacer|regresa|anterior)/.test(s)) { ACT.bUndo(); return done('deshecho'); }
  if (/vista previa|reproduce|animalo|ver animado/.test(s)) { setTimeout(() => ACT.bAnimPreview(), 50); return done('abriendo vista previa'); }
  if (/^(traduce|traducir|traduccion)/.test(s)) { setTimeout(() => ACT.bTranslate(), 50); return done('traducir'); }
  const quoted = (raw.match(/["“'‘]([^"”'’]+)["”'’]/) || [])[1] || (raw.match(/(?:que diga|diciendo|con el texto|por|a)\s*:?\s*["“]?(.+?)["”]?$/i) || [])[1];
  // agregar capas
  if (/\b(agrega|anade|pon|ponle|mete|crea)\b.*\b(un|una|otro|otra)\b.*\b(boom|sfx|efecto|slash|crack|whoosh|pum|bam|globo|dialogo|narracion|pensamiento|grito|texto)\b/.test(s) && it) {
    const kind = /narracion/.test(s) ? 'narracion' : /pensamiento/.test(s) ? 'pensamiento' : /grito/.test(s) ? 'grito' : /globo|dialogo/.test(s) ? 'globo' : /texto/.test(s) && !/boom|sfx/.test(s) ? 'texto' : 'sfx';
    const word = kind === 'sfx' ? ((raw.match(/\b(BOOM|SLASH|CRACK|WHOOSH|BAM|POW|PUM|ZAS|KABOOM|THUD|WHAM)\b/i) || [])[1] || 'BOOM').toUpperCase() + '!' : (quoted || 'Texto…');
    const L = mkLayer(kind, { text: kind === 'sfx' ? word : word, x: 0.25, y: /abajo/.test(s) ? 0.68 : /arriba/.test(s) ? 0.06 : 0.35 });
    it.layers.push(L); BSEL.layer = L.id; return done(`agregué ${LKINDS[kind]}`);
  }
  if (/logo/.test(s) && /todos|todas|cada/.test(s) && /\b(pon|agrega|mete)\b/.test(s)) { if (!m.logo?.id) return { ok: false, why: 'Primero elige tu logo en “Stickers y logo”.' }; setTimeout(() => { ACT.bStickers(); setTimeout(() => $('[data-x=logoAll]')?.click(), 120); }, 30); return done('logo en todos'); }
  if (/fondo\s+(del capitulo\s+)?(negro|blanco|gris|morado|azul|rojo)/.test(s) && !/imagen/.test(s)) { const col = s.match(/fondo\s+(?:del capitulo\s+)?(\w+)/)[1]; c.layout.bg = COLORS[col] || c.layout.bg; return done('fondo ' + col); }
  // capas
  const Ls = findLayers(c, explicitPanel ? it : (/\btodos\b/.test(s) ? null : it), s);
  const layerish = Ls.length && !/\bpanel\b(?!.*\b(globo|dialogo|texto|boom|sfx)\b)/.test(s.replace(/del panel \w+|en el panel \w+/g, ''));
  const st = 0.07 * k;
  if (layerish) {
    const tag = Ls.map(L => LKINDS[L.kind] + (speakerOf(c, L) ? ' de ' + speakerOf(c, L) : '')).join(', ');
    if (/\b(borra|quita|elimina)\b/.test(s)) { for (const x of c.layout.items) x.layers = x.layers.filter(L => !Ls.includes(L)); return done('borré ' + tag); }
    if (/\b(cambia|corrige|pon que diga|que diga|reemplaza)\b/.test(s) && quoted && !/color|letra|fuente/.test(s)) { Ls.forEach(L => L.text = quoted.trim()); return done(`texto cambiado a “${esc(quoted.trim())}”`); }
    const col = Object.keys(COLORS).find(w => new RegExp(`\\b${w}\\b`).test(s));
    if (col && !/fondo del capitulo/.test(s)) { Ls.forEach(L => { if (/relleno|fondo del globo|globo/.test(s) && ['globo', 'pensamiento', 'grito', 'narracion'].includes(L.kind) && !/letra/.test(s)) L.fill = COLORS[col]; else if (/borde|contorno/.test(s)) L.stroke = COLORS[col]; else L.color = COLORS[col]; }); return done(`${tag} en ${col}`); }
    const fontK = Object.keys(FONTS).find(f => f !== 'auto' && s.includes(norm(f))); if (fontK) { Ls.forEach(L => L.font = fontK); return done('fuente ' + fontK); }
    if (/letra|fuente|texto/.test(s) && /(mas )?(grande|chica|pequena|grandota)/.test(s)) { const f = /grande/.test(s) ? 1 + 0.15 * k : 1 / (1 + 0.15 * k); Ls.forEach(L => L.fs *= f); return done('tamaño de letra ajustado'); }
    let did = [];
    if (/\b(sube|subir|mas arriba|hacia arriba|arriba)\b/.test(s)) { Ls.forEach(L => L.y = /del todo|hasta arriba/.test(s) ? 0.02 : L.y - st); did.push('arriba'); }
    if (/\b(baja|bajar|mas abajo|hacia abajo|abajo)\b/.test(s)) { Ls.forEach(L => L.y = /del todo|hasta abajo/.test(s) ? 0.98 - L.h : L.y + st); did.push('abajo'); }
    if (/izquierda/.test(s) && !/gira|rota|inclina/.test(s)) { Ls.forEach(L => L.x -= st); did.push('a la izquierda'); }
    if (/derecha/.test(s) && !/gira|rota|inclina/.test(s)) { Ls.forEach(L => L.x += st); did.push('a la derecha'); }
    if (/centr/.test(s)) { Ls.forEach(L => { L.x = 0.5 - L.w / 2; if (/vertical|medio/.test(s)) L.y = 0.5 - L.h / 2; }); did.push('centrado'); }
    if (/\b(agranda|mas grande|aumenta|grande|grandote)\b/.test(s)) { const f = 1 + 0.2 * k; Ls.forEach(L => { const cx = L.x + L.w / 2, cy = L.y + L.h / 2; L.w *= f; L.h *= f; L.x = cx - L.w / 2; L.y = cy - L.h / 2; if (L.kind !== 'sticker') L.fs *= f; }); did.push('más grande'); }
    if (/\b(achica|mas pequeno|mas chico|reduce|pequeno|chico)\b/.test(s)) { const f = 1 / (1 + 0.2 * k); Ls.forEach(L => { const cx = L.x + L.w / 2, cy = L.y + L.h / 2; L.w *= f; L.h *= f; L.x = cx - L.w / 2; L.y = cy - L.h / 2; if (L.kind !== 'sticker') L.fs *= f; }); did.push('más pequeño'); }
    if (/\b(gira|rota|inclina|voltea)\b/.test(s)) { const g = numIn(s.replace(/panel \w+/, '')) || 12 * k; Ls.forEach(L => L.rot = (L.rot || 0) + (/izquierda/.test(s) ? -g : g)); did.push('girado'); }
    if (/transparente|opacidad|tenue/.test(s)) { Ls.forEach(L => L.op = Math.max(0.2, (L.op ?? 1) - 0.25)); did.push('más transparente'); }
    if (/\b(pop|letra por letra|maquina de escribir|aparezca)\b/.test(s)) { Ls.forEach(L => L.anim = /letra|maquina/.test(s) ? 'type' : /aparezca/.test(s) ? 'fade' : 'pop'); did.push('animación'); }
    if (/primer plano/.test(s)) { Ls.forEach(L => L.fg = true); did.push('primer plano'); }
    Ls.forEach(L => { L.x = Math.min(1.02 - L.w, Math.max(-0.02, L.x)); L.y = Math.min(1.02 - L.h, Math.max(0, L.y)); });
    if (did.length) return done(`${tag}: ${did.join(', ')}`);
  }
  // panel
  if (!it) return { ok: false };
  const idx = c.layout.items.indexOf(it) + 1;
  if (/\b(borra|quita|elimina)\b.*\bpanel\b/.test(s)) { c.layout.items = c.layout.items.filter(x => x !== it); return done(`borré el panel ${idx}`); }
  if (/\bduplica\b/.test(s)) { const d = clone(it); d.id = uid('it_'); d.layers.forEach(l => l.id = uid('ly_')); c.layout.items.splice(idx, 0, d); return done(`dupliqué el panel ${idx}`); }
  if (/\b(mueve|pasa|lleva)\b.*\b(al principio|al inicio|al final|arriba|abajo|antes|despues)\b/.test(s)) {
    const arr = c.layout.items; arr.splice(idx - 1, 1);
    let to = /principio|inicio/.test(s) ? 0 : /final/.test(s) ? arr.length : /despues del (\d+|\w+)/.test(s) ? (numIn(s.split('despues del')[1]) || idx) : /antes del (\d+|\w+)/.test(s) ? (numIn(s.split('antes del')[1]) || idx) - 1 : /arriba/.test(s) ? idx - 2 : idx;
    arr.splice(Math.max(0, Math.min(arr.length, to)), 0, it); return done(`moví el panel ${idx}`);
  }
  const fx = (it.fx ||= { b: 100, c: 100, s: 100 }); const cr = (it.crop ||= { z: 1, x: 0.5, y: 0.5 }); const a = itemAnim(it);
  if (/brill|claro|ilumina/.test(s) && !/menos/.test(s)) { fx.b = Math.min(200, fx.b + 15 * k); return done(`más brillo (${fx.b}%)`); }
  if (/oscur|menos brillo/.test(s)) { fx.b = Math.max(20, fx.b - 15 * k); return done(`más oscuro (${fx.b}%)`); }
  if (/contraste/.test(s)) { fx.c = /menos/.test(s) ? Math.max(20, fx.c - 15 * k) : Math.min(200, fx.c + 15 * k); return done(`contraste ${fx.c}%`); }
  if (/blanco y negro|sin color|gris/.test(s)) { fx.s = 0; return done('blanco y negro'); }
  if (/satur|colores? (mas )?viv|mas color/.test(s)) { fx.s = /menos/.test(s) ? Math.max(0, fx.s - 20 * k) : Math.min(250, fx.s + 20 * k); return done(`saturación ${fx.s}%`); }
  if (/(acerca|zoom).*(imagen|foto|panel)|acercale|haz zoom/.test(s) && !/lento|ken/.test(s)) { cr.z = Math.min(4, cr.z * (1 + 0.15 * k)); return done(`zoom ${Math.round(cr.z * 100)}%`); }
  if (/aleja/.test(s)) { cr.z = Math.max(1, cr.z / (1 + 0.15 * k)); return done(`zoom ${Math.round(cr.z * 100)}%`); }
  if (/recorta|cuadro|formato/.test(s)) { const f = /cuadrad/.test(s) ? 1 : /9.?16|vertical/.test(s) ? 1.778 : /16.?9|horizontal/.test(s) ? 0.5625 : /original/.test(s) ? null : undefined; if (f !== undefined) { it.frame = f; return done('formato cambiado'); } }
  if (/\b(tiembl|temblor|shake|sacud)/.test(s)) { a.shake = !/quita|sin|no /.test(s); return done(a.shake ? `temblor en panel ${idx}` : 'sin temblor'); }
  const part = Object.keys(PARTS).find(p => p !== 'none' && s.includes(p.slice(0, 5))); if (part && !/quita|sin /.test(s)) { a.particles = part; return done(`${PARTS[part]} en panel ${idx}`); }
  if (/(quita|sin) (las )?(particulas|lluvia|fuego|humo|nieve|chispas|efectos)/.test(s)) { a.particles = 'none'; return done('sin partículas'); }
  if (/zoom lento|ken ?burns|camara lenta/.test(s)) { a.kb = /afuera|alej/.test(s) ? 'out' : 'in'; return done('Ken Burns'); }
  if (/paneo|panea|recorre/.test(s)) { a.kb = /izquierda/.test(s) ? 'panL' : /arriba/.test(s) ? 'panU' : /abajo/.test(s) ? 'panD' : 'panR'; return done('paneo'); }
  if (/parallax/.test(s)) { a.parallax = !/quita|sin /.test(s); return done('parallax'); }
  if (/(entre|aparezca|entrada).*(desliz|fade|zoom|aparec)|deslizando|desvanec/.test(s)) { a.enter = /desliz/.test(s) ? 'slide' : /zoom/.test(s) ? 'zoom' : 'fade'; return done('entrada ' + ENTERS[a.enter]); }
  if (/\b(dura|duracion|segundos)\b/.test(s)) { const n = numIn(s); if (n) { a.dur = n; return done(`panel ${idx} dura ${n} s`); } }
  if (/\b(mas grande|agranda|grande|aumenta|mas alto)\b/.test(s)) { if ((it.scale || 100) < 100) it.scale = Math.min(100, (it.scale || 100) + 15 * k); else { const meta = m.images[it.imgId]; it.frame = Math.min(3, (it.frame || (meta?.w ? meta.h / meta.w : 1.4)) * (1 + 0.15 * k)); } return done(`panel ${idx} más grande`); }
  if (/\b(mas pequeno|mas chico|achica|reduce|pequeno)\b/.test(s)) { it.scale = Math.max(40, (it.scale || 100) - 15 * k); return done(`panel ${idx} más pequeño`); }
  if (/espacio|separa/.test(s)) { it.gap = Math.max(0, (it.gap ?? 80) + (/menos|junta|quita/.test(s) ? -40 : 40) * k); return done('espacio ajustado'); }
  return { ok: false };
}
async function runManhwaCmd(text) {
  const m = cur(); const c = chapterById(m, Route.a); if (!c) return;
  const clauses = splitClauses(text); const msgs = []; const unknown = [];
  beforeEdit(c);
  for (const cl of clauses) { const r = runManhwaClause(m, c, cl); if (r.ok) msgs.push(r.msg); else unknown.push(r.why ? r.why : cl); }
  afterEdit(c);
  if (msgs.length) { touch(m); render(); cmdLog('✔ ' + msgs.join(' · '), 'ok'); }
  if (unknown.length) {
    const rest = unknown.join(', ');
    if (CC.ok || await askAiPermission(rest)) await aiEditManhwa(m, c, rest, text);
    else if (!msgs.length) cmdLog(`No entendí: “${esc(rest)}”. Prueba: “sube el diálogo de Kael”, “pon el BOOM más arriba”, “panel 3 más grande”.`, 'err');
  }
}
async function askAiPermission(rest) {
  const r = await choiceBox('🤖 Pedirle a Claude', `No entendí “${esc(rest)}” con el intérprete rápido. ¿Se lo paso a Claude para que lo haga?`, [{ label: 'No', value: 'no' }, { label: CC.ok ? 'Claude Code' : isPremium() ? 'Claude Premium (copiar/pegar)' : 'Claude (API)', value: 'yes', cls: 'pri' }]);
  return r === 'yes';
}
function compactLayout(c) { return { bg: c.layout.bg, items: c.layout.items.map((it, i) => ({ n: i + 1, id: it.id, scale: it.scale || 100, gap: it.gap ?? 80, frame: it.frame || null, crop: it.crop, fx: it.fx, anim: it.anim, layers: it.layers.map(L => ({ ...L })) })) }; }
function applyLayout(c, lay) {
  if (!lay || !Array.isArray(lay.items)) throw new Error('La respuesta no trae un layout válido.');
  const byId = Object.fromEntries(c.layout.items.map(i => [i.id, i]));
  const items = lay.items.map(x => { const o = byId[x.id]; if (!o) return null; const keep = { imgId: o.imgId, fromPanel: o.fromPanel, blankH: o.blankH, color: o.color }; return { ...o, ...x, ...keep, layers: (x.layers || []).map(L => ({ ...mkLayer(L.kind || 'globo'), ...L, id: L.id || uid('ly_') })) }; }).filter(Boolean);
  if (!items.length) throw new Error('La respuesta dejó el capítulo vacío; no la apliqué.');
  items.forEach(i => delete i.n);
  c.layout.items = items; if (lay.bg) c.layout.bg = lay.bg;
}
async function aiEditManhwa(m, c, instr, full) {
  const lay = compactLayout(c);
  const sel = c.layout.items.findIndex(i => i.id === BSEL.item) + 1;
  cmdLog(CC.ok ? '🔌 Enviando a Claude Code…' : '🤖 Preguntando a Claude…');
  let out;
  if (CC.ok) { const r = await ccEdit('manhwa', full, lay, { selectedPanel: sel, manhwa: m.name, chapter: c.number }); out = r.project || r.layout; if (r.message) cmdLog('🔌 ' + esc(r.message), 'ok'); }
  else {
    const prompt = `Eres el asistente del Editor de Manhwa. Modifica este layout JSON según la instrucción del autor y devuelve SOLO el JSON completo modificado (mismo formato, mismos "id").
Coordenadas de capas: x, y, w, h en fracción (0 a 1) del cuadro del panel; rot en grados; fs = tamaño de letra relativo al ancho; kinds: globo, grito, pensamiento, narracion, texto, sfx, sticker. Panel: scale (40-100), gap (px), frame (alto/ancho o null), crop {z,x,y}, fx {b,c,s} en %, anim {enter: none|fade|slide|slideL|zoom, kb: none|in|out|panR|panL|panU|panD, shake, particles: none|lluvia|fuego|humo|nieve|chispas|velocidad|polvo, parallax, dur}.
Panel seleccionado ahora: ${sel || 'ninguno'}.
INSTRUCCIÓN: ${full}
LAYOUT:
${JSON.stringify(lay)}`;
    const r = await aiJSON(prompt, { max_tokens: Math.min(32000, JSON.stringify(lay).length / 2 + 2000), estOut: JSON.stringify(lay).length / 3, title: 'Editar con Claude', temperature: 0.2 });
    out = r.layout || r;
  }
  editLayout(c, () => applyLayout(c, out)); touch(m); render(); cmdLog('✔ Hecho por Claude. Si no te gusta: ↶ DESHACER', 'ok');
}

/* =====================================================================
   CONEXIÓN CON CLAUDE CODE (puente local seguro)
   ===================================================================== */
const CC = { ok: false, info: null, timer: null };
function ccConf() { S.settings.cc ||= { url: 'http://localhost:3200', token: '' }; return S.settings.cc; }
async function ccFetch(path, opts = {}, timeout = 3000) {
  const cf = ccConf(); const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try { const r = await fetch(cf.url.replace(/\/$/, '') + path, { ...opts, signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-token': cf.token || '', ...(opts.headers || {}) } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status); return j; }
  finally { clearTimeout(t); }
}
async function ccPing() {
  const cf = ccConf(); const was = CC.ok;
  if (!cf.token) CC.ok = false;
  else try { CC.info = await ccFetch('/status'); CC.ok = !!CC.info.ok; } catch (e) { CC.ok = false; }
  $$('#ccPill').forEach(p => { p.classList.toggle('on', CC.ok); p.textContent = `🔌 CONECTADO A CLAUDE CODE: ${CC.ok ? 'SÍ' : 'NO'}`; });
  if (was !== CC.ok && CC.ok) toast('🔌 Conectado a Claude Code', 'ok');
  return CC.ok;
}
function ccStartPolling() { clearInterval(CC.timer); ccPing(); CC.timer = setInterval(() => { if (!document.hidden && ccConf().token) ccPing(); }, 20000); }
async function ccEdit(kind, instruction, project, context = {}) {
  const r = await ccFetch('/edit', { method: 'POST', body: JSON.stringify({ kind, instruction, project, context }) }, 6 * 60 * 1000);
  return r;
}
ACT.ccOpen = () => {
  const cf = ccConf();
  const bg = modal(`<div class="row between"><h2>🔌 Conectar Claude Code</h2><span class="chip ${CC.ok ? 'ok' : ''}" id="ccSt">${CC.ok ? 'Conectado' : 'No conectado'}</span></div>
    <p class="small">Tu app es la cara bonita; <b>Claude Code es el cerebro</b>. Cuando dices algo que el intérprete rápido no entiende (por ejemplo “hazlo más épico”), la app le manda el proyecto a tu Claude Code, él lo edita y lo ves cambiar en vivo. Si no está conectado, la app edita sola.</p>
    <ol class="small" style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:6px">
      <li>En la computadora donde usas Claude Code, descarga el puente: <button class="sm pri" data-x="dl">⬇️ puente-claude-code.mjs</button></li>
      <li>Ponlo en la carpeta de tu proyecto “Video Editor Arquitecto” (la que tiene tu CLAUDE.md / skills).</li>
      <li>Abre una terminal en esa carpeta y escribe: <span class="kbd">node puente-claude-code.mjs</span> (necesitas Node 18+ y Claude Code instalado y con sesión iniciada).</li>
      <li>El puente muestra una <b>llave</b>. Pégala abajo y toca “Probar conexión”.</li>
    </ol>
    <div class="grid2"><label class="f">Dirección del puente<input id="ccUrl" value="${esc(cf.url)}"></label><label class="f">Llave del puente<input id="ccTok" value="${esc(cf.token || '')}" placeholder="la que muestra la terminal"></label></div>
    <div class="alert info small">Funciona en Chrome o Edge en la <b>misma computadora</b> donde corre Claude Code. En el celular, la app sigue editando sola. La llave evita que otras páginas usen tu Claude Code.</div>
    <div class="acts"><button data-x="close">Cerrar</button><button class="pri" data-x="test">Probar conexión</button></div>`, { wide: true });
  bg.querySelector('[data-x=close]').onclick = () => bg.close();
  bg.querySelector('[data-x=dl]').onclick = () => downloadBlob(new Blob([BRIDGE_SRC], { type: 'text/javascript' }), 'puente-claude-code.mjs');
  bg.querySelector('[data-x=test]').onclick = async e => {
    cf.url = bg.querySelector('#ccUrl').value.trim() || 'http://localhost:3200'; cf.token = bg.querySelector('#ccTok').value.trim(); saveSettings();
    await busy(e.target, async () => { const ok = await ccPing(); const st = bg.querySelector('#ccSt'); st.className = 'chip ' + (ok ? 'ok' : 'bad'); st.textContent = ok ? `Conectado · ${CC.info?.cwd || ''}` : 'No responde'; if (!ok) toast('No pude conectar. ¿Está corriendo el puente y la llave es correcta?', 'err'); else ccStartPolling(); }, 'Probando…');
  };
};
const BRIDGE_SRC = String.raw`#!/usr/bin/env node
// =====================================================================
// PUENTE MI MANHWA STUDIO <-> CLAUDE CODE
// Corre en tu computadora. Recibe órdenes de la app y se las pasa a
// Claude Code (modo no interactivo "claude -p"). Devuelve el proyecto editado.
// Uso:  node puente-claude-code.mjs        (en la carpeta de tu proyecto)
// Opcional: PORT=3200  CLAUDE_BIN=claude  CLAUDE_ARGS="--model opus"
// =====================================================================
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';

const PORT = Number(process.env.PORT || 3200);
const CWD = process.cwd();
const BIN = process.env.CLAUDE_BIN || 'claude';
const EXTRA = (process.env.CLAUDE_ARGS || '').split(' ').filter(Boolean);
// La llave se guarda en .llave-puente para que siempre sea la misma (solo la pegas una vez en la app)
const KEYFILE = join(CWD, '.llave-puente');
let TOKEN = process.env.PUENTE_TOKEN || (existsSync(KEYFILE) ? readFileSync(KEYFILE, 'utf8').trim() : '');
if (!TOKEN) { TOKEN = randomBytes(12).toString('hex'); try { writeFileSync(KEYFILE, TOKEN); } catch (e) { } }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Private-Network': 'true',
};
const send = (res, code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

function runClaude(prompt) {
  return new Promise((ok, fail) => {
    const p = spawn(BIN, ['-p', 'Sigue las instrucciones que llegan por la entrada estándar.', '--output-format', 'json', ...EXTRA], { cwd: CWD, shell: process.platform === 'win32' });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill(); fail(new Error('Claude Code tardó demasiado')); }, 15 * 60 * 1000);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => { clearTimeout(timer); fail(new Error('No encontré Claude Code (' + e.message + '). ¿Está instalado y en el PATH?')); });
    p.on('close', code => { clearTimeout(timer); if (code !== 0 && !out) return fail(new Error(err || 'Claude Code terminó con código ' + code)); try { const j = JSON.parse(out); ok(j.result ?? j.text ?? out); } catch { ok(out); } });
    p.stdin.write(prompt); p.stdin.end();
  });
}
function extractJSON(text) {
  const t = String(text).replace(/\x60\x60\x60(?:json)?/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Claude Code no devolvió JSON');
  return JSON.parse(t.slice(a, b + 1));
}
const GUIDE = {
  manhwa: 'Es el LAYOUT de un capítulo de manhwa (items = paneles, layers = globos/textos/sfx/stickers; coordenadas x,y,w,h en fracción 0-1 del panel; anim = animación por código).',
  video: 'Es un PROYECTO DE VIDEO (tracks con clips: start, dur, in en segundos; vol en dB; fadeIn/fadeOut; fx = efectos por código; notes = notas; words = transcripción con t0/t1; subs = subtítulos).',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.headers['x-token'] !== TOKEN) return send(res, 401, { error: 'Llave incorrecta' });
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/status') return send(res, 200, { ok: true, cwd: CWD, bin: BIN, ask: true });
  if (req.method === 'GET' && url.pathname === '/file') { // archivos que Claude Code genere en la carpeta (por ejemplo un video renderizado)
    const p = resolve(CWD, url.searchParams.get('path') || '');
    if (!p.startsWith(CWD + sep) || !existsSync(p) || !statSync(p).isFile()) return send(res, 404, { error: 'No existe' });
    const types = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
    res.writeHead(200, { ...cors, 'Content-Type': types[extname(p)] || 'application/octet-stream' }); return createReadStream(p).pipe(res);
  }
  if (req.method === 'POST' && url.pathname === '/ask') { // la app le pide a tu Claude Code cualquier tarea de texto (biblia, guiones, ideas…)
    let body = ''; for await (const ch of req) body += ch;
    let j; try { j = JSON.parse(body); } catch { return send(res, 400, { error: 'JSON inválido' }); }
    try { console.log('🤖 Claude Code trabajando: ' + String(j.title || 'tarea') + '…'); const out = await runClaude(String(j.prompt || '')); console.log('   ✔ listo'); return send(res, 200, { text: typeof out === 'string' ? out : JSON.stringify(out) }); }
    catch (e) { console.log('   ✕ ' + e.message); return send(res, 500, { error: e.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/edit') {
    let body = ''; for await (const ch of req) body += ch;
    let j; try { j = JSON.parse(body); } catch { return send(res, 400, { error: 'JSON inválido' }); }
    const prompt = [
      'Eres el "Video Editor Arquitecto" de MI MANHWA STUDIO. El autor te habla en español, sin comandos.',
      GUIDE[j.kind] || '',
      'Aplica la instrucción al JSON y devuelve SOLO un objeto JSON: {"project": <el JSON completo modificado, con los mismos id>, "message": "qué hiciste, en una frase"}.',
      'Si además generas un archivo (por ejemplo un video) dentro de esta carpeta, agrega "file": "ruta/relativa".',
      'Contexto: ' + JSON.stringify(j.context || {}),
      'INSTRUCCIÓN: ' + j.instruction,
      'JSON:', JSON.stringify(j.project),
    ].join('\n');
    try {
      const out = extractJSON(await runClaude(prompt));
      if (out.file) out.file_url = 'http://localhost:' + PORT + '/file?path=' + encodeURIComponent(out.file);
      return send(res, 200, out);
    } catch (e) { return send(res, 500, { error: e.message }); }
  }
  send(res, 404, { error: 'Ruta desconocida' });
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n🔌 Puente MI MANHWA STUDIO <-> Claude Code listo');
  console.log('   Dirección: http://localhost:' + PORT);
  console.log('   Carpeta:   ' + CWD);
  console.log('   LLAVE:     ' + TOKEN + '   <- pégala en la app UNA sola vez (siempre será la misma)\n');
});
`;
