/* =====================================================================
   Configuración: cuenta, llaves seguras, modelos, copia de seguridad
   ===================================================================== */
VIEWS.config = () => {
  const ks = S.keyStatus; const st = S.settings;
  const keyRow = (prov, label, ph, help) => {
    const s = ks?.[prov];
    return `<div class="col" style="gap:8px"><div class="row between"><b>${label}</b>${s?.set ? `<span class="chip ok">✔ Guardada (${esc(s.hint)})</span>` : '<span class="chip">No guardada</span>'}</div>
      <div class="row nw"><input type="password" id="key_${prov}" placeholder="${ph}" autocomplete="off" ${S.user ? '' : 'disabled'}><button class="pri" data-a="saveKey" data-p="${prov}" ${S.user ? '' : 'disabled'}>Guardar</button>${s?.set ? `<button class="danger sm" data-a="delKey" data-p="${prov}">Quitar</button>` : ''}</div>
      <span class="tiny dim">${help}</span></div>`;
  };
  return `<div class="head"><div><h1>⚙️ Configuración</h1><p class="muted">Tu estudio privado en Supabase (plan gratis).</p></div></div>
  <div class="grid2">
    <div class="col">
      <div class="panelbox"><h2>☁️ Cuenta y nube</h2>
        ${S.user ? `<p>Conectado como <b>${esc(S.user.email)}</b>.</p><p class="small muted">Todo se guarda en tu nube: celular y PC ven lo mismo.</p>
          <div class="row"><button data-a="syncNow">🔄 Sincronizar ahora</button><button class="danger" data-a="logout">Cerrar sesión</button></div>`
      : `<p class="small muted">Crea tu cuenta una sola vez (solo tú: después se cierra el registro). Luego entra con lo mismo en tu celular.</p>
          <label class="f">Correo<input id="lgEmail" type="email" autocomplete="email"></label>
          <label class="f">Contraseña (mín. 6)<input id="lgPass" type="password" autocomplete="current-password"></label>
          <div class="row"><button class="pri" data-a="login">Entrar</button><button data-a="signup">Crear mi cuenta</button></div>`}
      </div>
      <div class="panelbox"><h2>🔐 API keys (protegidas)</h2>
        <div class="alert info small">Tus llaves NO se guardan en esta página ni en tu navegador. Viajan una sola vez a tu función segura de Supabase, que las guarda en una tabla a la que el navegador no tiene acceso, y desde ahí llama a Claude y a Fal.ai.</div>
        ${!S.user ? '<div class="alert warn small">Inicia sesión para guardar tus llaves.</div>' : ''}
        ${keyRow('anthropic', 'Claude (solo para el modo automático)', 'sk-ant-…', 'Opcional. Solo si eliges “Automático con API”. Se consigue en console.anthropic.com → API Keys (se cobra aparte de tu plan).')}
        <hr>
        ${keyRow('fal', 'Fal.ai (imágenes y LoRA)', 'fal key…', 'Consíguela en fal.ai → Dashboard → Keys.')}
      </div>
    </div>
    <div class="col">
      <div class="panelbox"><h2>🤖 IA de texto (Claude)</h2>
        <label class="row nw res" style="cursor:pointer"><input type="radio" name="aimode" value="premium" ${isPremium() ? 'checked' : ''} data-change="setAiMode"><div><b>Claude Premium (tu plan actual) · $0 extra</b><div class="small muted">La app te prepara las instrucciones, las pegas en Claude y pegas la respuesta. Usa el mismo Claude que ya pagas.</div></div></label>
        <label class="row nw res" style="cursor:pointer"><input type="radio" name="aimode" value="api" ${!isPremium() ? 'checked' : ''} data-change="setAiMode"><div><b>Automático con API key · cobro por uso</b><div class="small muted">Todo se hace solo con un clic. Antes de cada uso te digo el precio y confirmas.</div></div></label>
        <div style="margin-top:10px"><b>🔌 Velocidad de tu Claude Code</b>
          <label class="row nw res" style="cursor:pointer"><input type="radio" name="ccspeed" value="calidad" ${st.ccSpeed !== 'rapido' ? 'checked' : ''} data-change="setCcSpeed"><div><b>💎 Mejor calidad</b><div class="small muted">Usa el modelo más potente de tu plan. Un guion de 30 paneles puede tardar 3 a 8 minutos.</div></div></label>
          <label class="row nw res" style="cursor:pointer"><input type="radio" name="ccspeed" value="rapido" ${st.ccSpeed === 'rapido' ? 'checked' : ''} data-change="setCcSpeed"><div><b>⚡ Más rápido</b><div class="small muted">Usa Claude Sonnet: más o menos el doble de rápido, muy buena calidad. También es gratis con tu plan.</div></div></label></div>
        ${!isPremium() ? `<label class="f">Modelo<select ${bindAttr(st, 'model')} data-onchange="saveSetR">${Object.entries(CLAUDE_MODELS).map(([k, v]) => `<option value="${k}" ${st.model === k ? 'selected' : ''}>${v.label} — $${v.in} entrada / $${v.out} salida por millón de tokens</option>`).join('')}</select></label>
          <div class="tiny dim">Ejemplo: un guion de 30 paneles con ${(CLAUDE_MODELS[st.model] || {}).label || st.model} cuesta ≈ ${money(costAI(45000, 8200, 16000).cost)}.</div>` : ''}
      </div>
      <div class="panelbox"><h2>💲 Gasto estimado</h2>
        <div class="row nw between"><span>Este mes (${monthKey()})</span><b style="font-size:20px;color:var(--neon)">${money(spentThisMonth())} USD</b></div>
        <div class="tiny dim">Suma de lo que confirmaste en la app (Fal.ai + Claude API). El cobro real lo ves en fal.ai/dashboard y console.anthropic.com.</div>
        <div class="small">Tarifas: imágenes ${money(falUnit(st.falApp || 'fal-ai/flux-lora'))}/megapíxel (panel 800×1200 ≈ ${money(costImages(1, 800, 1200))}) · audio HD ${money(costTTS(1000))}/1000 caracteres · entrenar LoRA ${money(costTrain(1000))} por 1000 pasos${st.falPrices?.['fal-ai/flux-lora']?.at ? ` · <span class="dim">precios de Fal.ai actualizados ${fmtDate(st.falPrices['fal-ai/flux-lora'].at)}</span>` : ''}</div>
        ${S.keyStatus?.fal ? '<div><button class="sm" data-a="updPrices">🔄 Actualizar precios desde Fal.ai</button></div>' : ''}
      </div>
      <div class="panelbox"><h2>🎨 Modelos de imagen</h2>
        <label class="f">Generador de imágenes (Fal.ai)<select ${bindAttr(st, 'falApp')} data-onchange="saveSetR"><option value="fal-ai/flux-lora" ${st.falApp === 'fal-ai/flux-lora' ? 'selected' : ''}>FLUX + LoRA (recomendado, compatible con tus LoRA entrenados)</option><option value="fal-ai/lora" ${st.falApp === 'fal-ai/lora' ? 'selected' : ''}>SDXL / Pony + LoRA</option></select></label>
        ${st.falApp === 'fal-ai/lora' ? `<label class="f">Checkpoint Pony/SDXL (repo de Hugging Face o URL .safetensors)<input ${bindAttr(st, 'sdxlModel')} data-onchange="saveSet" value="${esc(st.sdxlModel)}" placeholder="usuario/modelo-pony-xl"></label>
          <label class="f">Prefijo Pony<input ${bindAttr(st, 'ponyPrefix')} data-onchange="saveSet" value="${esc(st.ponyPrefix ?? 'score_9, score_8_up, score_7_up, ')}"></label>
          <div class="alert warn small">Los LoRA que entrena el laboratorio son de FLUX. Con Pony usa LoRAs hechos para Pony/SDXL.</div>` : ''}
        <label class="f">Entrenador de LoRA<input ${bindAttr(st, 'trainApp')} data-onchange="saveSet" value="${esc(st.trainApp)}"></label>
      </div>
      <div class="panelbox"><h2>💾 Copia de seguridad</h2>
        <p class="small muted">Descarga TODO (manhwas, cerebros, capítulos e imágenes) en un .zip. Guárdalo en tu Drive o PC.</p>
        <div class="row"><button class="pri" data-a="backup">⬇️ Exportar copia de seguridad (.zip)</button><button data-a="restore">⬆️ Restaurar copia</button></div>
        <div id="stor" class="tiny dim"></div>
      </div>
    </div>
  </div>`;
};
AFTER.config = async () => {
  if (S.user && !S.keyStatus) refreshKeyStatus();
  try { const e = await navigator.storage.estimate(); const el = $('#stor'); if (el) el.textContent = `Espacio usado en este dispositivo: ${(e.usage / 1e6).toFixed(1)} MB. Nube gratis de Supabase: 1 GB de imágenes y 500 MB de datos.`; } catch (e) { }
};
ACT.saveSet = () => saveSettings();
ACT.setCcSpeed = el => { S.settings.ccSpeed = el.value; saveSettings(); toast(el.value === 'rapido' ? '⚡ Modo rápido (Sonnet)' : '💎 Mejor calidad'); };
ACT.setAiMode = el => { S.settings.aiMode = el.value; saveSettings(); render(); toast(el.value === 'premium' ? 'Usando tu Claude Premium (copiar y pegar, $0 extra)' : 'Modo automático con API: te mostraré el precio antes de cada uso'); };
ACT.updPrices = el => busy(el, async () => { await refreshFalPrices(); render(); toast('Precios actualizados', 'ok'); }, 'Consultando…');
ACT.saveSetR = () => { S.settings.modelChosen = true; saveSettings(); setTimeout(render, 50); };
ACT.login = async el => {
  const email = $('#lgEmail').value.trim(), password = $('#lgPass').value;
  if (!email || !password) return toast('Escribe correo y contraseña', 'err');
  await busy(el, async () => { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message); toast('¡Bienvenido! Sincronizando…', 'ok'); render(); }, 'Entrando…');
};
ACT.signup = async el => {
  const email = $('#lgEmail').value.trim(), password = $('#lgPass').value;
  if (!email || password.length < 6) return toast('Correo y contraseña de al menos 6 caracteres', 'err');
  await busy(el, async () => {
    const rr = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ action: 'register', email, password }) });
    const j = await rr.json().catch(() => ({}));
    if (!rr.ok || j.error) throw new Error(j.error || 'No se pudo crear la cuenta');
    const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw r.error;
    toast('Cuenta creada ✔ Tus manhwas se están subiendo a la nube.', 'ok'); render();
  }, 'Creando…');
};
ACT.logout = async () => { if (!await confirmBox('¿Cerrar sesión? Tus manhwas siguen en la nube y en este dispositivo.', { ok: 'Cerrar sesión', danger: false })) return; await sb.auth.signOut(); render(); };
ACT.syncNow = el => busy(el, async () => { await pullCloud(); render(); toast('Sincronizado', 'ok'); }, 'Sincronizando…');
ACT.saveKey = async el => {
  const p = el.dataset.p; const v = $('#key_' + p).value.trim(); if (!v) return toast('Pega tu llave', 'err');
  await busy(el, async () => { await callFn('setKey', { provider: p, key: v }); $('#key_' + p).value = ''; await refreshKeyStatus(); if (p === 'fal') refreshFalPrices(); toast('Llave guardada en tu servidor seguro 🔐', 'ok'); render(); }, 'Guardando…');
};
ACT.delKey = async el => { if (!await confirmBox('¿Quitar esta llave de tu servidor?')) return; await callFn('setKey', { provider: el.dataset.p, key: '' }); await refreshKeyStatus(); render(); };

ACT.backup = async el => {
  await busy(el, async () => {
    const zip = new JSZip(); const ms = Object.values(S.manhwas);
    zip.file('manhwas.json', JSON.stringify({ app: 'mi-manhwa-studio', version: 1, exportedAt: new Date().toISOString(), manhwas: ms }, null, 1));
    let n = 0;
    for (const m of ms) for (const id of Object.keys(m.images || {})) { const b = await getImageBlob(m, id); if (!b) continue; zip.file(`images/${id}.${(b.type || '').includes('png') ? 'png' : 'jpg'}`, b); n++; el.innerHTML = `<span class="spin"></span> ${n} imágenes…`; }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `mi_manhwa_studio_respaldo_${new Date().toISOString().slice(0, 10)}.zip`);
    toast(`Copia lista: ${plural(ms.length, 'manhwa', 'manhwas')}, ${plural(n, 'imagen', 'imágenes')}`, 'ok');
  }, 'Preparando…');
};
ACT.restore = async el => {
  const [f] = await pickFiles({ multiple: false, accept: '.zip' }); if (!f) return;
  await busy(el, async () => {
    const zip = await JSZip.loadAsync(f); const j = JSON.parse(await zip.file('manhwas.json').async('string'));
    const exist = j.manhwas.filter(m => S.manhwas[m.id]).length;
    if (exist && !await confirmBox(`La copia tiene ${j.manhwas.length} manhwas; ${exist} ya existen aquí y se reemplazarán con la versión de la copia.`, { ok: 'Restaurar', danger: true, title: 'Restaurar copia' })) return;
    for (const path of Object.keys(zip.files).filter(p => p.startsWith('images/') && !zip.files[p].dir)) {
      const id = path.slice(7).replace(/\.\w+$/, ''); const b = await zip.file(path).async('blob');
      await IDB.put('images', id, new Blob([b], { type: path.endsWith('png') ? 'image/png' : 'image/jpeg' }));
    }
    for (const m of j.manhwas) { for (const im of Object.values(m.images || {})) im.path = im.path && S.user && im.path.startsWith(S.user.id) ? im.path : null; S.manhwas[m.id] = m; touch(m); }
    toast(`Restaurados ${j.manhwas.length} manhwas`, 'ok'); go('#/');
  }, 'Restaurando…');
};

/* ---------------- App instalable (celular y PC) ---------------- */
let INSTALL_EVT = null;
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL_EVT = e; renderSide(); });
window.addEventListener('appinstalled', () => { INSTALL_EVT = null; toast('App instalada 📲', 'ok'); renderSide(); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
ACT.installApp = async () => {
  if (INSTALL_EVT) { INSTALL_EVT.prompt(); const r = await INSTALL_EVT.userChoice; INSTALL_EVT = null; renderSide(); if (r.outcome === 'accepted') toast('Instalando… 📲', 'ok'); return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const local = location.protocol === 'file:';
  modal(`<h2>📲 Instalar en tu celular</h2>
    ${local ? '<div class="alert warn small">Estás abriendo el archivo directo. Para instalarla, primero súbela a internet (Netlify) y abre tu enlace en el celular.</div>' : ''}
    ${ios ? `<ol class="small" style="padding-left:18px;display:flex;flex-direction:column;gap:6px"><li>Abre este enlace en <b>Safari</b>.</li><li>Toca <b>Compartir</b> (el cuadrito con flecha ⬆️).</li><li>Elige <b>“Agregar a pantalla de inicio”</b> y toca <b>Agregar</b>.</li></ol>`
      : `<ol class="small" style="padding-left:18px;display:flex;flex-direction:column;gap:6px"><li>Abre este enlace en <b>Chrome</b>.</li><li>Toca el menú <b>⋮</b> (arriba a la derecha).</li><li>Elige <b>“Instalar app”</b> o <b>“Agregar a la pantalla principal”</b>.</li></ol>`}
    <p class="small muted">Se abre a pantalla completa con su ícono, y funciona sin internet (lo que hagas se sube a tu nube cuando vuelva la conexión).</p>
    <div class="acts"><button class="pri" onclick="this.closest('.modal-bg').remove()">Entendido</button></div>`);
};

/* ---------------- Arranque ---------------- */
async function init() {
  try { await IDB.open(); await loadLocal(); } catch (e) { toast('Tu navegador bloqueó el almacenamiento local (¿modo incógnito?).', 'err'); }
  if (S.settings.model === 'claude-haiku-5-5' && !S.settings.modelChosen) S.settings.model = DEFAULT_MODEL;
  S.settings.aiMode ||= 'premium'; S.settings.spend ||= {}; S.settings.falPrices ||= {}; S.settings.audioPos ||= {};
  if (!Object.keys(S.manhwas).length) { const m = sampleManhwa(); S.manhwas[m.id] = m; IDB.put('manhwas', m.id, m).catch(() => { }); }
  try { navigator.storage?.persist?.(); } catch (e) { }
  render();
  try { await initAuth(); } catch (e) { console.warn(e); }
  if (S.settings.cc?.token) ccStartPolling();
  if (S.user) { await pullCloud(); await refreshKeyStatus(); refreshFalPrices(); render(); resumeTrainings(); }
  else setSync('local', 'Solo en este dispositivo');
}
init();
