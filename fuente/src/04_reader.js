/* =====================================================================
   Lector de Novela y Lector de Universo en audio (voces del navegador, gratis)
   ===================================================================== */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MALE = /(jorge|pablo|diego|raul|raúl|juan|carlos|enrique|miguel|andres|andrés|alvaro|álvaro|jaime|antonio|manuel|daniel|david|alex|fred|guy|mark|george|james|ryan|thomas|tom|eric|aaron|arthur|oliver|reed|rocko|male|hombre|masculin|gerardo|federico|lorenzo|tomas|tomás|dario|darío|alonso|liam)/i;
const FEMALE = /(monica|mónica|paulina|helena|laura|sabina|elvira|dalia|lucia|lucía|marisol|esperanza|paloma|female|mujer|femenin|samantha|zira|jenny|aria|karen|susan|victoria|ava|allison|serena|moira|tessa|fiona|emma|sara|ximena|elena|camila|catalina|isabela|sofia|sofía|valentina|google español|google us english)/i;
function guessGender(v) { if (MALE.test(v.name)) return 'm'; if (FEMALE.test(v.name)) return 'f'; return '?'; }

const Reader = {
  paras: [], idx: 0, char: 0, playing: false, paused: false, key: '', utt: null, chunks: [], ci: 0, chunkStart: 0, token: 0,
  stop(silent) { this.token++; this.playing = false; this.paused = false; try { speechSynthesis.cancel(); } catch (e) { } if (!silent) this.ui(); },
  voices() { try { return speechSynthesis.getVoices(); } catch (e) { return []; } },
  pref() { S.settings.voice ||= {}; const v = S.settings.voice; v.lang ||= 'es'; v.gender ||= 'f'; v.rate ||= 1; return v; },
  pickVoice() {
    const p = this.pref(); const vs = this.voices().filter(v => v.lang.toLowerCase().startsWith(p.lang));
    if (p.name) { const x = vs.find(v => v.name === p.name); if (x) return x; }
    return vs.find(v => guessGender(v) === p.gender) || vs.find(v => guessGender(v) === '?') || vs[0] || null;
  },
  textFor(i) { const p = this.paras[i]; if (!p) return ''; const lang = this.pref().lang; return lang === 'en' ? (p.en || p.text) : p.text; },
  splitChunks(t) { const out = []; let s = 0; const re = /[^.!?¡¿…\n]+[.!?…]*["»”]?\s*/g; let m; let buf = '', bufStart = 0; while ((m = re.exec(t))) { if (!buf) bufStart = m.index; if ((buf + m[0]).length > 220 && buf) { out.push({ text: buf, start: bufStart }); buf = m[0]; bufStart = m.index; } else buf += m[0]; } if (buf) out.push({ text: buf, start: bufStart }); return out.length ? out : [{ text: t, start: 0 }]; },
  play(from) {
    if (!('speechSynthesis' in window)) return toast('Tu navegador no puede leer en voz alta', 'err');
    if (!this.paras.length) return;
    if (from != null) { this.idx = from; this.char = 0; }
    if (this.idx >= this.paras.length) { this.idx = 0; this.char = 0; }
    this.token++; const tok = this.token;
    try { speechSynthesis.cancel(); } catch (e) { }
    this.playing = true; this.paused = false;
    const full = this.textFor(this.idx);
    this.chunks = this.splitChunks(full.slice(this.char)).map(c => ({ ...c, start: c.start + this.char }));
    this.ci = 0; this.ui(); this.speakChunk(tok);
  },
  speakChunk(tok) {
    if (tok !== this.token) return;
    const ch = this.chunks[this.ci];
    if (!ch) { // siguiente párrafo
      this.idx++; this.char = 0; this.savePos();
      if (this.idx >= this.paras.length) { this.playing = false; this.idx = this.paras.length - 1; this.ui(); toast('Lectura terminada 🎧'); return; }
      const full = this.textFor(this.idx); this.chunks = this.splitChunks(full); this.ci = 0; this.ui();
      return this.speakChunk(tok);
    }
    const u = new SpeechSynthesisUtterance(ch.text);
    const v = this.pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = this.pref().lang === 'en' ? 'en-US' : 'es-MX';
    u.rate = this.pref().rate; this.chunkStart = ch.start; this.char = ch.start;
    u.onboundary = e => { if (tok === this.token) { this.char = ch.start + (e.charIndex || 0); this.savePosSoon(); } };
    u.onend = () => { if (tok !== this.token) return; this.ci++; this.speakChunk(tok); };
    u.onerror = e => { if (tok !== this.token) return; if (e.error === 'interrupted' || e.error === 'canceled') return; this.ci++; this.speakChunk(tok); };
    this.utt = u; speechSynthesis.speak(u);
  },
  toggle() {
    if (!this.playing) return this.play();
    if (this.paused) { this.paused = false; this.play(); } // reanuda desde la última palabra (más fiable que resume)
    else { this.paused = true; this.token++; try { speechSynthesis.cancel(); } catch (e) { } this.savePos(); this.ui(); }
  },
  seek(i) { const was = this.playing && !this.paused; this.idx = Math.max(0, Math.min(this.paras.length - 1, i)); this.char = 0; this.savePos(); if (was) this.play(); else { this.playing = false; this.ui(); } },
  restartAtWord() { if (this.playing && !this.paused) this.play(); },
  savePos() { if (!this.key) return; S.settings.readerPos ||= {}; S.settings.readerPos[this.key] = { idx: this.idx, char: this.char, at: Date.now(), n: this.paras.length }; saveSettings(); },
  savePosSoon: debounce(function () { Reader.savePos(); }, 2500),
  label(i) { const p = this.paras[i]; if (!p) return ''; const inSec = this.paras.slice(0, i + 1).filter(x => x.sec === p.sec).length; return `${p.sec}, párrafo ${inSec}`; },
  ui() {
    const pb = $('#playBtn'); if (!pb) return;
    pb.textContent = this.playing && !this.paused ? '⏸' : '▶';
    const r = $('#seek'); if (r) { r.max = Math.max(0, this.paras.length - 1); r.value = this.idx; }
    const at = $('#atLbl'); if (at) at.textContent = this.paras.length ? `Vas en ${this.label(this.idx)} · ${this.idx + 1}/${this.paras.length}` : '';
    $$('.ptext .pp.on').forEach(x => x.classList.remove('on'));
    const el = $(`.ptext .pp[data-i="${this.idx}"]`); if (el) { el.classList.add('on'); const box = $('.ptext'); if (box) { const top = el.offsetTop - box.offsetTop - 80; box.scrollTo({ top, behavior: 'smooth' }); } }
  }
};
window.Reader = Reader;
try { speechSynthesis.onvoiceschanged = () => { if (Route.view === 'lector') fillVoiceSelect(); }; } catch (e) { }

/* -------- Construir textos -------- */
function novelParas(m) {
  const out = [];
  for (const c of chapterList(m)) {
    const sec = `Cap ${c.number}`;
    out.push({ sec, head: `Capítulo ${c.number}${c.title ? ': ' + c.title : ''}`, text: `Capítulo ${c.number}. ${c.title || ''}.`, isHead: true });
    if (c.novel) c.novel.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean).forEach(t => out.push({ sec, text: t }));
    else if (c.panels?.length) {
      for (const p of c.panels) {
        const parts = [];
        if (p.description) parts.push(p.description.trim().replace(/([^.!?])$/, '$1.'));
        for (const d of p.dialogues || []) {
          if (!d.text) continue;
          if (d.type === 'narracion' || /narraci/i.test(d.who)) parts.push(d.text);
          else if (d.type === 'pensamiento') parts.push(`«${d.text}», pensó ${d.who}.`);
          else if (d.type === 'grito') parts.push(`—¡${d.text.replace(/^¡|!$/g, '')}! —gritó ${d.who}.`);
          else if (d.type === 'susurro') parts.push(d.who ? `—${d.text} —susurró ${d.who}.` : `—${d.text}`);
          else parts.push(d.who ? `—${d.text} —dijo ${d.who}.` : `—${d.text}`);
        }
        if (parts.length) out.push({ sec, text: parts.join(' ') });
      }
    } else if (c.summary || c.premise) out.push({ sec, text: c.summary || c.premise });
  }
  return out;
}
const WIKI_SECTIONS = { personajes: 'Personajes', lugares: 'Lugares', poderes: 'Poderes', objetos: 'Objetos', facciones: 'Facciones', historia: 'Historia del mundo', canon: 'Fichas canon' };
function wikiParas(m, only) {
  const out = []; const add = (sec, head, list) => { if (!list.length) return; out.push({ sec, head, text: head + '.', isHead: true }); list.forEach(t => out.push({ sec, text: t })); };
  const want = k => !only || only === k;
  const b = m.bible;
  if (!only) add('Tu historia', 'Tu historia', [b.synopsis && 'Sinopsis: ' + b.synopsis, b.plot && 'La trama: ' + b.plot, b.rules && 'Las reglas de tu mundo: ' + b.rules].filter(Boolean));
  const nm = id => findEntity(m, id)?.name;
  if (want('personajes')) add('Personajes', `Tus personajes son ${m.characters.length}`, m.characters.map(c => [`${c.name}${c.nickname ? ', también llamado ' + c.nickname : ''}.`, c.age && `Tiene ${c.age} años.`, c.role && `${c.role}.`, c.status && c.status !== 'vivo' && `Estado: ${c.status}.`, c.power && `Su poder es: ${c.power}.`, c.weakness && `Su debilidad: ${c.weakness}.`, c.trauma && `Su trauma: ${c.trauma}.`, c.goal && `Su objetivo es ${c.goal}.`, c.appearance && `Se ve así: ${c.appearance}.`, (c.relations || []).length && 'Relaciones: ' + c.relations.map(r => `${r.kind} de ${nm(r.target)}`).filter(x => !x.endsWith('undefined')).join(', ') + '.', c.evolution && `Evolución: ${c.evolution}.`].filter(Boolean).join(' ').replace(/\.\./g, '.')));
  if (want('lugares')) add('Lugares', `Tus lugares son ${m.places.length}`, m.places.map(p => [`${p.name}${p.kind ? ', ' + p.kind.toLowerCase() : ''}.`, p.description, p.climate && `Clima: ${p.climate}.`, p.inhabitants && `Ahí vive: ${p.inhabitants}.`, p.rules && `Reglas: ${p.rules}.`].filter(Boolean).join(' ').replace(/\.\./g, '.')));
  if (want('poderes')) add('Poderes', 'Tu sistema de poderes funciona así', m.powers.map(p => [`${p.name}${p.kind ? ', ' + p.kind.toLowerCase() : ''}.`, p.description, p.ranks && `Rangos: ${p.ranks}.`, p.cost && `Costo de usarlo: ${p.cost}.`, p.users && `Lo usan: ${p.users}.`].filter(Boolean).join(' ').replace(/\.\./g, '.')));
  if (want('objetos')) add('Objetos', 'Tus objetos y armas', m.objects.map(p => [`${p.name}.`, p.description, p.owner && `Pertenece a ${p.owner}.`, p.power && `Poder: ${p.power}.`, p.cost && `Costo: ${p.cost}.`].filter(Boolean).join(' ')));
  if (want('facciones')) add('Facciones', 'Tus facciones y gremios', m.factions.map(p => [`${p.name}.`, p.description, p.leader && `Su líder: ${p.leader}.`, p.goals && `Buscan: ${p.goals}.`].filter(Boolean).join(' ')));
  if (want('historia')) add('Historia', 'La historia de tu mundo', [...m.timeline].sort((a, b) => (a.order || 0) - (b.order || 0)).map(t => `${t.when}: ${t.name}. ${t.description || ''}`));
  if (want('canon')) add('Canon', 'Tus hechos canon', m.canon.map(f => `${f.entity}: ${f.attribute}, ${f.value}${f.since ? ', desde el capítulo ' + f.since : ''}.`));
  return out;
}

/* -------- Vista -------- */
VIEWS.lector = () => {
  const m = cur(); const mode = Route.a === 'universo' ? 'universo' : 'novela'; const only = mode === 'universo' ? (Route.b || '') : '';
  const paras = mode === 'novela' ? novelParas(m) : wikiParas(m, only);
  Reader.stop(true);
  Reader.paras = paras; Reader.idx = 0; Reader.char = 0; Reader.key = `${m.id}:${mode}:${only}`;
  const pref = Reader.pref();
  // traducciones guardadas
  if (pref.lang === 'en') { const cache = (S.trCache ||= {}); paras.forEach(p => { const h = hash(p.text); if (cache[h]) p.en = cache[h]; }); }
  const missingNovel = mode === 'novela' ? chapterList(m).filter(c => !c.novel && c.panels?.length).length : 0;
  return `<div class="head"><div><h1>${mode === 'novela' ? '🎧 Leer como novela' : '🌌 Escuchar mi universo'}</h1><p class="muted">${esc(m.name)} · ${plural(paras.filter(p => !p.isHead).length, 'párrafo', 'párrafos')}</p></div>
    <div class="row">${mode === 'novela' ? `<button data-a="novelize" ${missingNovel ? '' : 'disabled'}>✨ Convertir guiones a prosa con IA${missingNovel ? ` (${missingNovel})` : ''}</button>` : ''}
    <button data-a="go" data-to="${mlink(m, 'lector', mode === 'novela' ? 'universo' : 'novela')}">${mode === 'novela' ? '🌌 Escuchar mi universo' : '🎧 Leer como novela'}</button></div></div>
    ${mode === 'universo' ? `<div class="row" style="margin-bottom:14px">${[['', 'Todo mi universo'], ['personajes', 'Solo personajes'], ['lugares', 'Solo lugares'], ['poderes', 'Solo poderes'], ['objetos', 'Solo objetos'], ['historia', 'Solo historia']].map(([k, l]) => `<button class="${only === k ? 'pri' : ''}" data-a="go" data-to="${mlink(m, 'lector', 'universo', k)}">${k ? 'ESCUCHAR ' : '🎧 '}${l.toUpperCase()}</button>`).join('')}</div>` : ''}
    ${paras.length ? `<div class="panelbox"><div class="ptext">${paras.map((p, i) => p.isHead ? `<div class="ph pp" data-i="${i}" data-a="readFrom">${esc(p.head)}</div>` : `<div class="pp" data-i="${i}" data-a="readFrom">${esc(pref.lang === 'en' && p.en ? p.en : p.text)}</div>`).join('')}</div></div>` : `<div class="empty">${mode === 'novela' ? 'Aún no hay capítulos con contenido.' : 'Tu wiki está vacía en esta sección.'}</div>`}
    ${paras.length ? hdPanel(m, mode, only) : ''}
    <div class="player">
      <div class="row nw"><button class="sm icon" data-a="rdPrev" title="Párrafo anterior">⏮</button><button id="playBtn" class="pri playbtn" data-a="rdToggle">▶</button><button class="sm icon" data-a="rdNext" title="Siguiente párrafo">⏭</button>
        <div class="grow col" style="gap:2px"><input id="seek" type="range" min="0" max="${Math.max(0, paras.length - 1)}" value="0"><span id="atLbl" class="small muted"></span></div></div>
      <div class="row">
        <label class="f" style="width:auto">Velocidad<select id="rdRate">${SPEEDS.map(s => `<option value="${s}" ${pref.rate == s ? 'selected' : ''}>${s}x</option>`).join('')}</select></label>
        <label class="f" style="width:auto">Voz<select id="rdGender"><option value="f" ${pref.gender === 'f' ? 'selected' : ''}>Femenina</option><option value="m" ${pref.gender === 'm' ? 'selected' : ''}>Masculina</option></select></label>
        <label class="f" style="width:auto">Idioma<select id="rdLang"><option value="es" ${pref.lang === 'es' ? 'selected' : ''}>Español</option><option value="en" ${pref.lang === 'en' ? 'selected' : ''}>Inglés</option></select></label>
        <label class="f grow">Voz exacta<select id="rdVoice"></select></label>
      </div>
      <div class="tiny dim">🆓 Esta es la voz gratis de tu navegador/teléfono. Para un audio descargable usa “Audio HD” arriba.</div>
    </div>`;
};
function fillVoiceSelect() {
  const sel = $('#rdVoice'); if (!sel) return; const p = Reader.pref();
  const vs = Reader.voices().filter(v => v.lang.toLowerCase().startsWith(p.lang));
  const chosen = Reader.pickVoice();
  sel.innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.name)}" ${chosen && chosen.name === v.name ? 'selected' : ''}>${esc(v.name)} (${v.lang})${guessGender(v) === 'm' ? ' ♂' : guessGender(v) === 'f' ? ' ♀' : ''}</option>`).join('') : `<option>No hay voces en ${p.lang === 'en' ? 'inglés' : 'español'} en este dispositivo</option>`;
  if (!vs.some(v => guessGender(v) === p.gender) && vs.length) $('#atLbl') && ($('#atLbl').title = 'No encontré una voz de ese género; uso la disponible.');
}
AFTER.lector = () => {
  fillVoiceSelect(); Reader.ui();
  const p = Reader.pref();
  $('#seek').oninput = e => Reader.seek(+e.target.value);
  $('#rdRate').onchange = e => { p.rate = +e.target.value; saveSettings(); Reader.restartAtWord(); };
  $('#rdGender').onchange = e => { p.gender = e.target.value; p.name = ''; saveSettings(); fillVoiceSelect(); Reader.restartAtWord(); };
  $('#rdVoice').onchange = e => { p.name = e.target.value; saveSettings(); Reader.restartAtWord(); };
  $('#rdLang').onchange = async e => { p.lang = e.target.value; p.name = ''; saveSettings(); if (p.lang === 'en') await translateReader(); render(); };
  const pos = S.settings.readerPos?.[Reader.key];
  if (pos && (pos.idx > 0 || pos.char > 0) && pos.idx < Reader.paras.length) {
    const lbl = Reader.label(pos.idx);
    choiceBox('🎧 ¿Seguir donde te quedaste?', `Te quedaste en <b>${esc(lbl)}</b> (${fmtDate(pos.at)}).`, [{ label: 'Empezar de nuevo', value: 'no' }, { label: '▶ Seguir', value: 'yes', cls: 'pri' }]).then(r => {
      if (r === 'yes') { Reader.idx = pos.idx; Reader.char = pos.char || 0; Reader.ui(); Reader.play(); }
      else if (r === 'no') { Reader.idx = 0; Reader.char = 0; Reader.savePos(); Reader.ui(); }
    });
  }
};
ACT.rdToggle = () => Reader.toggle();
ACT.rdPrev = () => Reader.seek(Reader.idx - 1);
ACT.rdNext = () => Reader.seek(Reader.idx + 1);
ACT.readFrom = el => { Reader.idx = +el.dataset.i; Reader.char = 0; Reader.play(); };
async function translateReader() {
  const todo = Reader.paras.filter(p => !p.en);
  if (!todo.length) return;
  if (!S.user) { toast('Para escuchar en inglés traduzco con IA: inicia sesión y guarda tu API key de Claude.', 'err'); return; }
  const per = isPremium() ? 400 : 40;
  const chars = todo.reduce((a, p) => a + p.text.length, 0);
  if (!isPremium() && !await confirmCost('Traducir al inglés para escuchar', [aiLine(chars + 300, Math.round(chars / 3.2), Math.round(chars / 2), `Traducir ${todo.length} párrafos`)])) return;
  const cache = (S.trCache ||= {});
  try {
    for (let a = 0; a < todo.length; a += per) {
      const chunk = todo.slice(a, a + per);
      const r = await aiJSON(`Traduce al inglés natural (estilo audiolibro) cada texto. Formato: ["traducción 1", "traducción 2", …] en el mismo orden.\n${JSON.stringify(chunk.map(p => p.text))}`, { max_tokens: Math.min(32000, Math.round(chunk.reduce((x, p) => x + p.text.length, 0) / 2) + 500), temperature: 0.3, confirmed: true, title: 'Traducir al inglés' });
      chunk.forEach((p, i) => { if (r[i]) { p.en = r[i]; cache[hash(p.text)] = r[i]; } });
    }
    toast('Listo, ahora en inglés', 'ok');
  } catch (e) { if (e.message !== 'Cancelado') toast(e.message, 'err'); }
}
ACT.novelize = async el => {
  const m = cur(); const caps = chapterList(m).filter(c => !c.novel && c.panels?.length);
  if (!isPremium()) { const chars = caps.reduce((a, c) => a + scriptText(c).length + 12000, 0); if (!await confirmCost('Convertir guiones a novela', [aiLine(chars, caps.length * 2500, caps.length * 8000, `${plural(caps.length, 'capítulo', 'capítulos')} a prosa`)])) return; }
  await busy(el, async () => {
    for (const c of caps) {
      el.innerHTML = `<span class="spin"></span> Cap ${c.number}…`;
      const { text } = await ai(`Convierte este guion de manhwa en prosa de novela en español, narrador en tercera persona, ritmo de audiolibro, con los diálogos con raya (—). No inventes hechos que no estén en el guion. Sin títulos, solo párrafos separados por línea en blanco.
Contexto del mundo:\n${brain(m, { maxChars: 12000, skipChapterId: c.id })}
GUION Cap ${c.number} "${c.title}":\n${scriptText(c)}`, { max_tokens: 8000, temperature: 0.7, confirmed: true, title: `Cap ${c.number} a novela` });
      c.novel = text.trim(); touch(m);
    }
    render(); toast('Capítulos convertidos a novela 📚', 'ok');
  }, 'Escribiendo…');
};

/* =====================================================================
   Audio HD descargable (Fal.ai Kokoro · $0.02 por 1000 caracteres)
   ===================================================================== */
const HD_VOICES = { es: [['ef_dora', 'Dora (mujer)'], ['em_alex', 'Alex (hombre)'], ['em_santa', 'Santa (hombre)']], en: [['af_heart', 'Heart (woman)'], ['af_bella', 'Bella (woman)'], ['am_adam', 'Adam (man)'], ['am_michael', 'Michael (man)']] };
const HD_APP = { es: 'fal-ai/kokoro/spanish', en: 'fal-ai/kokoro/american-english' };
function hdVoice() { const p = Reader.pref(); const list = HD_VOICES[p.lang] || HD_VOICES.es; if (p.hdVoice && list.some(v => v[0] === p.hdVoice)) return p.hdVoice; return (p.gender === 'm' ? list.find(v => /hombre|man/.test(v[1])) : list[0])[0]; }
function hdScopes(m, mode) {
  if (mode !== 'novela') return [['all', 'Todo lo de esta pantalla']];
  return [['all', 'Todos los capítulos'], ...chapterList(m).map(c => [c.id, `Cap ${c.number}: ${c.title || ''}`])];
}
function hdIdxs(m, mode, scope) {
  if (scope === 'all' || mode !== 'novela') return Reader.paras.map((_, i) => i);
  const c = chapterById(m, scope); if (!c) return [];
  const sec = `Cap ${c.number}`; return Reader.paras.map((p, i) => p.sec === sec ? i : -1).filter(i => i >= 0);
}
function hdKey(mode, only, scope) { const p = Reader.pref(); return `${mode}:${only || ''}:${scope}:${p.lang}:${hdVoice()}`; }
function hdPanel(m, mode, only) {
  const p = Reader.pref(); const scope = p.hdScope && hdScopes(m, mode).some(x => x[0] === p.hdScope) ? p.hdScope : (mode === 'novela' && chapterList(m)[0] ? chapterList(m)[0].id : 'all');
  p.hdScope = scope;
  const key = hdKey(mode, only, scope); const meta = (m.audios || {})[key];
  const idxs = hdIdxs(m, mode, scope); const chars = idxs.reduce((a, i) => a + Reader.textFor(i).length, 0);
  const stale = meta && meta.hash !== hash(idxs.map(i => Reader.textFor(i)).join('\n'));
  const others = Object.values(m.audios || {}).filter(a => a.key !== key);
  return `<div class="panelbox" style="margin-top:16px"><div class="row between"><h2>🎙️ Audio HD descargable</h2><span class="chip">${money(costTTS(1000))} por 1000 caracteres · Fal.ai</span></div>
    <div class="row">
      <label class="f grow">¿Qué quieres en audio?<select id="hdScope">${hdScopes(m, mode).map(([v, l]) => `<option value="${esc(v)}" ${v === scope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="f grow">Voz HD<select id="hdVoice">${(HD_VOICES[p.lang] || HD_VOICES.es).map(([v, l]) => `<option value="${v}" ${v === hdVoice() ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${meta ? `<audio id="hdA" controls preload="metadata" style="width:100%"></audio>
      <div class="row"><label class="f" style="width:auto">Velocidad<select id="hdRate">${SPEEDS.map(s => `<option value="${s}" ${p.rate == s ? 'selected' : ''}>${s}x</option>`).join('')}</select></label>
      <button class="pri" data-a="hdDownload" data-k="${esc(key)}">⬇️ DESCARGAR AUDIO (${meta.ext === 'mp3' ? 'MP3' : 'WAV'} · ${(meta.size / 1e6).toFixed(1)} MB)</button>
      <button class="sm danger" data-a="hdDelete" data-k="${esc(key)}">🗑️ Borrar audio</button></div>
      <div class="small muted" id="hdAt">${fmtDur(meta.dur)} de audio · creado ${fmtDate(meta.at)}</div>
      ${stale ? `<div class="alert warn small">El texto cambió desde que se creó este audio. <button class="sm" data-a="hdMake">Volver a crear (${money(costTTS(chars))})</button></div>` : ''}`
    : `<div class="row"><button class="pri" data-a="hdMake" ${chars ? '' : 'disabled'}>🎙️ Crear audio (${(chars / 1000).toFixed(1)}k caracteres ≈ ${money(costTTS(chars))})</button><span class="tiny dim">≈ ${fmtDur(chars / 15)} de audio${p.lang === 'en' ? ' · primero se traduce al inglés' : ''}</span></div>`}
    <div id="hdProg"></div>
    ${others.length ? `<details><summary class="small muted" style="cursor:pointer">Otros audios guardados (${others.length})</summary><div class="col" style="gap:6px;margin-top:8px">${others.map(a => `<div class="row nw between small"><span class="grow">${esc(a.label)} · ${fmtDur(a.dur)}</span><button class="sm" data-a="hdDownload" data-k="${esc(a.key)}">⬇️</button><button class="sm icon danger" data-a="hdDelete" data-k="${esc(a.key)}">🗑️</button></div>`).join('')}</div></details>` : ''}
  </div>`;
}
function fmtDur(sec) { sec = Math.round(sec || 0); const h = Math.floor(sec / 3600), mi = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + 'h ' : '') + mi + ':' + String(s).padStart(2, '0'); }
async function hdBlob(m, meta) {
  let b = await IDB.get('kv', 'audio:' + m.id + ':' + meta.key).catch(() => null);
  if (!b && meta.path && S.user) { const { data } = await sb.storage.from('studio').download(meta.path); if (data) { b = data; IDB.put('kv', 'audio:' + m.id + ':' + meta.key, b).catch(() => { }); } }
  return b;
}
async function setupHDPlayer() {
  const m = cur(); const a = $('#hdA'); if (!a) return;
  const p = Reader.pref(); const mode = Route.a === 'universo' ? 'universo' : 'novela'; const only = mode === 'universo' ? (Route.b || '') : '';
  const key = hdKey(mode, only, p.hdScope); const meta = m.audios?.[key]; if (!meta) return;
  const b = await hdBlob(m, meta); if (!b) { $('#hdAt').textContent = 'No encontré el archivo de audio (¿borrado?). Vuelve a crearlo.'; return; }
  a.src = URL.createObjectURL(b); a.playbackRate = p.rate;
  $('#hdRate').onchange = e => { p.rate = +e.target.value; a.playbackRate = p.rate; saveSettings(); };
  const posKey = m.id + ':' + key;
  let lastSave = 0;
  a.ontimeupdate = () => {
    const t = a.currentTime; let idx = meta.map?.[0]?.i ?? 0;
    for (const x of meta.map || []) { if (x.t <= t) idx = x.i; else break; }
    if (Reader.idx !== idx) { Reader.idx = idx; Reader.ui(); }
    const at = $('#hdAt'); if (at) at.textContent = `Vas en ${Reader.label(idx)} · ${fmtDur(t)} / ${fmtDur(meta.dur)}`;
    if (Date.now() - lastSave > 3000) { lastSave = Date.now(); S.settings.audioPos[posKey] = { t, at: Date.now() }; saveSettings(); }
  };
  a.onplay = () => { Reader.stop(); a.playbackRate = p.rate; };
  const pos = S.settings.audioPos?.[posKey];
  if (pos && pos.t > 5 && pos.t < meta.dur - 3) {
    const r = await choiceBox('🎧 ¿Seguir donde te quedaste?', `Te quedaste en el minuto <b>${fmtDur(pos.t)}</b> del audio HD (${fmtDate(pos.at)}).`, [{ label: 'Empezar de nuevo', value: 'no' }, { label: '▶ Seguir', value: 'yes', cls: 'pri' }]);
    if (r === 'yes') { a.currentTime = pos.t; a.play().catch(() => { }); }
  }
}
const _afterLector = AFTER.lector;
AFTER.lector = () => {
  const p = Reader.pref();
  const hasHD = !!$('#hdA');
  if (!hasHD) _afterLector(); else { fillVoiceSelect(); Reader.ui(); bindReaderControls(); }
  const sc = $('#hdScope'); if (sc) sc.onchange = e => { p.hdScope = e.target.value; saveSettings(); render(); };
  const hv = $('#hdVoice'); if (hv) hv.onchange = e => { p.hdVoice = e.target.value; saveSettings(); render(); };
  setupHDPlayer();
};
function bindReaderControls() {
  const p = Reader.pref();
  $('#seek').oninput = e => Reader.seek(+e.target.value);
  $('#rdRate').onchange = e => { p.rate = +e.target.value; saveSettings(); Reader.restartAtWord(); const a = $('#hdA'); if (a) a.playbackRate = p.rate; };
  $('#rdGender').onchange = e => { p.gender = e.target.value; p.name = ''; p.hdVoice = ''; saveSettings(); render(); };
  $('#rdVoice').onchange = e => { p.name = e.target.value; saveSettings(); Reader.restartAtWord(); };
  $('#rdLang').onchange = async e => { p.lang = e.target.value; p.name = ''; p.hdVoice = ''; saveSettings(); if (p.lang === 'en') await translateReader(); render(); };
}
ACT.hdDownload = async el => {
  const m = cur(); const meta = m.audios?.[el.dataset.k]; if (!meta) return;
  await busy(el, async () => { const b = await hdBlob(m, meta); if (!b) throw new Error('No encontré el audio'); downloadBlob(b, `${safeName(m.name)}_${safeName(meta.label)}.${meta.ext}`); }, 'Preparando…');
};
ACT.hdDelete = async el => {
  const m = cur(); const meta = m.audios?.[el.dataset.k]; if (!meta) return;
  if (!await confirmBox(`¿Borrar el audio “${esc(meta.label)}”?`)) return;
  if (meta.path && S.user) sb.storage.from('studio').remove([meta.path]).catch(() => { });
  IDB.del('kv', 'audio:' + m.id + ':' + meta.key).catch(() => { });
  delete m.audios[meta.key]; touch(m); render();
};
function chunkParas(items, max = 1500) {
  const out = []; let curC = null;
  for (const it of items) {
    let t = it.t.trim(); if (!t) continue;
    while (t.length > max) { let cut = t.lastIndexOf('. ', max); if (cut < max * 0.4) cut = t.lastIndexOf(' ', max); out.push({ parts: [{ i: it.i, t: t.slice(0, cut + 1) }] }); t = t.slice(cut + 1).trim(); curC = null; }
    if (!curC || curC.len + t.length > max) { curC = { parts: [], len: 0 }; out.push(curC); }
    curC.parts.push({ i: it.i, t }); curC.len = (curC.len || 0) + t.length + 1;
  }
  return out;
}
function encodeWav(f32, rate) {
  const b = new ArrayBuffer(44 + f32.length * 2), v = new DataView(b); const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + f32.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, f32.length * 2, true);
  for (let i = 0; i < f32.length; i++) { const x = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([b], { type: 'audio/wav' });
}
async function encodeMp3(f32, rate, prog) {
  const enc = new lamejs.Mp3Encoder(1, rate, 64); const out = []; const N = 1152; const i16 = new Int16Array(N);
  for (let i = 0, k = 0; i < f32.length; i += N, k++) {
    const n = Math.min(N, f32.length - i); const blk = n === N ? i16 : new Int16Array(n);
    for (let j = 0; j < n; j++) { const x = Math.max(-1, Math.min(1, f32[i + j])); blk[j] = x < 0 ? x * 0x8000 : x * 0x7fff; }
    const buf = enc.encodeBuffer(blk); if (buf.length) out.push(new Uint8Array(buf));
    if (k % 400 === 0) { prog && prog(i / f32.length); await sleep(0); }
  }
  const end = enc.flush(); if (end.length) out.push(new Uint8Array(end));
  return new Blob(out, { type: 'audio/mpeg' });
}
ACT.hdMake = async el => {
  const m = cur(); const p = Reader.pref(); const mode = Route.a === 'universo' ? 'universo' : 'novela'; const only = mode === 'universo' ? (Route.b || '') : '';
  if (!S.user) return toast('Inicia sesión y guarda tu API key de Fal.ai para crear audio HD.', 'err');
  if (p.lang === 'en' && Reader.paras.some(x => !x.en)) { await translateReader(); if (Reader.paras.some(x => !x.en)) return; }
  const scope = p.hdScope; const idxs = hdIdxs(m, mode, scope);
  const items = idxs.map(i => ({ i, t: Reader.textFor(i) })); const chars = items.reduce((a, x) => a + x.t.length, 0);
  const label = (mode === 'novela' ? (hdScopes(m, mode).find(x => x[0] === scope)?.[1] || 'Novela') : 'Universo' + (only ? ' · ' + only : '')) + ` (${p.lang.toUpperCase()}, ${(HD_VOICES[p.lang].find(v => v[0] === hdVoice()) || [])[1] || ''})`;
  if (!await confirmCost('Crear audio HD descargable', [{ label: `${label} · ${(chars / 1000).toFixed(1)}k caracteres`, cost: costTTS(chars), note: `Voz Kokoro en Fal.ai · ${money(costTTS(1000))} por 1000 caracteres` }])) return;
  const prog = t => { const e = $('#hdProg'); if (e) e.innerHTML = `<div class="small muted">${t}</div>`; };
  await busy(el, async () => {
    const chunks = chunkParas(items); const voice = hdVoice(); const app = HD_APP[p.lang] || HD_APP.es;
    const RATE = 24000; const ctx = new OfflineAudioContext(1, 1, RATE);
    const pcm = []; const map = []; let total = 0; const tmp = [];
    for (let k = 0; k < chunks.length; k++) {
      prog(`Creando voz ${k + 1}/${chunks.length}…`);
      const text = chunks[k].parts.map(x => x.t).join(' ');
      let r; for (let tries = 0; tries < 2; tries++) { try { r = await callFn('falRun', { app, input: { prompt: text, voice, speed: 1 }, manhwaId: m.id }); break; } catch (e) { if (tries) throw e; await sleep(1500); } }
      let b = null;
      if (r.audio?.path) { tmp.push(r.audio.path); const { data } = await sb.storage.from('studio').download(r.audio.path); b = data; }
      if (!b && r.audio?.url) { const fr = await fetch(r.audio.url); b = await fr.blob(); }
      if (!b) throw new Error('Fal.ai no devolvió audio');
      const ab = await ctx.decodeAudioData(await b.arrayBuffer());
      const data = ab.getChannelData(0); const dur = data.length / RATE;
      let acc = 0; const L = chunks[k].parts.reduce((a, x) => a + x.t.length, 0) || 1;
      chunks[k].parts.forEach(x => { if (!map.length || map[map.length - 1].i !== x.i) map.push({ i: x.i, t: total + dur * acc / L }); acc += x.t.length; });
      pcm.push(data); total += dur;
      const gap = new Float32Array(Math.round(RATE * 0.35)); pcm.push(gap); total += gap.length / RATE;
    }
    addSpend(costTTS(chars));
    const all = new Float32Array(pcm.reduce((a, x) => a + x.length, 0)); let o = 0; pcm.forEach(x => { all.set(x, o); o += x.length; });
    let blob, ext;
    if (window.lamejs) { prog('Comprimiendo a MP3…'); blob = await encodeMp3(all, RATE, f => prog(`Comprimiendo a MP3… ${Math.round(f * 100)}%`)); ext = 'mp3'; }
    else { blob = encodeWav(all, RATE); ext = 'wav'; }
    const key = hdKey(mode, only, scope);
    await IDB.put('kv', 'audio:' + m.id + ':' + key, blob);
    const meta = { key, label, ext, dur: total, size: blob.size, map, at: Date.now(), hash: hash(items.map(x => x.t).join('\n')), path: null };
    if (S.user) try {
      prog('Guardando en tu nube…');
      const path = `${S.user.id}/${m.id}/audio/${hash(key)}_${Date.now()}.${ext}`;
      const up = await sb.storage.from('studio').upload(path, blob, { contentType: blob.type, upsert: true });
      if (!up.error) meta.path = path;
      if (tmp.length) sb.storage.from('studio').remove(tmp).catch(() => { });
      const old = m.audios?.[key]; if (old?.path && old.path !== meta.path) sb.storage.from('studio').remove([old.path]).catch(() => { });
    } catch (e) { toast('El audio quedó en este dispositivo; se subirá a la nube cuando haya conexión.'); }
    (m.audios ||= {})[key] = meta; touch(m); render();
    toast(`Audio listo: ${fmtDur(total)} · ya puedes escucharlo y descargarlo 🎧`, 'ok');
  }, 'Creando audio…');
};
