/* =====================================================================
   MIS 4 TRABAJADORES DE FAL.AI
   Cada modelo de Fal.ai es un "trabajador" con su precio en pesos.
   Siempre se muestra el precio ANTES de generar y lo que se gastó DESPUÉS.
   Precios tomados de las páginas de cada modelo en Fal.ai (nov 2026).
   ===================================================================== */
const WK = {
  artista: {
    icon: '🎨', name: 'EL ARTISTA CARO', app: 'blackforestlabs/flux-3/text-to-image', tone: 'warn',
    what: 'Hace dibujos hermosos. Úsalo 1 sola vez al principio para crear la cara de tu protagonista (y para portadas bonitas).',
    says: 'Este es caro, úsalo solo para crear a tu personaje, no para hacer capítulos enteros',
    list: [['1 imagen en 1K', 0.048], ['1 imagen en 2K', 0.10], ['1 portada en 2K', 0.10], ['20 imágenes para crear a tu prota', 0.96]]
  },
  maestro: {
    icon: '🧑‍🏫', name: 'EL MAESTRO', app: 'blackforestlabs/flux-3/klein/base/trainer', per1000: 4.30, tone: 'neon',
    what: 'Se aprende la cara de tu personaje. Le das unas 20 fotos y ya nunca se le olvida.',
    says: 'Pagas una sola vez y ya nunca se le olvida la cara de tu prota',
    list: [['Enseñarle 1 personaje (una sola vez)', 4.30], ['3 personajes', 12.90]],
    extra: 'No cobra por mes ni renta. Pagas una vez y es tuyo para siempre.'
  },
  maestroClasico: {
    icon: '🧑‍🏫', name: 'EL MAESTRO CLÁSICO', app: 'fal-ai/flux-lora-fast-training', per1000: 2,
    what: 'Más barato ($2), pero lo que aprende NO lo puede usar El Obrero. Sus personajes se dibujan con El Obrero Clásico ($0.035 por panel).'
  },
  obrero: {
    icon: '👷', name: 'EL OBRERO', app: 'blackforestlabs/flux-3/klein/text-to-image/lora', each: 0.012, tone: 'ok',
    what: 'Hace TODOS tus capítulos con tu personaje fijo, usando lo que le enseñó El Maestro.',
    says: 'Este es el que vas a usar todos los días, es el más barato y ya sabe la cara de tu prota',
    list: [['1 panel en 1K', 0.012], ['1 capítulo de 10 paneles', 0.12], ['1 capítulo de 40 paneles', 0.48], ['1 mes: 4 capítulos de 40 paneles', 1.92]]
  },
  obreroClasico: {
    icon: '👷', name: 'EL OBRERO CLÁSICO', app: 'fal-ai/flux-lora', each: 0.035,
    what: 'Dibuja a los personajes que aprendió El Maestro Clásico (o LoRAs que ya tenías).'
  },
  pruebas: {
    icon: '✏️', name: 'EL DE PRUEBAS', app: 'blackforestlabs/flux-3/klein/text-to-image', each: 0.009, tone: '',
    what: 'Hace garabatos rápidos para probar poses e ideas. No sabe la cara de tu prota.',
    says: 'Usa este para probar ideas, casi no cobra nada',
    list: [['1 imagen de prueba en 1K', 0.009], ['100 imágenes de prueba', 0.90]]
  },
  portadas: {
    icon: '🔤', name: 'EL DE PORTADAS', app: 'fal-ai/recraft/v3/text-to-image', each: 0.04, tone: '',
    what: 'Solo para portadas que llevan el título con letras (los otros a veces escriben las letras chuecas).',
    says: 'Solo úsalo para portadas con título',
    list: [['1 portada con título', 0.04]]
  }
};
const wkOn = () => S.settings.useWorkers !== false;
const mxnRate = () => Number(S.settings.mxnRate) || 17;
const mx = usd => '$' + (usd * mxnRate()).toFixed(2) + ' MXN';
const usdTxt = usd => '$' + (usd < 0.1 ? usd.toFixed(3) : usd.toFixed(2)) + ' USD';
function wkCost(k, n = 1, o = {}) {
  const W = WK[k]; if (!W) return 0;
  if (k === 'artista') return n * (o.res === '2k' ? 0.10 : 0.048);
  if (W.per1000) return n * W.per1000 * ((o.steps || 1000) / 1000);
  return n * W.each;
}
/* 1K: el área no pasa de 1024×1024 (1 megapíxel) — se ve perfecto en celular */
function fit1K(w, h) { const r = (h || 1) / (w || 1); let W = Math.sqrt(1048576 / r), H = W * r; W = Math.floor(W / 16) * 16; H = Math.floor(H / 16) * 16; return { w: W, h: H }; }
const ARS = ['21:9', '2:1', '16:9', '3:2', '7:5', '4:3', '5:4', '1:1', '4:5', '3:4', '5:7', '2:3', '9:16', '1:2'];
function nearestAR(w, h) { const r = w / h; return ARS.reduce((b, a) => { const [x, y] = a.split(':').map(Number); return Math.abs(Math.log(x / y / r)) < Math.abs(Math.log(b[1])) ? [a, x / y / r] : b; }, ['1:1', 99])[0]; }
function workerReq(k, { prompt, loras = [], width = 800, height = 1200, seed, res = '1k' }) {
  const W = WK[k]; const s = fit1K(width, height); const L = (loras || []).filter(l => l.path).slice(0, 3);
  if (k === 'artista') return { app: W.app, input: { prompt, aspect_ratio: nearestAR(width, height), resolution: res === '2k' ? '2k' : '1k', output_format: 'jpeg' } };
  if (k === 'obrero') return { app: W.app, input: { prompt, loras: L, image_size: { width: s.w, height: s.h }, num_images: 1, seed, output_format: 'jpeg', enable_prompt_expansion: false } };
  if (k === 'pruebas') return { app: W.app, input: { prompt, image_size: { width: s.w, height: s.h }, num_images: 1, seed, output_format: 'jpeg', enable_prompt_expansion: false } };
  if (k === 'obreroClasico') return { app: W.app, input: { prompt, loras: L, image_size: { width: s.w, height: s.h }, num_images: 1, seed, num_inference_steps: 28, guidance_scale: 3.5, output_format: 'jpeg', enable_safety_checker: true } };
  if (k === 'portadas') return { app: W.app, input: { prompt, image_size: { width: 1024, height: Math.round(1024 * height / width / 16) * 16 }, style: 'digital_illustration' } };
  throw new Error('Trabajador desconocido');
}
/* ¿qué trabajador dibuja a este personaje? */
const loraKind = c => !c?.loraId ? null : (c.loraBase === 'klein' ? 'klein' : 'clasico');
function wkForChars(chars) {
  const kinds = new Set(chars.map(loraKind).filter(Boolean));
  if (kinds.has('clasico') && !kinds.has('klein')) return 'obreroClasico';
  return 'obrero';
}
function wkForPanel(m, p) {
  const chars = (p.characters || []).map(n => charByName(m, n)).filter(Boolean);
  const k = wkForChars(chars);
  const loras = chars.filter(c => c.loraId && (k === 'obrero' ? loraKind(c) === 'klein' : loraKind(c) === 'clasico')).map(c => ({ path: c.loraId, scale: Number(c.loraWeight) || 0.9 }));
  return { k, loras };
}
/* ---------- gasto en Fal.ai ---------- */
function falSpentMonth(mk = monthKey()) { return (S.settings.falSpend || {})[mk] || 0; }
function falSpentTotal() { return Object.values(S.settings.falSpend || {}).reduce((a, b) => a + b, 0); }
function addFalSpend(v, m, chapterId) {
  if (!(v > 0)) return; S.settings.falSpend ||= {}; S.settings.falSpend[monthKey()] = falSpentMonth() + v; saveSettings();
  const c = chapterId && m ? chapterById(m, chapterId) : null; if (c) { c.falSpent = (c.falSpent || 0) + v; touch(m); }
  if (typeof renderSide === 'function') renderSide();
}
/* ---------- saldo: el real de Fal.ai, o el que tú anotaste ---------- */
let BAL = null;
async function falSaldo(fresh = false) {
  if (!fresh && BAL && Date.now() - BAL.at < 30000) return BAL;
  if (S.user && S.keyStatus?.fal !== false) {
    try { const r = await callFn('falBalance'); if (typeof r.balance === 'number') return (BAL = { usd: r.balance, real: true, at: Date.now() }); } catch (e) { }
  }
  const sv = S.settings.saldo; if (sv && typeof sv.usd === 'number') return (BAL = { usd: sv.usd - (falSpentTotal() - (sv.spentAt || 0)), real: false, at: Date.now() });
  return null;
}
const saldoTxt = b => b ? `${mx(Math.max(0, b.usd))} (${usdTxt(Math.max(0, b.usd))})${b.real ? '' : ' aprox.'}` : null;
/* ---------- "¿Le doy?" ---------- */
async function confirmWorker(k, n, { noun = null, res = '1k', steps, extra = '' } = {}) {
  const W = WK[k]; const total = wkCost(k, n, { res, steps }); const one = wkCost(k, 1, { res, steps });
  const what = noun || (k === 'maestro' || k === 'maestroClasico' ? null : plural(n, 'imagen', 'imágenes'));
  const b = await falSaldo();
  return new Promise(resolve => {
    const bg = modal(`<h2>${W.icon} ${W.name}</h2>
      <p style="font-size:18px;line-height:1.5">${what ? `Vas a generar <b>${esc(what)}</b> con <b>${W.name}</b>` : `<b>${W.name}</b> va a aprender la cara de tu personaje`}, te va a costar <b style="color:var(--neon);font-size:22px">${mx(total)}</b>. ¿Le doy?</p>
      <div class="small muted">${n > 1 ? `${mx(one)} cada ${what && /panel/.test(what) ? 'uno' : 'una'} · ` : ''}≈ ${usdTxt(total)}${k === 'artista' ? ` · tamaño ${res === '2k' ? '2K' : '1K'}` : ''}</div>
      ${W.says ? `<div class="alert ${W.tone === 'warn' ? 'warn' : 'info'} small">💬 “${esc(W.says)}”</div>` : ''}
      ${extra ? `<div class="alert info small"><div>${extra}</div></div>` : ''}
      <div class="tiny dim">${b ? `Tu saldo en Fal.ai: ${saldoTxt(b)}. ` : ''}Este mes llevas ${mx(falSpentMonth())} en Fal.ai.</div>
      ${b && b.usd < total ? `<div class="alert bad small">⚠️ Parece que no te alcanza el saldo. Recarga en fal.ai antes de darle.</div>` : ''}
      <div class="acts"><button data-x="no">No</button><button class="pri" data-x="yes">Sí, dale (${mx(total)})</button></div>`, { onClose: () => resolve(false) });
    bg.querySelector('[data-x=no]').onclick = () => { bg.remove(); resolve(false); };
    bg.querySelector('[data-x=yes]').onclick = () => { bg.remove(); resolve(true); };
  });
}
/* "Ya gastaste…" */
async function afterSpend(m, spent, { chapterId = null, label = '' } = {}) {
  if (!(spent > 0)) return;
  const c = chapterId ? chapterById(m, chapterId) : null; const b = await falSaldo(true);
  const msg = c ? `Ya gastaste ${mx(c.falSpent || spent)} en este capítulo` : `Gastaste ${mx(spent)}${label ? ' ' + label : ''}`;
  toast(`💸 ${msg}${b ? `, te quedan ${saldoTxt(b)} de saldo` : ''}.`, 'ok');
}

/* ---------- La sección ---------- */
function wkCard(k, opts = {}) {
  const W = WK[k];
  return `<div class="card wkcard" style="border-color:${W.tone === 'warn' ? 'var(--warn)' : W.tone === 'ok' ? 'var(--ok)' : W.tone === 'neon' ? 'var(--neon)' : 'var(--line)'}">
    <div class="row nw" style="gap:12px"><div style="font-size:42px;line-height:1">${W.icon}</div><div class="grow"><div class="tiny dim">${opts.n ? 'TRABAJADOR ' + opts.n : 'EXTRA'}</div><h2 style="margin:0">${W.name}</h2></div></div>
    <p style="margin:10px 0">${esc(W.what)}</p>
    <table class="t" style="width:100%">${W.list.map(([l, v]) => `<tr><td>${esc(l)}</td><td style="text-align:right;white-space:nowrap"><b>${mx(v)}</b><div class="tiny dim">${usdTxt(v)}</div></td></tr>`).join('')}</table>
    ${W.extra ? `<p class="small" style="margin:8px 0 0">${esc(W.extra)}</p>` : ''}
    <div class="alert ${W.tone === 'warn' ? 'warn' : 'info'} small" style="margin-top:10px">💬 “${esc(W.says)}”</div>
    ${opts.after || ''}
  </div>`;
}
VIEWS.trabajadores = () => {
  const mk = monthKey(); const months = Object.entries(S.settings.falSpend || {}).sort().reverse().slice(0, 6);
  const m = cur(); const caps = m ? chapterList(m).filter(c => c.falSpent) : [];
  return `<div class="head"><div><h1>👷 MIS 4 TRABAJADORES DE FAL.AI</h1><p class="muted">Cada vez que la app hace un dibujo, uno de estos trabajadores lo hace y Fal.ai te cobra. Aquí ves cuánto cobra cada uno, en pesos.</p></div></div>
    <div class="grid2" style="margin-bottom:14px">
      <div class="card" style="border-color:var(--neon)"><div class="tiny dim">ESTE MES (${mk})</div><div style="font-size:30px;font-weight:800;color:var(--neon)">${mx(falSpentMonth())}</div><div class="small muted">Este mes has gastado ${mx(falSpentMonth())} en Fal.ai (≈ ${usdTxt(falSpentMonth())})</div>
        ${months.length > 1 ? `<div class="tiny dim" style="margin-top:8px">${months.slice(1).map(([k, v]) => `${k}: ${mx(v)}`).join(' · ')}</div>` : ''}</div>
      <div class="card"><div class="tiny dim">TU SALDO EN FAL.AI</div><div id="wkSaldo" style="font-size:30px;font-weight:800"><span class="spin"></span></div><div class="small muted" id="wkSaldoNote"></div>
        <div class="row" style="margin-top:8px"><button class="sm" data-a="wkSaldoSet">✏️ Anotar lo que recargué</button><a class="btn sm" href="https://fal.ai/dashboard/billing" target="_blank" rel="noopener">💳 Recargar en fal.ai</a></div></div>
    </div>
    <div class="alert info" style="margin-bottom:14px"><div><b>📱 Tamaños:</b> los paneles siempre salen en <b>1K</b>, porque 1K se ve perfecto en celular y 4K es tirar dinero. Solo las portadas se hacen en <b>2K</b>.<br>
      <b>💲 Siempre te pregunto antes:</b> “Vas a generar X paneles con EL OBRERO, te va a costar $X MXN. ¿Le doy?” y al terminar te digo cuánto gastaste y cuánto saldo te queda.</div></div>
    <div class="alert warn" style="margin-bottom:14px"><div><b>⚠️ Importante:</b> El Obrero solo reconoce lo que le enseñó <b>EL MAESTRO</b> ($4.30 USD = ${mx(4.30)} una vez por personaje). Hay un Maestro más barato ($2 USD = ${mx(2)}), pero lo que él enseña <b>no le sirve al Obrero</b>. Con ese, tus capítulos los dibuja El Obrero Clásico a ${mx(0.035)} por panel (casi 3 veces más caro). Si haces muchos capítulos, El Maestro de $4.30 te sale más barato.<br>
      <span class="small">Ejemplo de 1 mes (4 capítulos de 40 paneles): con El Maestro ${mx(4.30)} + ${mx(1.92)} = <b>${mx(6.22)}</b> el primer mes y luego ${mx(1.92)} al mes · con el clásico ${mx(2)} + ${mx(5.60)} = <b>${mx(7.60)}</b> y luego ${mx(5.60)} al mes.</span></div></div>
    <div class="grid2">
      ${wkCard('artista', { n: 1 })}
      ${wkCard('maestro', { n: 2 })}
      ${wkCard('obrero', { n: 3, after: m ? `<div class="small" style="margin-top:8px">${m.characters.filter(c => c.loraId).map(c => `<span class="chip ${loraKind(c) === 'klein' ? 'ok' : 'warn'}">${esc(c.name)}: ${loraKind(c) === 'klein' ? 'lo dibuja El Obrero' : 'lo dibuja El Obrero Clásico'}</span>`).join(' ') || '<span class="muted">Ningún personaje aprendido todavía. Ve al Laboratorio LoRA.</span>'}</div>` : '' })}
      ${wkCard('pruebas', { n: 4 })}
      ${wkCard('portadas')}
      <div class="card"><h2 style="margin-top:0">🧭 ¿Quién trabaja en cada lugar?</h2>
        <table class="t" style="width:100%">
          <tr><td>Crear la cara de tu prota (Laboratorio)</td><td>🎨 El Artista Caro</td></tr>
          <tr><td>Probar poses e ideas</td><td>✏️ El de Pruebas</td></tr>
          <tr><td>Enseñar la cara (entrenar)</td><td>🧑‍🏫 El Maestro</td></tr>
          <tr><td>Paneles de los capítulos</td><td>👷 El Obrero</td></tr>
          <tr><td>Hoja de modelo y cambios de look</td><td>👷 El Obrero (o 🎨 si aún no aprende)</td></tr>
          <tr><td>Portada sin letras (2K)</td><td>🎨 El Artista Caro</td></tr>
          <tr><td>Portada con título</td><td>🔤 El de Portadas</td></tr>
        </table>
        <label class="f" style="margin-top:12px">💱 Dólar a pesos (para calcular en MXN)<input type="number" step="0.1" id="wkRate" value="${mxnRate()}"></label>
        <label class="row nw small" style="margin-top:6px"><input type="checkbox" id="wkOn" ${wkOn() ? 'checked' : ''}> Usar a mis trabajadores (si lo apagas, la app usa el modelo de Configuración como antes)</label></div>
    </div>
    ${caps.length ? `<div class="sect panelbox" style="margin-top:14px"><h2>📖 Gasto por capítulo (${esc(m.name)})</h2><table class="t">${caps.map(c => `<tr><td>Cap ${c.number} · ${esc(c.title || '')}</td><td style="text-align:right"><b>${mx(c.falSpent)}</b></td></tr>`).join('')}</table></div>` : ''}
    <p class="tiny dim" style="margin-top:14px">Precios de las páginas de Fal.ai. Fal.ai es quien cobra; aquí ves un cálculo hecho por la app.</p>`;
};
function wkMount() {
  if (Route.view !== 'trabajadores') return;
  const r = $('#wkRate'); if (r) r.onchange = () => { S.settings.mxnRate = Number(r.value) || 17; saveSettings(); render(); };
  const o = $('#wkOn'); if (o) o.onchange = () => { S.settings.useWorkers = o.checked; saveSettings(); toast(o.checked ? 'Tus trabajadores están activos 👷' : 'Trabajadores apagados'); };
  falSaldo(true).then(b => { const el = $('#wkSaldo'); if (!el) return; el.innerHTML = b ? mx(Math.max(0, b.usd)) : '—'; $('#wkSaldoNote').textContent = b ? `${usdTxt(Math.max(0, b.usd))} · ${b.real ? 'saldo real de tu cuenta de Fal.ai' : 'cálculo con lo que anotaste menos lo gastado'}` : (S.user ? 'No pude leer tu saldo de Fal.ai. Anota lo que recargaste y yo voy restando.' : 'Inicia sesión para ver tu saldo.'); });
}
ACT.wkSaldoSet = async () => {
  const v = await promptBox('💳 Mi saldo en Fal.ai', String(S.settings.saldo?.usd ?? ''), { label: '¿Cuánto saldo tienes ahorita en Fal.ai? (en dólares, como sale en fal.ai)' });
  if (v == null || v === '') return; const n = Number(String(v).replace(/[^0-9.]/g, '')); if (!(n >= 0)) return toast('Escribe solo el número, ej. 10', 'err');
  S.settings.saldo = { usd: n, spentAt: falSpentTotal(), at: Date.now() }; BAL = null; saveSettings(); render(); toast('Listo, desde aquí voy restando lo que gastes ✔', 'ok');
};
