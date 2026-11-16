/* =====================================================================
   DESCARGAS: biblia en Word siempre actualizada, cada cosa por separado
   (personaje, lugar, poder, sección, capítulo, imagen, LoRA, video) y
   un paquete con TODO (Word + imágenes + videos + audios + LoRAs + datos).
   ===================================================================== */
const DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.iife.js';
async function docxLib() { if (!window.docx) await loadScript(DOCX_URL); if (!window.docx) throw new Error('No pude cargar el creador de Word. Revisa tu internet.'); return window.docx; }
const fileSafe = s => String(s || 'archivo').replace(/[\\/:*?"<>|#%]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'archivo';
const extOf = b => (b?.type || '').includes('png') ? 'png' : (b?.type || '').includes('webp') ? 'webp' : (b?.type || '').includes('gif') ? 'gif' : 'jpg';
/* imagen lista para Word (JPEG, máx 520px) */
async function docImage(m, id, maxW = 520, maxH = 620) {
  const b = await getImageBlob(m, id); if (!b) return null;
  let bmp; try { bmp = await createImageBitmap(b); } catch (e) { return null; }
  const k = Math.min(1, maxW / bmp.width, maxH / bmp.height); const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w * 2 > bmp.width ? bmp.width : w * 2; c.height = Math.round(c.width * bmp.height / bmp.width);
  const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  const jb = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  return { data: await jb.arrayBuffer(), w, h };
}
/* ---------- piezas del documento ---------- */
function D() {
  const X = window.docx;
  const P = (text, o = {}) => new X.Paragraph({ spacing: { after: 120 }, ...o, children: [new X.TextRun({ text: String(text ?? ''), ...(o.run || {}) })] });
  const lines = (text, o) => String(text ?? '').split('\n').map(t => P(t, o));
  const H = (text, level = 1) => new X.Paragraph({ heading: [X.HeadingLevel.HEADING_1, X.HeadingLevel.HEADING_1, X.HeadingLevel.HEADING_2, X.HeadingLevel.HEADING_3][level], spacing: { before: level === 1 ? 360 : 220, after: 120 }, children: [new X.TextRun({ text: String(text), color: level === 1 ? '6B21A8' : '3B0764' })] });
  const KV = rows => { rows = rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''); if (!rows.length) return []; return [new X.Table({ width: { size: 100, type: X.WidthType.PERCENTAGE }, rows: rows.map(([k, v]) => new X.TableRow({ children: [new X.TableCell({ width: { size: 28, type: X.WidthType.PERCENTAGE }, shading: { type: X.ShadingType.CLEAR, fill: 'EFE7FF', color: 'auto' }, children: [new X.Paragraph({ children: [new X.TextRun({ text: String(k), bold: true })] })] }), new X.TableCell({ width: { size: 72, type: X.WidthType.PERCENTAGE }, children: lines(v, { spacing: { after: 40 } }) })] })) }), P('')]; };
  const IMG = (im, caption) => im ? [new X.Paragraph({ alignment: X.AlignmentType.CENTER, children: [new X.ImageRun({ data: im.data, transformation: { width: im.w, height: im.h } })] }), ...(caption ? [P(caption, { alignment: X.AlignmentType.CENTER, run: { italics: true, size: 18, color: '666666' } })] : [])] : [];
  const BR = () => new X.Paragraph({ children: [new X.PageBreak()] });
  return { X, P, lines, H, KV, IMG, BR };
}
async function makeDocx(title, children) {
  const X = await docxLib();
  const doc = new X.Document({ creator: 'MI MANHWA STUDIO', title, styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } }, sections: [{ properties: {}, children }] });
  return X.Packer.toBlob(doc);
}
const nameOf = (m, id) => findEntity(m, id)?.name || '?';
async function charBlocks(m, c, { images = true, level = 2 } = {}) {
  const { P, H, KV, IMG } = D(); const out = [H(c.name + (c.nickname ? ` “${c.nickname}”` : ''), level)];
  if (images && (c.imageId || c.sheet?.front)) out.push(...IMG(await docImage(m, c.imageId || c.sheet.front, 300, 380), 'Imagen de referencia'));
  out.push(...KV([['Edad', c.age], ['Qué hace / rol', c.role], ['Estado', c.status], ['Poder', c.power], ['Debilidad', c.weakness], ['Trauma', c.trauma], ['Objetivo', c.goal], ['Apariencia', c.appearance], ['Evolución', c.evolution],
    ['Relaciones', (c.relations || []).map(r => `${r.kind} de ${nameOf(m, r.target)}${r.note ? ' (' + r.note + ')' : ''}`).join('\n')], ['Notas', c.notes]]));
  if (c.trigger || c.loraId || c.visualPrompt) { out.push(P('LoRA y look', { run: { bold: true, color: '6B21A8' } })); out.push(...KV([['Trigger word', c.trigger], ['LoRA ID / URL', c.loraId], ['Peso LoRA', c.loraWeight], ['Versión LoRA', c.loraVersion ? 'v' + c.loraVersion : ''], ['Prompt del look', c.visualPrompt], ['Semilla del look', c.visualSeed]])); }
  if (images && c.sheet && Object.values(c.sheet).some(Boolean)) {
    out.push(P('Hoja de modelo', { run: { bold: true, color: '6B21A8' } }));
    for (const [k, l] of SHEET_SLOTS) if (c.sheet[k]) out.push(...IMG(await docImage(m, c.sheet[k], 200, 260), l));
  }
  const canon = m.canon.filter(f => norm(f.entity) === norm(c.name)); if (canon.length) { out.push(P('Fichas canon', { run: { bold: true, color: '6B21A8' } })); out.push(...canon.map(f => P(`• ${f.attribute}: ${f.value}${f.since ? ' (desde Cap ' + f.since + ')' : ''}`))); }
  if ((c.history || []).length) { out.push(P('Cambios', { run: { bold: true, color: '6B21A8' } })); out.push(...c.history.map(h => P(`• ${fmtDate(h.at)} — ${h.change}`))); }
  return out;
}
async function entBlocks(m, t, e, { images = true, level = 2 } = {}) {
  if (t === 'personajes') return charBlocks(m, e, { images, level });
  const { H, KV, IMG } = D(); const T = TYPES[t]; const out = [H(e.name, level)];
  if (images && e.imageId) out.push(...IMG(await docImage(m, e.imageId, 420, 300)));
  out.push(...KV([...T.fields.filter(([k]) => k !== 'name').map(([k, l]) => [l, e[k]]), ['Conexiones', (e.relations || []).map(r => `${r.kind} → ${nameOf(m, r.target)}`).join('\n')]]));
  return out;
}
async function sectionBlocks(m, t, { images = true } = {}) {
  const { H, P } = D(); const T = TYPES[t]; let arr = [...(m[T.key] || [])];
  if (t === 'historia') arr.sort((a, b) => (a.order || 0) - (b.order || 0)); else arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const out = [H(`${T.label}`, 1)]; if (!arr.length) out.push(P('(vacío)'));
  for (const e of arr) out.push(...await entBlocks(m, t, e, { images }));
  return out;
}
function canonBlocks(m) { const { H, KV } = D(); const out = [H('Fichas canon', 1)]; const by = {}; m.canon.forEach(f => (by[f.entity || '—'] ||= []).push(f)); for (const [ent, fs] of Object.entries(by)) { out.push(H(ent, 3)); out.push(...KV(fs.map(f => [f.attribute || '—', `${f.value}${f.since ? '  (desde Cap ' + f.since + ')' : ''}${f.note ? '  — ' + f.note : ''}`]))); } return out; }
function bibleBlocks(m) { const { H, KV } = D(); const b = m.bible; return [H('Historia', 1), ...KV([['Género', b.genre], ['Tono', b.tone], ['Sinopsis', b.synopsis], ['Trama completa', b.plot], ['Reglas del mundo', b.rules], ['Otros apuntes', b.extras], ['Protagonista', b.protagonistId ? nameOf(m, b.protagonistId) : '']]), H('Estilo de imágenes', 2), ...KV([['Modelo', b.style.model], ['Pasos', b.style.steps], ['CFG', b.style.cfg], ['Tamaño', `${b.style.width}×${b.style.height}`], ['Prompt de estilo', b.style.prefix], ['Prompt negativo', b.style.negative]])]; }
async function chapterBlocks(m, c, { script = true, images = false } = {}) {
  const { H, P, KV, IMG } = D(); const out = [H(`Capítulo ${c.number}${c.title ? ': ' + c.title : ''}`, 1), ...KV([['Estado', c.status], ['Premisa', c.premise], ['Resumen', c.summary]])];
  if (script && c.panels?.length) {
    out.push(H('Guion', 2));
    for (const [i, p] of c.panels.entries()) {
      out.push(P(`Panel ${i + 1}  ·  ${SIZES[p.size] || p.size}${p.shot ? '  ·  ' + p.shot : ''}`, { run: { bold: true, color: '6B21A8' } }));
      if (images && p.imageId) out.push(...IMG(await docImage(m, p.imageId, 300, 380)));
      if (p.description) out.push(P(p.description));
      if (p.characters?.length) out.push(P('Personajes: ' + p.characters.join(', '), { run: { italics: true, color: '555555' } }));
      for (const d of p.dialogues || []) out.push(P(`${d.who || '—'}${d.type && d.type !== 'normal' ? ' (' + (DTYPES[d.type] || d.type).toLowerCase() + ')' : ''}: ${d.text}${d.en ? '\n   EN: ' + d.en : ''}${d.ko ? '\n   KO: ' + d.ko : ''}`));
      if (p.sfx?.length) out.push(P('SFX: ' + p.sfx.join(', '), { run: { bold: true } }));
    }
    const ch = c.cliffhangers?.[c.chosenCliff]; if (ch) out.push(H('Final elegido', 3), P(`${ch.title}: ${ch.description}`));
  }
  if (c.novel) { out.push(H('Versión novela', 2)); out.push(...c.novel.split(/\n+/).map(t => P(t))); }
  return out;
}
function lorasBlocks(m) {
  const { H, P, KV } = D(); const cs = m.characters.filter(c => c.loraId || c.trigger || c.visualPrompt || (c.savedImages || []).length);
  const out = [H('LoRAs y looks de personajes', 1)]; if (!cs.length) out.push(P('Aún no hay LoRAs ni looks guardados.'));
  for (const c of cs) { out.push(H(c.name, 2)); out.push(...KV([['Trigger word', c.trigger], ['LoRA ID / URL', c.loraId], ['Peso', c.loraWeight], ['Versión', c.loraVersion ? 'v' + c.loraVersion : ''], ['Entrenamiento', c.training ? `${c.training.status}${c.training.n ? ' · ' + c.training.n + ' imágenes' : ''}` : ''], ['Prompt del look', c.visualPrompt], ['Semilla del look', c.visualSeed], ['Configuración', c.visualSettings ? JSON.stringify(c.visualSettings) : ''], ['Semillas favoritas', (c.savedImages || []).map(s => `seed ${s.seed}`).join(', ')]])); }
  return out;
}
function coverBlocks(m, title) { const { X, P } = D(); return [new X.Paragraph({ alignment: X.AlignmentType.CENTER, spacing: { before: 2400, after: 240 }, children: [new X.TextRun({ text: m.name, bold: true, size: 64, color: '6B21A8' })] }), P(title, { alignment: X.AlignmentType.CENTER, run: { size: 32 } }), P(`Actualizado: ${new Date().toLocaleString('es-MX')}`, { alignment: X.AlignmentType.CENTER, run: { color: '777777' } }), P('Hecho con MI MANHWA STUDIO', { alignment: X.AlignmentType.CENTER, run: { color: '999999', size: 18 } })]; }
async function fullBibleBlob(m, { images = true } = {}) {
  await docxLib(); const { BR } = D();
  const ch = [...coverBlocks(m, 'Biblia del manhwa'), BR(), ...bibleBlocks(m)];
  for (const t of Object.keys(TYPES)) { ch.push(BR(), ...await sectionBlocks(m, t, { images })); }
  ch.push(BR(), ...canonBlocks(m), BR(), ...lorasBlocks(m));
  const caps = chapterList(m); if (caps.length) { const { H, KV } = D(); ch.push(BR(), H('Capítulos', 1), ...KV(caps.map(c => [`Cap ${c.number}`, `${c.title || ''} — ${c.status}\n${c.summary || c.premise || ''}`]))); }
  return makeDocx(`Biblia - ${m.name}`, ch);
}
/* ---------- acciones: generales ---------- */
ACT.dlBible = async el => { const m = cur(); await busy(el, async () => { const b = await fullBibleBlob(m); downloadBlob(b, `Biblia - ${fileSafe(m.name)}.docx`); toast('Biblia descargada en Word ✔', 'ok'); }, 'Creando Word…'); };
ACT.dlAll = async el => {
  const m = cur();
  const vids = Object.values(m.media || {}).filter(x => x.type === 'video'); const vsize = vids.reduce((a, x) => a + (x.size || 0), 0);
  if (vsize > 300e6 && !await confirmBox(`Tus videos pesan ${(vsize / 1e6).toFixed(0)} MB. El paquete va a ser grande y puede tardar. ¿Continuar?`, { ok: 'Descargar todo', danger: false })) return;
  await busy(el, async () => {
    const z = new JSZip(); const used = new Set(); let n = 0;
    const put = async (path, id) => { const b = await getImageBlob(m, id); if (!b) return; z.file(`${path}.${extOf(b)}`, b, { binary: true }); used.add(id); n++; if (n % 5 === 0) el.innerHTML = `<span class="spin"></span> ${n} archivos…`; };
    el.innerHTML = '<span class="spin"></span> Creando Word…'; z.file(`Biblia - ${fileSafe(m.name)}.docx`, await fullBibleBlob(m));
    for (const c of m.characters) { const base = `imagenes/personajes/${fileSafe(c.name)}`; if (c.imageId) await put(`${base}/referencia`, c.imageId); for (const [k, l] of SHEET_SLOTS) if (c.sheet?.[k]) await put(`${base}/hoja-${fileSafe(l)}`, c.sheet[k]); for (const [i, s] of (c.savedImages || []).entries()) if (!used.has(s.imgId)) await put(`${base}/favorita-${i + 1}-seed-${s.seed}`, s.imgId); }
    for (const p of m.places) if (p.imageId) await put(`imagenes/lugares/${fileSafe(p.name)}`, p.imageId);
    for (const c of chapterList(m)) { const base = `imagenes/capitulos/Cap ${c.number}`; for (const [i, p] of (c.panels || []).entries()) if (p.imageId && !used.has(p.imageId)) await put(`${base}/panel-${String(i + 1).padStart(2, '0')}`, p.imageId); for (const [i, it] of (c.layout?.items || []).entries()) if (it.imgId && !used.has(it.imgId)) await put(`${base}/editor-${String(i + 1).padStart(2, '0')}`, it.imgId); }
    if (m.covers?.img && !used.has(m.covers.img)) await put('imagenes/portada', m.covers.img);
    for (const s of Object.values(m.images || {})) if (s.sticker && !used.has(s.id)) await put(`imagenes/stickers/${fileSafe(s.name || 'sticker')}-${s.id.slice(-5)}`, s.id);
    for (const s of Object.values(m.images || {})) if (!used.has(s.id)) await put(`imagenes/galeria/${s.id.slice(-8)}${s.seed != null ? '-seed-' + s.seed : ''}`, s.id);
    for (const v of m.videos || []) { const base = `videos/${fileSafe(v.name)}`; z.file(`${base}/proyecto.json`, JSON.stringify(v, null, 1)); for (const id of new Set(v.clips.map(c => c.media).filter(Boolean))) { const md = m.media?.[id]; if (!md || md.img) continue; const b = await mediaBlob(m, id); if (b) { z.file(`${base}/${fileSafe(md.name)}-${id.slice(-5)}.${(b.type.split('/')[1] || 'bin').split(';')[0]}`, b, { binary: true }); n++; } } }
    for (const md of Object.values(m.media || {})) { if (md.img) continue; const inV = (m.videos || []).some(v => v.clips.some(c => c.media === md.id)); if (inV) continue; const b = await mediaBlob(m, md.id); if (b) z.file(`videos/biblioteca/${fileSafe(md.name)}-${md.id.slice(-5)}.${(b.type.split('/')[1] || 'bin').split(';')[0]}`, b, { binary: true }); }
    for (const a of Object.values(m.audios || {})) { const b = await hdBlob(m, a); if (b) z.file(`audios/${fileSafe(a.label)}.${a.ext}`, b, { binary: true }); }
    const links = []; for (const c of m.characters.filter(x => x.loraId)) { el.innerHTML = `<span class="spin"></span> LoRA de ${esc(c.name)}…`; const b = await fetchLora(c.loraId); if (b) z.file(`loras/${fileSafe(c.name)}${c.loraVersion ? '-v' + c.loraVersion : ''}.safetensors`, b, { binary: true }); else links.push(`${c.name}: ${c.loraId}`); }
    z.file('loras/LEEME.txt', ['LoRAs de ' + m.name, '', ...m.characters.filter(c => c.loraId || c.trigger).map(c => `${c.name}\n  trigger: ${c.trigger || '-'}\n  LoRA: ${c.loraId || '-'}\n  peso: ${c.loraWeight ?? '-'}\n  versión: ${c.loraVersion ? 'v' + c.loraVersion : '-'}\n`), ...(links.length ? ['', 'No se pudieron descargar automáticamente (descárgalos desde el enlace):', ...links] : [])].join('\n'));
    z.file('datos/manhwa.json', JSON.stringify(m, null, 1));
    el.innerHTML = '<span class="spin"></span> Comprimiendo…';
    const blob = await z.generateAsync({ type: 'blob', compression: 'STORE' });
    downloadBlob(blob, `${fileSafe(m.name)} - TODO.zip`);
    toast(`Paquete listo (${(blob.size / 1e6).toFixed(1)} MB): Word, ${n} archivos, audios y LoRAs ✔`, 'ok');
  }, 'Preparando…');
};
async function fetchLora(url) { if (!/^https?:\/\//.test(url || '')) return null; try { const r = await fetch(url); if (!r.ok) return null; return await r.blob(); } catch (e) { return null; } }
/* ---------- acciones: cada cosa por separado ---------- */
ACT.dlEntity = async el => { const m = cur(); const t = el.dataset.t; const e = (m[TYPES[t].key] || []).find(x => x.id === el.dataset.id); await busy(el, async () => { await docxLib(); const b = await makeDocx(e.name, [...coverBlocks(m, `${TYPES[t].one[0].toUpperCase() + TYPES[t].one.slice(1)}: ${e.name}`), ...await entBlocks(m, t, e, { level: 1 })]); downloadBlob(b, `${fileSafe(e.name)} - ${TYPES[t].one}.docx`); }, 'Creando…'); };
ACT.dlSection = async el => { const m = cur(); const t = el.dataset.t; await busy(el, async () => { await docxLib(); const b = await makeDocx(TYPES[t].label, [...coverBlocks(m, TYPES[t].label), ...await sectionBlocks(m, t)]); downloadBlob(b, `${fileSafe(m.name)} - ${TYPES[t].label}.docx`); }, 'Creando…'); };
ACT.dlCanon = async el => { const m = cur(); await busy(el, async () => { await docxLib(); downloadBlob(await makeDocx('Fichas canon', [...coverBlocks(m, 'Fichas canon'), ...canonBlocks(m)]), `${fileSafe(m.name)} - Fichas canon.docx`); }, 'Creando…'); };
ACT.dlBibleOnly = async el => { const m = cur(); await busy(el, async () => { await docxLib(); downloadBlob(await makeDocx('Historia', [...coverBlocks(m, 'Historia y estilo'), ...bibleBlocks(m)]), `${fileSafe(m.name)} - Historia.docx`); }, 'Creando…'); };
ACT.dlChapter = async el => { const m = cur(); const c = chapterById(m, el.dataset.id); const withImg = el.dataset.img === '1'; await busy(el, async () => { await docxLib(); downloadBlob(await makeDocx(`Cap ${c.number}`, await chapterBlocks(m, c, { script: true, images: withImg })), `${fileSafe(m.name)} - Cap ${c.number}${c.title ? ' ' + fileSafe(c.title) : ''}.docx`); }, 'Creando…'); };
ACT.dlChapterImgs = async el => { const m = cur(); const c = chapterById(m, el.dataset.id); await busy(el, async () => { const z = new JSZip(); let n = 0; for (const [i, p] of (c.panels || []).entries()) if (p.imageId) { const b = await getImageBlob(m, p.imageId); if (b) { z.file(`panel-${String(i + 1).padStart(2, '0')}.${extOf(b)}`, b); n++; } } for (const [i, it] of (c.layout?.items || []).entries()) if (it.imgId && !(c.panels || []).some(p => p.imageId === it.imgId)) { const b = await getImageBlob(m, it.imgId); if (b) { z.file(`editor-${String(i + 1).padStart(2, '0')}.${extOf(b)}`, b); n++; } } if (!n) throw new Error('Este capítulo aún no tiene imágenes'); downloadBlob(await z.generateAsync({ type: 'blob' }), `${fileSafe(m.name)} - Cap ${c.number} imágenes.zip`); }, 'Preparando…'); };
ACT.dlCharImgs = async el => { const m = cur(); const c = m.characters.find(x => x.id === el.dataset.id); await busy(el, async () => { const z = new JSZip(); const seen = new Set(); let n = 0; const add = async (name, id) => { if (!id || seen.has(id)) return; seen.add(id); const b = await getImageBlob(m, id); if (b) { z.file(`${name}.${extOf(b)}`, b); n++; } }; await add('referencia', c.imageId); for (const [k, l] of SHEET_SLOTS) await add('hoja-' + fileSafe(l), c.sheet?.[k]); for (const [i, s] of (c.savedImages || []).entries()) await add(`favorita-${i + 1}-seed-${s.seed}`, s.imgId); for (const [i, r] of (c.lab?.rounds || []).entries()) for (const [j, id] of r.imgs.entries()) await add(`laboratorio-ronda${i + 1}-${j + 1}`, id); if (!n) throw new Error('Este personaje aún no tiene imágenes'); downloadBlob(await z.generateAsync({ type: 'blob' }), `${fileSafe(c.name)} - imágenes.zip`); }, 'Preparando…'); };
ACT.dlLora = async el => { const m = cur(); const c = m.characters.find(x => x.id === el.dataset.id); if (!c?.loraId) return toast('Este personaje aún no tiene LoRA', 'err'); await busy(el, async () => { const b = await fetchLora(c.loraId); if (b) { downloadBlob(b, `${fileSafe(c.name)}${c.loraVersion ? '-v' + c.loraVersion : ''}.safetensors`); toast('LoRA descargado ✔', 'ok'); } else { window.open(c.loraId, '_blank', 'noopener'); toast('Abrí el enlace del LoRA en otra pestaña para descargarlo'); } }, 'Descargando…'); };
ACT.dlLoras = async el => { const m = cur(); await busy(el, async () => { await docxLib(); downloadBlob(await makeDocx('LoRAs', [...coverBlocks(m, 'LoRAs y looks'), ...lorasBlocks(m)]), `${fileSafe(m.name)} - LoRAs.docx`); }, 'Creando…'); };
ACT.dlImg = async (el, e) => { e?.stopPropagation?.(); const m = cur(); const id = el.dataset.id; const meta = m.images[id]; const b = await getImageBlob(m, id); if (!b) return toast('No encontré la imagen', 'err'); downloadBlob(b, `${fileSafe(m.name)}-${meta?.sticker ? 'sticker' : 'imagen'}-${id.slice(-6)}${meta?.seed != null ? '-seed-' + meta.seed : ''}.${extOf(b)}`); };
ACT.dlVideoFiles = async el => { const m = cur(); const v = vById(m, el.dataset.id); await busy(el, async () => { const z = new JSZip(); z.file('proyecto.json', JSON.stringify(v, null, 1)); let n = 0; for (const id of new Set(v.clips.map(c => c.media).filter(Boolean))) { const md = m.media?.[id]; const b = md?.img || m.images?.[id] ? await getImageBlob(m, id) : await mediaBlob(m, id); if (b) { z.file(`${fileSafe(md?.name || 'archivo')}-${id.slice(-5)}.${(b.type.split('/')[1] || 'bin').split(';')[0]}`, b, { binary: true }); n++; } } downloadBlob(await z.generateAsync({ type: 'blob', compression: 'STORE' }), `${fileSafe(v.name)} - archivos.zip`); toast(`${n} archivos del video descargados (para el video final usa Exportar)`, 'ok'); }, 'Preparando…'); };
ACT.dlClipMedia = async () => { const m = cur(); const v = vById(m, Route.a); const c = v?.clips.find(x => x.id === VED.sel); if (!c?.media) return toast('Este clip no tiene archivo (está hecho con código)', 'err'); const md = m.media?.[c.media]; const b = md?.img || m.images?.[c.media] ? await getImageBlob(m, c.media) : await mediaBlob(m, c.media); if (!b) return toast('No encontré el archivo', 'err'); downloadBlob(b, `${fileSafe(md?.name || c.name || 'archivo')}.${(b.type.split('/')[1] || 'bin').split(';')[0]}`); };
