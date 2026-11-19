/* =====================================================================
   📎 IMÁGENES DE REFERENCIA
   - En el Laboratorio: sube cómo quieres que se vea tu personaje
     (dibujo, foto, boceto) y sale mucho más parecido desde la 1ª vez.
   - En cada panel: referencia de pose, fondo o estilo, y "✏️ Corregir
     esta imagen" para cambiar algo sin dibujar desde cero.
   Usar referencias NO cuesta más: cada trabajador cobra lo mismo.
   ===================================================================== */
const REF_ROLES = {
  personaje: ['🧍 Cómo se ve el personaje', 'Use reference image #N as the exact design of the character: same face, hair, eyes, body, outfit and colors.'],
  pose: ['🤸 Pose y encuadre', 'Use reference image #N only for the pose, body position, camera angle and composition (not for the face or style).'],
  fondo: ['🏞️ Fondo o lugar', 'Use reference image #N as the background / location (same place, adapted to the art style).'],
  estilo: ['🎨 Estilo de dibujo', 'Match the art style, line work, coloring and lighting of reference image #N.'],
  editar: ['✏️ Base para corregir', 'Keep reference image #N exactly the same (same character, composition, colors and style) and change ONLY what the instruction asks.']
};
/* imagen → texto data: URI chico (≤1024px) para mandarla a Fal.ai */
async function refDataURI(m, id) {
  const b = await getImageBlob(m, id); if (!b) return null;
  let bmp; try { bmp = await createImageBitmap(b); } catch (e) { return null; }
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.max(256, Math.round(bmp.width * k)); c.height = Math.max(256, Math.round(bmp.height * k));
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
async function refsPrepare(m, refs) {
  const ok = []; for (const r of (refs || []).slice(0, 6)) { const u = await refDataURI(m, r.id); if (u) ok.push({ ...r, url: u }); }
  const text = ok.map((r, i) => (REF_ROLES[r.role] || REF_ROLES.personaje)[1].replace('#N', '#' + (i + 1)) + (r.note ? ` (${r.note})` : '')).join(' ');
  return { urls: ok.map(r => r.url), text };
}
/* miniaturas + botón de agregar */
function refsHTML(m, list, scope, extra = '') {
  return `<div class="refs">${(list || []).map((r, i) => `<div class="refbox"><div class="ithumb sm" data-img="${r.id}"></div><select data-a="refRole" data-scope="${scope}" data-i="${i}" title="¿Para qué es esta imagen?">${Object.entries(REF_ROLES).filter(([k]) => k !== 'editar' || r.role === 'editar').map(([k, [l]]) => `<option value="${k}" ${r.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="sm icon ghost" data-a="refDel" data-scope="${scope}" data-i="${i}" title="Quitar">✕</button></div>`).join('')}
    <button class="sm" data-a="refAdd" data-scope="${scope}">📎 ${list?.length ? 'Otra imagen' : 'Agregar imagen de referencia'}</button>${extra}</div>`;
}
function refList(scope) {
  const m = cur(); const [kind, a, b] = scope.split(':');
  if (kind === 'lab') { const ch = labChar(); ch.lab.refs ||= []; return ch.lab.refs; }
  if (kind === 'pan') { const c = chapterById(m, a); const p = c?.panels.find(x => x.id === b); if (!p) return []; p.refs ||= []; return p.refs; }
  return [];
}
ACT.refAdd = async el => {
  const m = cur(); const list = refList(el.dataset.scope); if (list.length >= 6) return toast('Máximo 6 imágenes de referencia', 'err');
  const files = await pickFiles({ multiple: true, accept: 'image/*' }); if (!files?.length) return;
  for (const f of files.slice(0, 6 - list.length)) { const id = await addImage(m, f, { source: 'referencia' }); list.push({ id, role: el.dataset.scope.startsWith('lab') ? 'personaje' : 'pose' }); }
  touch(m); render(); toast('📎 Referencia agregada. Elige para qué es (personaje, pose, fondo o estilo).', 'ok');
};
ACT.refDel = el => { const m = cur(); const list = refList(el.dataset.scope); list.splice(+el.dataset.i, 1); touch(m); render(); };
ACT.refRole = el => { const m = cur(); const list = refList(el.dataset.scope); const r = list[+el.dataset.i]; if (r) { r.role = el.value; touch(m); } };
/* ✏️ corregir la imagen de un panel sin dibujarlo de nuevo */
ACT.panelFixImg = async el => {
  const m = cur(); const c = chapterById(m, Route.a); const p = c.panels[+el.dataset.i]; if (!p?.imageId) return;
  const what = await promptBox('✏️ Corregir esta imagen', '', { label: 'Dime qué cambiar y lo demás se queda igual. Ej. “que Elías mire hacia la izquierda”, “quítale la capa”, “que sea de noche”', multiline: true, ok: 'Corregir' });
  if (!what) return;
  const P = panelReq(m, p);
  const extraRefs = (p.refs || []).filter(r => r.id !== p.imageId);
  try {
    const [id] = await falGenerate(m, { ...P, prompt: `${what}. ${P.prompt}`, refs: [{ id: p.imageId, role: 'editar' }, ...extraRefs], noun: ['corrección', 'correcciones'] }, 1, { panel: p.id, chapter: c.id, fixOf: p.imageId }, { title: 'Corregir panel ' + (+el.dataset.i + 1) });
    if (id) { (p.oldImages ||= []).push(p.imageId); p.imageId = id; touch(m); render(); toast('✏️ Panel corregido. La imagen anterior quedó en la Galería.', 'ok'); }
  } catch (e) { if (e.message !== 'Cancelado') toast(e.message, 'err'); }
};
