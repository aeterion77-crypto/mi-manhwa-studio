/* =====================================================================
   ⏳ TRABAJOS EN CURSO
   - Barra fija arriba con lo que Claude está haciendo y un reloj,
     aunque te muevas de página.
   - Con el puente nuevo, el trabajo vive en tu computadora: si recargas
     o cierras la app, al volver a abrirla recoge el resultado y lo guarda.
   - Modo rápido (Claude Sonnet) para guiones y textos largos.
   ===================================================================== */
const JOBUI = new Map(); let jobTick = null;
const ccModel = () => (S.settings.ccSpeed === 'rapido' ? 'sonnet' : undefined);
function jobStart(key, title) { const id = key || uid('j_'); JOBUI.set(id, { title: title || 'Trabajando', start: Date.now(), state: 'run' }); jobRender(); return id; }
function jobEnd(id, ok = true, link = null) { const j = JOBUI.get(id); if (!j) return; j.state = ok ? 'ok' : 'err'; j.end = Date.now(); j.link = link; jobRender(); setTimeout(() => { if (JOBUI.get(id) === j) { JOBUI.delete(id); jobRender(); } }, ok ? 12000 : 8000); }
const jobRunning = key => JOBUI.get(key)?.state === 'run';
const mmss = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function jobRender() {
  let bar = document.getElementById('jobbar'); if (!bar) { bar = document.createElement('div'); bar.id = 'jobbar'; document.body.appendChild(bar); }
  const js = [...JOBUI.entries()];
  bar.innerHTML = js.map(([id, j]) => `<div class="jobrow ${j.state}">${j.state === 'run' ? '<span class="spin"></span>' : j.state === 'ok' ? '✔' : '✕'} <span class="grow">${esc(j.title)}</span><b>${mmss((j.end || Date.now()) - j.start)}</b>${j.state === 'ok' && j.link ? `<a data-a="go" data-to="${j.link}">Ver →</a>` : ''}${j.state === 'run' && S.settings.ccSpeed !== 'rapido' && usingCC() && Date.now() - j.start > 60000 ? `<a data-a="ccFast" title="Los siguientes trabajos se harán con Claude Sonnet, más rápido">⚡ ¿lento? modo rápido</a>` : ''}</div>`).join('');
  bar.style.display = js.length ? 'block' : 'none';
  if (js.some(([, j]) => j.state === 'run')) { if (!jobTick) jobTick = setInterval(() => { jobRender(); $$('[data-jobkey]').forEach(b => { const j = JOBUI.get(b.dataset.jobkey); if (j?.state === 'run') { const t = b.querySelector('.jt'); if (t) t.textContent = mmss(Date.now() - j.start); } }); }, 1000); }
  else { clearInterval(jobTick); jobTick = null; }
}
ACT.ccFast = () => { S.settings.ccSpeed = 'rapido'; saveSettings(); jobRender(); toast('⚡ Modo rápido activado: los siguientes trabajos usan Claude Sonnet (lo cambias en Configuración)', 'ok'); };
/* un botón que muestra si su trabajo sigue corriendo (aunque hayas cambiado de página) */
function jobBtn(key, html, attrs, runLabel) { const j = JOBUI.get(key); if (j?.state === 'run') return `<button ${attrs} disabled data-jobkey="${esc(key)}"><span class="spin"></span> ${esc(runLabel)} <span class="jt">${mmss(Date.now() - j.start)}</span></button>`; return `<button ${attrs}>${html}</button>`; }

/* ---------- trabajos que sobreviven a recargar la app ---------- */
const PEND_KEY = 'mms_jobs';
const pendList = () => { try { return JSON.parse(localStorage.getItem(PEND_KEY) || '[]'); } catch (e) { return []; } };
const pendSave = l => { try { localStorage.setItem(PEND_KEY, JSON.stringify(l)); } catch (e) { } };
async function ccJob(prompt, title, job) {
  const r = await ccFetch('/job', { method: 'POST', body: JSON.stringify({ prompt, title, model: ccModel() }) }, 15000);
  const rec = { id: r.id, title, kind: job?.kind || null, meta: job?.meta || null, key: job?.key || null, at: Date.now() };
  if (job?.kind) pendSave([...pendList(), rec]);
  try { return await ccWait(rec); } finally { if (job?.kind) pendSave(pendList().filter(x => x.id !== rec.id)); }
}
async function ccWait(rec) {
  for (;;) {
    await new Promise(r => setTimeout(r, 2500));
    let st; try { st = await ccFetch('/job?id=' + encodeURIComponent(rec.id), {}, 8000); } catch (e) { if (/404|No encontré/.test(e.message)) throw new Error('El puente ya no tiene ese trabajo'); continue; }
    if (st.status === 'done') return st.text || '';
    if (st.status === 'error') throw new Error(st.error || 'Claude Code no pudo terminar');
    if (Date.now() - rec.at > 30 * 60 * 1000) throw new Error('Claude Code tardó demasiado');
  }
}
/* al abrir la app: recoger lo que terminó mientras no estabas */
let resumed = false;
async function jobsResume() {
  if (resumed || !usingCC() || !CC.info?.jobs) return; resumed = true;
  for (const rec of pendList()) {
    const m = S.manhwas[rec.meta?.mid]; if (!m || !JOB_DONE[rec.kind]) { pendSave(pendList().filter(x => x.id !== rec.id)); continue; }
    const key = jobStart(rec.key, rec.title + ' (recuperando)');
    ccWait(rec).then(text => { JOB_DONE[rec.kind](m, rec.meta, text); jobEnd(key, true, rec.meta?.cid ? mlink(m, 'cap', rec.meta.cid) : null); toast('✔ Terminó mientras no estabas: ' + rec.title, 'ok'); })
      .catch(e => { jobEnd(key, false); toast(rec.title + ': ' + e.message, 'err'); })
      .finally(() => pendSave(pendList().filter(x => x.id !== rec.id)));
  }
}
