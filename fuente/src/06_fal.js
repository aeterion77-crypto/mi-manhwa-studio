/* =====================================================================
   Fal.ai: generación de paneles, Laboratorio de LoRA, entrenamiento,
   hojas de modelo, actualizar personaje. La API key NUNCA está aquí:
   la guarda y la usa tu función segura en Supabase.
   ===================================================================== */
const SHEET_SLOTS = [['front', 'Frente', 'full body, front view, standing, neutral pose'], ['profile', 'Perfil', 'full body, side view profile, standing'], ['back', 'Espalda', 'full body, back view, from behind'],
  ['neutral', 'Neutral', 'portrait, neutral expression'], ['happy', 'Feliz', 'portrait, happy smiling expression'], ['angry', 'Enojado', 'portrait, angry furious expression'], ['sad', 'Triste', 'portrait, sad expression, teary eyes'],
  ['surprised', 'Sorprendido', 'portrait, surprised shocked expression'], ['determined', 'Decidido', 'portrait, determined intense expression'], ['scared', 'Asustado', 'portrait, scared expression, sweat'], ['blush', 'Sonrojado', 'portrait, embarrassed blushing expression']];
const randSeed = () => Math.floor(Math.random() * 2147483000);
function imgLine(n, w, h, label) { const mp = Math.max(1, Math.ceil(w * h / 1e6)); const app = S.settings.falApp || 'fal-ai/flux-lora'; return { label: label || `${plural(n, 'imagen', 'imágenes')} ${w}×${h} en Fal.ai`, cost: costImages(n, w, h), note: `${money(falUnit(app))} por megapíxel · ${mp} MP c/u${app === 'fal-ai/lora' ? ' · precio aproximado para Pony/SDXL' : ''}` }; }

function falRequest(m, { prompt, negative = '', loras = [], width, height, seed, steps, cfg }) {
  const app = S.settings.falApp || 'fal-ai/flux-lora';
  const st = m.bible.style;
  width = Math.round((width || st.width || 800) / 8) * 8; height = Math.round((height || st.height || 1200) / 8) * 8;
  const common = { prompt, image_size: { width, height }, num_images: 1, seed, loras: loras.filter(l => l.path), enable_safety_checker: true };
  if (app === 'fal-ai/lora') {
    if (!S.settings.sdxlModel) throw new Error('Elegiste SDXL/Pony: escribe en Configuración el modelo (repo de Hugging Face o URL del checkpoint).');
    return { app, input: { ...common, model_name: S.settings.sdxlModel, negative_prompt: negative, num_inference_steps: steps || st.steps || 30, guidance_scale: cfg || st.cfg || 7, prompt: (S.settings.ponyPrefix ?? 'score_9, score_8_up, score_7_up, ') + prompt } };
  }
  return { app, input: { ...common, num_inference_steps: Math.min(50, steps || 28), guidance_scale: 3.5, output_format: 'jpeg' } };
}
/* genera N imágenes con semillas propias (para poder repetir cualquiera) */
async function falGenerate(m, opts, n = 1, meta = {}, { confirmed = false, title = 'Generar imágenes en Fal.ai' } = {}) {
  const st0 = m.bible.style; const W0 = opts.width || st0.width || 800, H0 = opts.height || st0.height || 1200;
  if (!confirmed && !await confirmCost(title, [imgLine(n, W0, H0)])) throw new Error('Cancelado');
  const seeds = Array.from({ length: n }, (_, i) => opts.seed != null ? opts.seed + i : randSeed());
  const runs = seeds.map(async seed => {
    const req = falRequest(m, { ...opts, seed });
    const r = await callFn('falRun', { app: req.app, input: req.input, manhwaId: m.id });
    const im = r.images?.[0]; if (!im) throw new Error('Fal.ai no devolvió imagen');
    if (r.has_nsfw_concepts?.[0]) toast('Fal.ai marcó una imagen como sensible y puede venir en negro.', 'err');
    const settings = { app: req.app, width: req.input.image_size.width, height: req.input.image_size.height, steps: req.input.num_inference_steps, cfg: req.input.guidance_scale, loras: req.input.loras, model: req.input.model_name || null };
    return addRemoteImage(m, im, { seed: r.seed ?? seed, prompt: opts.prompt, negative: opts.negative || '', settings, ...meta });
  });
  const res = await Promise.allSettled(runs);
  const ok = res.filter(x => x.status === 'fulfilled').map(x => x.value);
  const bad = res.find(x => x.status === 'rejected');
  if (ok.length) addSpend(costImages(ok.length, W0, H0));
  if (!ok.length && bad) throw bad.reason;
  if (bad) toast('Una imagen falló: ' + bad.reason.message, 'err');
  return ok;
}

/* ---------------- Paneles del capítulo ---------------- */
ACT.genPanel = async el => {
  const m = cur(); const c = chapterById(m, Route.a); const p = c.panels[+el.dataset.i];
  await busy(el, async () => {
    const P = buildPanelPrompt(m, p);
    const [id] = await falGenerate(m, P, 1, { panel: p.id, chapter: c.id }, { title: `Generar panel #${+el.dataset.i + 1}` });
    p.approved = true; p.imageId = id; p.seed = m.images[id].seed; touch(m); render(); toast(`Panel #${+el.dataset.i + 1} generado`, 'ok');
  }, 'Generando…');
};
ACT.genChapter = async el => {
  const m = cur(); const c = chapterById(m, Route.a);
  const approved = c.panels.map((p, i) => ({ p, i })).filter(x => x.p.approved);
  if (!approved.length) return toast('Primero aprueba los paneles que quieres mandar a Fal.ai (✔ Aprobar en cada panel, o “Aprobar todos”).', 'err');
  let todo = approved.filter(x => !x.p.imageId);
  if (!todo.length) { if (!await confirmBox('Todos los paneles aprobados ya tienen imagen. ¿Generarlos de nuevo? (las anteriores quedan en la Galería)', { ok: 'Regenerar aprobados', danger: false })) return; todo = approved; }
  const lines = []; const groups = {};
  todo.forEach(({ p }) => { const P = buildPanelPrompt(m, p); const k = P.width + '×' + P.height; (groups[k] ||= { n: 0, w: P.width, h: P.height }).n++; });
  Object.values(groups).forEach(g => lines.push(imgLine(g.n, g.w, g.h, `${plural(g.n, 'panel', 'paneles')} de ${g.w}×${g.h}`)));
  const pending = c.panels.length - approved.length;
  if (!await confirmCost(`Generar ${plural(todo.length, 'panel', 'paneles')} en Fal.ai`, lines, { extra: pending ? `${plural(pending, 'panel', 'paneles')} sin aprobar no se mandarán.` : '' })) return;
  const prev = c.status; c.status = 'Generando'; touch(m);
  const prog = () => $('#genProg');
  let done = 0, fail = 0; el.disabled = true;
  for (const { p, i } of todo) {
    if (Route.view === 'cap' && prog()) prog().innerHTML = `<div class="small muted">Generando panel ${i + 1}… (${done}/${todo.length})</div><div class="bar"><i style="width:${Math.round(100 * done / todo.length)}%"></i></div>`;
    try { const [id] = await falGenerate(m, buildPanelPrompt(m, p), 1, { panel: p.id, chapter: c.id }, { confirmed: true }); p.imageId = id; p.seed = m.images[id].seed; done++; touch(m); }
    catch (e) { fail++; toast(`Panel ${i + 1}: ${e.message}`, 'err'); if (/API key|Inicia sesión/.test(e.message)) break; }
  }
  c.status = prev === 'Generando' ? 'Borrador' : prev; touch(m);
  if (Route.view === 'cap') render();
  toast(`Listo: ${done} imágenes generadas${fail ? `, ${fail} fallaron` : ''}. Envíalas al armador.`, fail ? '' : 'ok');
};

/* ---------------- Laboratorio de LoRA ---------------- */
VIEWS.lora = () => {
  const m = cur();
  const ch = m.characters.find(c => c.id === Route.a) || null;
  if (!ch) return `<div class="head"><div><h1>🧪 Laboratorio de LoRA</h1><p class="muted">Crea el look de cada personaje escribiendo normal, corrige con tus palabras, y entrena su LoRA.</p></div><div class="row"><button data-a="dlLoras">⬇ Todos los LoRAs (Word)</button></div></div>
    ${m.characters.length ? `<div class="cards">${m.characters.map(c => `<div class="card hov ecard" data-a="go" data-to="${mlink(m, 'lora', c.id)}">${entThumb(m, 'personajes', c)}<div><h3>${esc(c.name)}</h3><div class="row" style="margin-top:6px">${c.visualPrompt ? '<span class="chip ok">Look guardado</span>' : '<span class="chip">Sin look</span>'}${c.loraId ? `<span class="chip neon">LoRA v${c.loraVersion || 1}</span>` : ''}${c.training && !['COMPLETED', 'FAILED'].includes(c.training.status) ? '<span class="chip warn">Entrenando…</span>' : ''}</div></div></div>`).join('')}</div>` : `<div class="empty">Primero crea un personaje en Universo → Personajes.</div>`}`;
  const lab = (ch.lab ||= { desc: ch.appearance ? `${ch.name}: ${ch.appearance}` : '', rounds: [], chosen: null });
  const upd = (ch.upd ||= { change: '', imgs: [], prompt: '', chosen: null });
  const tr = ch.training;
  const imgTile = (id, kind) => { const i = m.images[id]; if (!i) return ''; const chosen = kind === 'lab' ? lab.chosen === id : upd.chosen === id; return `<div class="ithumb ${chosen ? 'on' : ''}" data-a="${kind === 'lab' ? 'labPick' : 'updPick'}" data-id="${id}"><img data-img="${id}" alt=""><button class="heart sm" data-a="likeImg" data-id="${id}">${i.liked ? '♥' : '♡'}</button><div class="cap"><span>seed ${i.seed ?? '?'}</span>${chosen ? '<span class="chip ok">Elegida</span>' : ''}</div></div>`; };
  return `<div class="head"><div class="row nw">${entThumb(m, 'personajes', ch)}<div><h1>🧪 ${esc(ch.name)}</h1><p class="muted">Laboratorio de LoRA · ${ch.loraId ? `LoRA v${ch.loraVersion || 1} activo` : 'sin LoRA entrenado'}${ch.trigger ? ' · trigger <span class="kbd">' + esc(ch.trigger) + '</span>' : ''}</p></div></div>
    <div class="row"><button data-a="go" data-to="${mlink(m, 'lora')}">← Personajes</button><button data-a="go" data-to="${mlink(m, 'wiki', 'personajes', ch.id)}">Ver ficha</button>${ch.loraId ? `<button class="pri" data-a="dlLora" data-id="${ch.id}">⬇ Descargar LoRA</button>` : ''}<button data-a="dlCharImgs" data-id="${ch.id}">⬇ Imágenes</button></div></div>
    ${!S.user ? '<div class="alert warn" style="margin-bottom:14px">Inicia sesión y guarda tu API key de Fal.ai en Configuración para generar.</div>' : ''}

    <div class="sect panelbox"><h2>1 · Describe a tu personaje como quieras</h2>
      <textarea ${bindAttr(lab, 'desc')} placeholder="Quiero mi prota con pelo negro, lunar pequeño bajo el ojo derecho, ojos grises, chaqueta negra…">${esc(lab.desc)}</textarea>
      <div class="row"><button class="pri big" data-a="labStart">⚡ Generar 4 pruebas</button>${lab.rounds.length ? `<span class="small muted">${plural(lab.rounds.length, 'ronda', 'rondas')}</span>` : ''}</div>
    </div>
    ${lab.rounds.length ? `<div class="sect panelbox"><h2>2 · Elige y corrige</h2><div class="rounds">${[...lab.rounds].reverse().map((r, ri) => `<div class="round"><div class="small muted">Ronda ${lab.rounds.length - ri}${r.feedback ? ` · tu corrección: “${esc(r.feedback)}”` : ''}</div>${r.notes ? `<div class="tiny dim">IA: ${esc(r.notes)}</div>` : ''}<details><summary class="tiny dim" style="cursor:pointer">ver prompt</summary><div class="prompt">${esc(r.prompt)}</div></details><div class="igrid" style="margin-top:8px">${r.imgs.map(id => imgTile(id, 'lab')).join('')}</div></div>`).join('')}</div>
      <label class="f">¿Qué no te gustó? (dilo normal)<textarea id="labFb" placeholder="No me gustó su lunar, está muy grande. El cabello más largo."></textarea></label>
      <div class="row"><button class="pri" data-a="labFix">🔁 Corregir y generar 4 nuevas</button><button class="ok big" data-a="labSave" ${lab.chosen ? '' : 'disabled'}>💾 GUARDAR ESTE LORA</button></div>
      <p class="tiny dim">Guardar fija el prompt, la semilla y la configuración de la imagen elegida en la ficha del personaje; se usa en todos sus paneles.</p></div>` : ''}

    <div class="sect panelbox"><div class="row between"><h2>3 · Hoja de modelo</h2><button data-a="sheetAll" ${ch.visualPrompt ? '' : 'disabled'}>⚡ Generar hoja completa (${SHEET_SLOTS.length})</button></div>
      <p class="small muted">Frente, perfil, espalda y 8 expresiones. Toca un espacio para generarlo o subir tu propia imagen.</p>
      <div class="sheet">${SHEET_SLOTS.map(([k, l]) => `<div class="slot" ${ch.sheet?.[k] ? `data-img="${ch.sheet[k]}"` : ''} data-a="sheetSlot" data-k="${k}"><span>${l}</span></div>`).join('')}</div></div>

    <div class="sect panelbox"><h2>4 · ENTRENAR MI LORA V2 EN FAL.AI</h2>
      <p class="small muted">Sube 20-30 imágenes corregidas del personaje (variedad de ángulos, luz y ropa). Las mando a entrenar y actualizo el LoRA ID solo cuando termine.</p>
      <div class="grid2"><label class="f">Trigger word<input ${bindAttr(ch, 'trigger')} value="${esc(ch.trigger || '')}" placeholder="ej. kaelmh"></label><label class="f">Pasos de entrenamiento<input type="number" id="trSteps" value="${S.settings.trainSteps || 1000}"></label></div>
      ${tr ? `<div class="alert ${tr.status === 'COMPLETED' ? 'ok' : tr.status === 'FAILED' ? 'bad' : 'info'}">${tr.status === 'COMPLETED' ? `✔ Entrenamiento terminado (${fmtDate(tr.doneAt)}). LoRA v${ch.loraVersion || 1} activo.` : tr.status === 'FAILED' ? '✕ Falló: ' + esc(tr.error || '') : `⏳ Entrenando (${esc(tr.status)})${tr.queue != null ? ' · en cola: ' + tr.queue : ''} · empezó ${fmtDate(tr.startedAt)}. Puedes cerrar la app; reviso al volver.`}</div>` : ''}
      <div class="row"><button class="pri" data-a="trainPick">📤 Subir 20-30 imágenes y entrenar</button><button data-a="trainFav">♥ Usar favoritas + hoja de modelo</button>${tr && !['COMPLETED', 'FAILED'].includes(tr.status) ? '<button data-a="trainCheck">🔄 Revisar estado</button>' : ''}</div>
      <div class="grid2"><label class="f">LoRA ID / URL actual<input ${bindAttr(ch, 'loraId')} value="${esc(ch.loraId || '')}"></label><label class="f">Peso LoRA<input type="number" step="0.05" ${bindAttr(ch, 'loraWeight', { num: 1 })} value="${ch.loraWeight ?? 0.9}"></label></div>
    </div>

    <div class="sect panelbox"><h2>5 · ACTUALIZAR PERSONAJE</h2>
      <p class="small muted">¿Cambió algo? (quitar el lunar, nuevo corte de pelo, cicatriz nueva…). Genero pruebas, eliges y actualizo la ficha.</p>
      <textarea ${bindAttr(upd, 'change')} placeholder="Quitar el lunar y ponerle una cicatriz en la mejilla izquierda">${esc(upd.change)}</textarea>
      <div class="row"><button class="pri" data-a="updGen" ${ch.visualPrompt || ch.appearance ? '' : 'disabled'}>⚡ Generar pruebas</button>${upd.chosen ? '<button class="ok" data-a="updApply">✔ ACTUALIZAR PERSONAJE</button>' : ''}</div>
      ${upd.imgs.length ? `<div class="igrid">${upd.imgs.map(id => imgTile(id, 'upd')).join('')}</div>` : ''}
    </div>

    ${(ch.savedImages || []).length ? `<div class="sect panelbox"><h2>♥ Semillas guardadas</h2><div class="scrollx"><table class="t"><tr><th>Imagen</th><th>Semilla</th><th>Configuración</th></tr>${ch.savedImages.map(s => `<tr><td><div class="thumb" data-img="${s.imgId}"></div></td><td class="mono">${s.seed}</td><td class="tiny mono">${esc(JSON.stringify(s.settings || {}))}</td></tr>`).join('')}</table></div></div>` : ''}`;
};
function labChar() { const m = cur(); return m.characters.find(c => c.id === Route.a); }
async function labPrompt(m, ch, desc, prev, feedback) {
  const r = await aiJSON(`Eres experto en prompts para modelos de imagen (FLUX / Stable Diffusion) estilo manhwa coreano.
Convierte la descripción del autor en un prompt en INGLÉS para una hoja de diseño de personaje (character reference, upper body, plain light gray background, consistent design).
Personaje: ${ch.name}. Datos: ${ch.appearance || ''} ${ch.age ? '(' + ch.age + ' años)' : ''}
Descripción del autor: ${desc}
${prev ? `Prompt anterior: ${prev}\nCorrección del autor (aplícala con precisión, por ejemplo "lunar muy grande" → "tiny small mole"): ${feedback}` : ''}
Incluye el trigger word "${ch.trigger || ''}" al inicio si existe. Sé específico en rasgos (cabello, ojos, marcas, ropa, lado izquierdo/derecho).
Formato: {"prompt":"…","notes":"qué cambiaste, en español, 1 frase"}`, { max_tokens: 800, temperature: 0.4, confirmed: true, title: 'Prompt del personaje' });
  return r;
}
async function labRun(el, feedback) {
  const m = cur(); const ch = labChar(); const lab = ch.lab;
  if (!lab.desc.trim()) return toast('Describe primero a tu personaje', 'err');
  if (!await confirmCost(feedback ? 'Corregir y generar 4 nuevas' : 'Generar 4 pruebas', [aiLine(2500, 300, 800, 'Convertir tu descripción en prompt'), imgLine(4, 768, 1024)])) return;
  await busy(el, async () => {
    const last = lab.rounds[lab.rounds.length - 1];
    const p = await labPrompt(m, ch, lab.desc, feedback ? last?.prompt : null, feedback);
    const prompt = [m.bible.style.prefix, p.prompt].filter(Boolean).join(', ');
    const loras = ch.loraId ? [{ path: ch.loraId, scale: Number(ch.loraWeight) || 0.9 }] : [];
    const ids = await falGenerate(m, { prompt, negative: m.bible.style.negative, loras, width: 768, height: 1024 }, 4, { character: ch.id, lab: true }, { confirmed: true });
    lab.rounds.push({ id: uid('r_'), prompt, feedback: feedback || '', notes: p.notes || '', imgs: ids, at: Date.now() });
    lab.chosen = null; touch(m); render();
  }, 'Generando 4…');
}
ACT.labStart = el => labRun(el, null);
ACT.labFix = el => { const fb = $('#labFb').value.trim(); if (!fb) return toast('Escribe qué quieres corregir', 'err'); labRun(el, fb); };
ACT.labPick = (el, e) => { if (e?.target.closest('.heart')) return; const m = cur(); const ch = labChar(); ch.lab.chosen = el.dataset.id; touch(m); render(); };
ACT.labSave = () => {
  const m = cur(); const ch = labChar(); const img = m.images[ch.lab.chosen]; const round = ch.lab.rounds.find(r => r.imgs.includes(ch.lab.chosen));
  ch.visualPrompt = round.prompt.replace(m.bible.style.prefix + ', ', ''); ch.visualSeed = img.seed; ch.visualSettings = img.settings; ch.imageId = ch.lab.chosen;
  ch.savedImages ||= []; if (!ch.savedImages.some(s => s.imgId === img.id)) ch.savedImages.push({ imgId: img.id, seed: img.seed, prompt: img.prompt, settings: img.settings });
  img.liked = true; (ch.history ||= []).push({ at: Date.now(), change: 'Look guardado en el Laboratorio LoRA (semilla ' + img.seed + ')' });
  touch(m); render(); toast(`Look de ${ch.name} guardado: prompt, semilla ${img.seed} y configuración ✔`, 'ok');
};
// ♥ también guarda la semilla en el personaje si estamos en el laboratorio
const _like = ACT.likeImg;
ACT.likeImg = el => { _like(el); const m = cur(); const ch = Route.view === 'lora' ? labChar() : null; const i = m.images[el.dataset.id]; if (ch && i) { ch.savedImages ||= []; if (i.liked && !ch.savedImages.some(s => s.imgId === i.id)) ch.savedImages.push({ imgId: i.id, seed: i.seed, prompt: i.prompt, settings: i.settings }); if (!i.liked) ch.savedImages = ch.savedImages.filter(s => s.imgId !== i.id); touch(m); } };

/* Hoja de modelo */
async function sheetGen(m, ch, k, confirmed = false) {
  const slot = SHEET_SLOTS.find(s => s[0] === k);
  const base = ch.visualPrompt || ch.appearance || ch.name;
  const loras = ch.loraId ? [{ path: ch.loraId, scale: Number(ch.loraWeight) || 0.9 }] : [];
  const prompt = [m.bible.style.prefix, 'character model sheet', base, slot[2], 'plain light gray background'].filter(Boolean).join(', ');
  const [id] = await falGenerate(m, { prompt, negative: m.bible.style.negative, loras, width: 768, height: 1024, seed: ch.visualSeed ?? undefined }, 1, { character: ch.id, sheet: k }, { confirmed, title: 'Hoja de modelo: ' + slot[1] });
  (ch.sheet ||= {})[k] = id; touch(m);
}
ACT.sheetSlot = async el => {
  const m = cur(); const ch = labChar(); const k = el.dataset.k;
  const r = await choiceBox(SHEET_SLOTS.find(s => s[0] === k)[1], '¿Generar con Fal.ai o subir tu propia imagen?', [{ label: '📤 Subir', value: 'up' }, ...(ch.sheet?.[k] ? [{ label: '🗑️ Quitar', value: 'del', cls: 'danger' }] : []), { label: '⚡ Generar', value: 'gen', cls: 'pri' }]);
  if (r === 'up') { const [f] = await pickFiles({ multiple: false }); if (!f) return; (ch.sheet ||= {})[k] = await addImage(m, f, { source: 'subida', character: ch.id, sheet: k }); touch(m); render(); }
  if (r === 'del') { ch.sheet[k] = null; touch(m); render(); }
  if (r === 'gen') { el.innerHTML = '<span class="spin"></span>'; try { await sheetGen(m, ch, k); } catch (e) { if (e.message !== 'Cancelado') toast(e.message, 'err'); } render(); }
};
ACT.sheetAll = async el => {
  const m = cur(); const ch = labChar();
  if (!await confirmCost('Hoja de modelo completa', [imgLine(SHEET_SLOTS.length, 768, 1024, `${SHEET_SLOTS.length} vistas y expresiones (768×1024)`)])) return;
  await busy(el, async () => { let n = 0; for (const [k] of SHEET_SLOTS) { el.innerHTML = `<span class="spin"></span> ${++n}/${SHEET_SLOTS.length}`; try { await sheetGen(m, ch, k, true); } catch (e) { toast(e.message, 'err'); if (/API key|sesión/.test(e.message)) break; } } render(); toast('Hoja de modelo lista', 'ok'); }, 'Generando…');
};

/* Entrenamiento LoRA v2 */
async function startTraining(m, ch, blobs) {
  if (!S.user) throw new Error('Inicia sesión para entrenar.');
  if (blobs.length < 10) throw new Error(`Solo hay ${blobs.length} imágenes. Usa al menos 10 (ideal 20-30).`);
  if (!ch.trigger) ch.trigger = norm(ch.name).replace(/\s/g, '') + 'mh';
  const steps = Number($('#trSteps')?.value) || S.settings.trainSteps || 1000;
  if (!await confirmCost('Entrenar LoRA en Fal.ai', [{ label: `Entrenamiento de ${ch.name} · ${blobs.length} imágenes · ${steps} pasos`, cost: costTrain(steps), note: `${money(falUnit(S.settings.trainApp || 'fal-ai/flux-lora-fast-training'))} por cada 1000 pasos` }])) throw new Error('Cancelado');
  const zip = new JSZip(); const cap = `${ch.trigger}, ${ch.visualPrompt || ch.appearance || ch.name}`;
  blobs.forEach((b, i) => { const n = String(i + 1).padStart(3, '0'); zip.file(`${n}.${(b.type || '').includes('png') ? 'png' : 'jpg'}`, b); zip.file(`${n}.txt`, cap); });
  const zb = await zip.generateAsync({ type: 'blob' });
  const path = `${S.user.id}/${m.id}/datasets/${ch.id}_${Date.now()}.zip`;
  const up = await sb.storage.from('studio').upload(path, zb, { contentType: 'application/zip' }); if (up.error) throw up.error;
  const { data: sg, error } = await sb.storage.from('studio').createSignedUrl(path, 60 * 60 * 24); if (error) throw error;
  const app = S.settings.trainApp || 'fal-ai/flux-lora-fast-training';
  const r = await callFn('falSubmit', { app, input: { images_data_url: sg.signedUrl, trigger_word: ch.trigger, steps, create_masks: true } });
  addSpend(costTrain(steps));
  ch.training = { request_id: r.request_id, status_url: r.status_url, response_url: r.response_url, status: 'IN_QUEUE', startedAt: Date.now(), app, n: blobs.length, dataset: path };
  (ch.history ||= []).push({ at: Date.now(), change: `Entrenamiento LoRA v${(ch.loraVersion || 0) + 1} enviado con ${blobs.length} imágenes` });
  touch(m); S.settings.trainSteps = steps; saveSettings();
  toast('Entrenamiento enviado a Fal.ai ⏳ Te aviso cuando termine.', 'ok');
  pollTraining(m.id, ch.id);
}
ACT.trainPick = async el => {
  const m = cur(); const ch = labChar(); const fs = await pickFiles(); if (!fs.length) return;
  if (fs.length < 20 && !await confirmBox(`Elegiste ${fs.length} imágenes. Lo recomendable son 20-30 para un buen LoRA. ¿Entrenar igual?`, { ok: 'Entrenar igual', danger: false })) return;
  await busy(el, async () => { const blobs = []; for (const f of fs) blobs.push((await blobFromFile(f, 1024)).blob); await startTraining(m, ch, blobs); render(); }, 'Subiendo…');
};
ACT.trainFav = async el => {
  const m = cur(); const ch = labChar();
  const ids = [...new Set([...(ch.savedImages || []).map(s => s.imgId), ...Object.values(ch.sheet || {}).filter(Boolean), ...Object.values(m.images).filter(i => i.liked && i.character === ch.id).map(i => i.id)])];
  if (!ids.length) return toast('No hay favoritas ni hoja de modelo todavía', 'err');
  if (!await confirmBox(`Encontré ${ids.length} imágenes (favoritas + hoja de modelo). ${ids.length < 20 ? 'Lo ideal son 20-30. ' : ''}¿Entrenar con ellas?`, { ok: 'Entrenar', danger: false })) return;
  await busy(el, async () => { const blobs = []; for (const id of ids) { const b = await getImageBlob(m, id); if (b) blobs.push(b); } await startTraining(m, ch, blobs); render(); }, 'Preparando…');
};
const polling = new Set();
async function pollTraining(mid, cid) {
  const key = mid + cid; if (polling.has(key)) return; polling.add(key);
  try {
    while (true) {
      const m = S.manhwas[mid]; const ch = m?.characters.find(c => c.id === cid); const tr = ch?.training;
      if (!tr || ['COMPLETED', 'FAILED'].includes(tr.status) || !S.user) break;
      try {
        const st = await callFn('falStatus', { status_url: tr.status_url });
        tr.status = st.status || tr.status; tr.queue = st.queue_position ?? null;
        if (st.status === 'COMPLETED') {
          const res = await callFn('falResult', { response_url: tr.response_url });
          const url = res.diffusers_lora_file?.url;
          if (!url) { tr.status = 'FAILED'; tr.error = res.error || 'Sin archivo LoRA'; }
          else { ch.loraId = url; ch.loraVersion = (ch.loraVersion || 0) + 1; tr.doneAt = Date.now(); tr.lora = url; (ch.history ||= []).push({ at: Date.now(), change: `LoRA v${ch.loraVersion} entrenado y activado automáticamente` }); toast(`🎉 LoRA v${ch.loraVersion} de ${ch.name} listo y conectado`, 'ok'); if (S.user && tr.dataset) sb.storage.from('studio').remove([tr.dataset]).catch(() => { }); }
          touch(m); if (Route.view === 'lora') render(); break;
        }
        touch(m); if (Route.view === 'lora' && Route.a === cid) render();
      } catch (e) { if (/no válida|desconocida/.test(e.message)) { tr.status = 'FAILED'; tr.error = e.message; touch(m); break; } }
      await sleep(20000);
    }
  } finally { polling.delete(key); }
}
ACT.trainCheck = () => { const m = cur(); const ch = labChar(); polling.delete(m.id + ch.id); pollTraining(m.id, ch.id); toast('Revisando…'); };
function resumeTrainings() { for (const m of Object.values(S.manhwas)) for (const ch of m.characters || []) if (ch.training && !['COMPLETED', 'FAILED'].includes(ch.training.status)) pollTraining(m.id, ch.id); }

/* Actualizar personaje */
ACT.updGen = async el => {
  const m = cur(); const ch = labChar(); const upd = ch.upd;
  if (!upd.change.trim()) return toast('Escribe qué cambió', 'err');
  if (!await confirmCost('Actualizar personaje', [aiLine(1500, 400, 800, 'Aplicar tu cambio al prompt'), imgLine(4, 768, 1024)])) return;
  await busy(el, async () => {
    const base = ch.visualPrompt || ch.appearance;
    const r = await aiJSON(`Prompt actual del personaje ${ch.name} (inglés): ${base}\nCambio pedido por el autor: ${upd.change}\nDevuelve el prompt actualizado aplicando EXACTAMENTE el cambio (y quitando lo que ya no va). También la nueva descripción en español para la ficha.\nFormato: {"prompt":"…","appearance_es":"…"}`, { max_tokens: 800, temperature: 0.3, confirmed: true, title: 'Actualizar personaje' });
    upd.prompt = r.prompt; upd.appearance = r.appearance_es;
    const loras = ch.loraId ? [{ path: ch.loraId, scale: Number(ch.loraWeight) || 0.9 }] : [];
    upd.imgs = await falGenerate(m, { prompt: [m.bible.style.prefix, ch.trigger, r.prompt].filter(Boolean).join(', '), negative: m.bible.style.negative, loras, width: 768, height: 1024 }, 4, { character: ch.id, update: true }, { confirmed: true });
    upd.chosen = null; touch(m); render();
  }, 'Generando…');
};
ACT.updPick = (el, e) => { if (e?.target.closest('.heart')) return; const m = cur(); const ch = labChar(); ch.upd.chosen = el.dataset.id; touch(m); render(); };
ACT.updApply = async () => {
  const m = cur(); const ch = labChar(); const upd = ch.upd; const img = m.images[upd.chosen];
  ch.visualPrompt = upd.prompt; ch.appearance = upd.appearance || ch.appearance; ch.visualSeed = img.seed; ch.visualSettings = img.settings; ch.imageId = img.id;
  (ch.history ||= []).push({ at: Date.now(), change: 'Actualizado: ' + upd.change });
  const nextCap = ((lastChapter(m)?.number) || 0) + 1;
  if (await confirmBox(`¿Agregar una ficha canon para recordar este cambio desde el Cap ${nextCap}?`, { ok: 'Sí, agregar', danger: false, title: '📌 Ficha canon' })) m.canon.push({ id: uid('k_'), entity: ch.name, attribute: 'cambio de apariencia', value: upd.change, since: nextCap, note: '' });
  ch.upd = { change: '', imgs: [], prompt: '', chosen: null };
  touch(m); render(); toast(`Ficha de ${ch.name} actualizada ✔`, 'ok');
};

/* Portada en 1 clic con Fal.ai */
ACT.coverGen = async el => {
  const m = cur(); const ch = m.characters.find(c => c.id === m.bible.protagonistId) || m.characters[0];
  await busy(el, async () => {
    const loras = ch?.loraId ? [{ path: ch.loraId, scale: Number(ch.loraWeight) || 0.9 }] : [];
    const prompt = [m.bible.style.prefix, 'epic manhwa cover art', ch && [ch.trigger, ch.visualPrompt || ch.appearance].filter(Boolean).join(' '), 'heroic epic dynamic pose, dramatic lighting, glowing aura, wind, detailed background, cinematic composition, empty space at the bottom for the title'].filter(Boolean).join(', ');
    const ids = await falGenerate(m, { prompt, negative: m.bible.style.negative + ', text, letters, logo', loras, width: 1080, height: 1920 }, 1, { cover: true }, { title: 'Portada épica (1080×1920)' });
    m.covers.img = ids[0]; touch(m); render(); toast('Portada generada ✨', 'ok');
  }, 'Generando portada…');
};
