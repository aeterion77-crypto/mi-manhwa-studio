/* =====================================================================
   📚 SECCIONES DE MI BIBLIA + "TODO LO QUE TENGO"
   Todo lo que no es personaje/lugar/poder/etc. vive en secciones con
   nombre e ícono propios (Temas, Arcos, Glosario, Estilo de dibujo…),
   bien presentadas. Arriba se ve un resumen claro de todo el manhwa.
   ===================================================================== */
function secs(m) {
  const b = m.bible; b.sections ||= [];
  if (b.extras && String(b.extras).trim()) { // pasar los apuntes viejos a secciones
    const parts = String(b.extras).split(/^##\s+/m).map(x => x.trim()).filter(Boolean);
    for (const p of parts) { const nl = p.indexOf('\n'); const title = (nl > 0 ? p.slice(0, nl) : 'Apuntes').trim(); const text = (nl > 0 ? p.slice(nl + 1) : p).trim(); secAdd(m, { title, text }); }
    b.extras = ''; touch(m);
  }
  return b.sections;
}
const SEC_ICONS = [['tema', '🎭'], ['arco', '🌀'], ['glos', '📖'], ['termin', '📖'], ['estilo', '🎨'], ['dibujo', '🎨'], ['arte', '🎨'], ['música', '🎵'], ['musica', '🎵'], ['cap', '📑'], ['trama', '🧵'], ['final', '🏁'], ['mundo', '🌍'], ['geograf', '🗺️'], ['magia', '✨'], ['sistema', '⚙️'], ['religi', '⛪'], ['polít', '👑'], ['polit', '👑'], ['idea', '💡'], ['nota', '📝'], ['referen', '🔗'], ['inspira', '🌟'], ['romance', '💞'], ['secreto', '🤫'], ['misterio', '🕵️'], ['econom', '💰'], ['criatura', '🐉'], ['monstru', '🐉'], ['raza', '🧬'], ['especie', '🧬'], ['idioma', '🗣️'], ['lengua', '🗣️'], ['cultura', '🏮'], ['tecnolog', '🔧'], ['guerra', '⚔️'], ['batalla', '⚔️']];
const secIcon = t => (SEC_ICONS.find(([k]) => norm(t).includes(norm(k))) || [, '📘'])[1];
function secAdd(m, { title, text, icon }) {
  const arr = (m.bible.sections ||= []); title = String(title || 'Sección').trim(); text = String(text || '').trim();
  const same = arr.find(s => norm(s.title) === norm(title));
  if (same) { if (text && !same.text.includes(text)) same.text = same.text ? same.text + '\n\n' + text : text; return same; }
  const s = { id: uid('sec_'), title, icon: icon || secIcon(title), text, at: Date.now() }; arr.push(s); return s;
}
/* texto bonito: títulos, listas, negritas y párrafos */
function prettyText(t) {
  const lines = esc(String(t || '')).split('\n'); let out = '', list = false;
  const inl = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S.+?)\*(?=\s|$)/g, '$1<i>$2</i>');
  for (const raw of lines) {
    const l = raw.trim();
    if (/^[-•*]\s+/.test(l)) { if (!list) { out += '<ul>'; list = true; } out += `<li>${inl(l.replace(/^[-•*]\s+/, ''))}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    if (!l) { out += '<div style="height:8px"></div>'; continue; }
    if (/^#{1,4}\s+/.test(l)) { out += `<h4>${inl(l.replace(/^#+\s+/, ''))}</h4>`; continue; }
    if (/^[^:]{2,40}:\s/.test(l)) { const i = l.indexOf(':'); out += `<p><b>${inl(l.slice(0, i))}:</b>${inl(l.slice(i + 1))}</p>`; continue; }
    out += `<p>${inl(l)}</p>`;
  }
  if (list) out += '</ul>'; return out;
}
/* ---------- resumen: todo lo que tengo ---------- */
function haveHTML(m) {
  const b = m.bible; const S2 = secs(m);
  const tile = (icon, label, n, to, sub = '') => `<a class="havetile ${n ? '' : 'empty'}" ${to ? (to[0] === '#' && !to.startsWith('#/') ? `data-a="secScroll" data-id="${to.slice(1)}"` : `data-a="go" data-to="${to}"`) : ''}><div style="font-size:24px">${icon}</div><div class="grow"><div class="small" style="font-weight:700">${esc(label)}</div><div class="tiny ${n ? '' : 'dim'}">${sub || (n ? (typeof n === 'number' ? n + ' guardados' : '✔ escrito') : 'vacío')}</div></div></a>`;
  const hist = [b.synopsis, b.plot, b.rules].filter(x => (x || '').trim()).length;
  const words = [b.synopsis, b.plot, b.rules, ...S2.map(s => s.text), ...Object.keys(TYPES).flatMap(k => (m[TYPES[k].key] || []).map(e => Object.values(e).filter(v => typeof v === 'string').join(' ')))].join(' ').split(/\s+/).filter(Boolean).length;
  return `<div class="panelbox" style="margin-bottom:16px">
    <div class="row between"><h2 style="margin:0">📚 Todo lo que tengo de ${esc(m.name)}</h2><span class="small muted">${words.toLocaleString('es')} palabras guardadas · ${S.user ? '☁️ guardado en tu nube' : '💾 guardado en este aparato'}</span></div>
    <div class="havegrid" style="margin-top:10px">
      ${tile('🧠', 'Historia (sinopsis, trama, reglas)', hist ? hist + ' de 3' : 0, '#sec-historia', hist ? `${hist} de 3 escritas` : '')}
      ${Object.entries(TYPES).map(([t, T]) => tile(T.icon, T.label, (m[T.key] || []).length, mlink(m, 'wiki', t))).join('')}
      ${tile('📌', 'Fichas canon', m.canon.length, mlink(m, 'canon'))}
      ${tile('📖', 'Capítulos', chapterList(m).length, mlink(m, 'caps'))}
      ${S2.map(s => tile(s.icon, s.title, 1, '#' + s.id, `${s.text.split(/\s+/).filter(Boolean).length} palabras`)).join('')}
      ${tile('📜', 'Mi biblia (documento base)', 1, mlink(m, 'bibliadoc', 'base'), (typeof master === 'function' ? master(m).text.split(/\s+/).filter(Boolean).length.toLocaleString('es') + ' palabras' : ''))}
      ${(b.sources || []).length ? tile('📚', 'Versiones que subiste', b.sources.length, '#sec-docs', `${b.sources.length} guardado${b.sources.length > 1 ? 's' : ''} completo${b.sources.length > 1 ? 's' : ''}`) : ''}
    </div>
  </div>`;
}
/* ---------- secciones bonitas ---------- */
function sectionsHTML(m) {
  const S2 = secs(m); const ed = window.__secEdit;
  return `<div class="row between" style="margin:18px 0 8px"><h2 style="margin:0">📘 Secciones de mi biblia</h2><button data-a="secNew">＋ Nueva sección</button></div>
    ${S2.length ? '' : '<p class="muted small">Aquí aparecen los temas de tu biblia que no son personajes, lugares ni poderes: temas, arcos, glosario, estilo de dibujo, etc. Se crean solos al subir tu biblia, o agrégalos tú.</p>'}
    <div class="secgrid">${S2.map(s => `<div class="panelbox secbox" id="${s.id}">
      <div class="row nw between"><h3 style="margin:0">${s.icon} ${esc(s.title)}</h3><span class="row nw">${ed === s.id ? `<button class="sm ok" data-a="secSave" data-id="${s.id}">✔ Listo</button>` : `<button class="sm" data-a="secEdit" data-id="${s.id}">✏️</button>`}<button class="sm icon danger" data-a="secDel" data-id="${s.id}">🗑️</button></span></div>
      ${ed === s.id ? `<div class="grid2" style="grid-template-columns:90px 1fr"><label class="f">Ícono<input id="secIc" value="${esc(s.icon)}"></label><label class="f">Nombre<input id="secTi" value="${esc(s.title)}"></label></div><label class="f">Contenido<textarea id="secTx" style="min-height:240px">${esc(s.text)}</textarea></label><p class="tiny dim">Tip: “- ” hace listas, “# ” hace títulos, **así** pone negritas.</p>`
      : `<div class="sectext">${prettyText(s.text) || '<span class="muted">Vacía</span>'}</div>`}
    </div>`).join('')}</div>`;
}
ACT.secEdit = el => { window.__secEdit = el.dataset.id; render(); setTimeout(() => $('#secTx')?.focus(), 50); };
ACT.secSave = el => { const m = cur(); const s = secs(m).find(x => x.id === el.dataset.id); s.icon = ($('#secIc').value || '📘').trim(); s.title = ($('#secTi').value || 'Sección').trim(); s.text = $('#secTx').value; window.__secEdit = null; touch(m); render(); toast('Sección guardada ✔', 'ok'); };
ACT.secNew = async () => { const m = cur(); const t = await promptBox('＋ Nueva sección', '', { label: 'Nombre (ej. Temas, Arcos, Glosario, Estilo de dibujo)' }); if (!t) return; const s = secAdd(m, { title: t, text: '' }); window.__secEdit = s.id; touch(m); render(); };
ACT.secDel = async el => { const m = cur(); const s = secs(m).find(x => x.id === el.dataset.id); if (!await confirmBox(`¿Borrar la sección “${s.title}”?`, { ok: 'Borrar' })) return; m.bible.sections = m.bible.sections.filter(x => x.id !== s.id); touch(m); render(); };

ACT.secScroll = el => { const t = document.getElementById(el.dataset.id); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } };
