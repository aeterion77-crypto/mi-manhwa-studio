/* =====================================================================
   ANIMACIÓN SOLO CON CÓDIGO (Canvas + JS + Web Audio). Sin IA.
   Ken Burns, parallax, temblor, transiciones, POP, letra por letra,
   partículas, sonidos y música generados por código, video MP4/WebM.
   ===================================================================== */
const ease = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
const easeBack = p => { p = Math.min(1, Math.max(0, p)); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
function layerAnimType(L) { const a = L.anim || 'auto'; if (a !== 'auto') return a; if (L.logo) return 'none'; if (L.kind === 'narracion') return 'type'; if (L.kind === 'sticker') return 'fade'; return 'pop'; }
function itemDuration(it, lang) {
  const a = itemAnim(it); if (a.dur) return a.dur;
  const chars = (it.layers || []).filter(l => l.kind !== 'sticker').reduce((s, l) => s + layerText(l, lang).length, 0);
  return Math.min(10, Math.max(2.4, 1.3 + chars / 15 + (it.layers || []).length * 0.25));
}
function layerTimes(it, lang) {
  let t = 0.4;
  return (it.layers || []).map(L => {
    if (L.logo) return { L, t0: 0 };
    const r = { L, t0: t }; const typ = layerAnimType(L);
    t += typ === 'type' ? Math.min(2.6, layerText(L, lang).length / 26) + 0.25 : typ === 'none' ? 0 : 0.5;
    return r;
  });
}
/* ---------- partículas ---------- */
function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function makeParticles(kind, seed = 7) {
  const R = rnd(seed); const N = { lluvia: 170, nieve: 90, fuego: 110, humo: 26, chispas: 70, velocidad: 46, polvo: 60 }[kind] || 0;
  const ps = Array.from({ length: N }, () => ({ x: R(), y: R(), v: 0.3 + R() * 0.7, s: R(), a: R() * Math.PI * 2, life: R() }));
  return { kind, ps, R };
}
function stepDrawParticles(ctx, P, X, Y, W, H, t, dt) {
  if (!P || !P.ps.length) return;
  const { kind, ps, R } = P; ctx.save(); ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
  if (kind === 'lluvia') {
    ctx.strokeStyle = 'rgba(200,220,255,.55)'; ctx.lineWidth = Math.max(1, W * 0.0025);
    ctx.beginPath(); for (const p of ps) { p.y += dt * (1.6 + p.v * 1.4); p.x += dt * 0.25; if (p.y > 1.05) { p.y = -0.05; p.x = R(); } const x = X + p.x * W, y = Y + p.y * H, l = H * (0.03 + p.v * 0.03); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.18, y - l); } ctx.stroke();
    ctx.fillStyle = 'rgba(20,30,60,.12)'; ctx.fillRect(X, Y, W, H);
  } else if (kind === 'nieve') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const p of ps) { p.y += dt * (0.08 + p.v * 0.1); p.x += Math.sin(t * 1.3 + p.a) * dt * 0.05; if (p.y > 1.03) { p.y = -0.03; p.x = R(); } ctx.beginPath(); ctx.arc(X + p.x * W, Y + p.y * H, W * (0.003 + p.s * 0.006), 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === 'fuego' || kind === 'chispas') {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of ps) {
      p.life += dt * (kind === 'fuego' ? 0.7 + p.v * 0.6 : 0.9);
      if (p.life > 1) { p.life = 0; p.x = kind === 'fuego' ? 0.1 + R() * 0.8 : R(); p.y = kind === 'fuego' ? 1.02 : 0.6 + R() * 0.5; p.a = (R() - 0.5) * 0.5; }
      const yy = kind === 'fuego' ? 1.02 - p.life * (0.35 + p.v * 0.35) : p.y - p.life * 0.5 + p.life * p.life * 0.3; const xx = p.x + Math.sin(t * 3 + p.a * 10) * 0.02 + p.a * p.life * 0.3;
      const r = W * (kind === 'fuego' ? (0.05 + p.s * 0.06) * (1 - p.life * 0.7) : 0.004 + p.s * 0.004); const al = (1 - p.life) * (kind === 'fuego' ? 0.5 : 0.95);
      const g = ctx.createRadialGradient(X + xx * W, Y + yy * H, 0, X + xx * W, Y + yy * H, Math.max(1, r));
      g.addColorStop(0, `rgba(255,${kind === 'fuego' ? 210 : 240},${kind === 'fuego' ? 90 : 150},${al})`); g.addColorStop(0.5, `rgba(255,${kind === 'fuego' ? 90 : 180},20,${al * 0.6})`); g.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + xx * W, Y + yy * H, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'humo') {
    for (const p of ps) {
      p.life += dt * (0.12 + p.v * 0.1); if (p.life > 1) { p.life = 0; p.x = 0.1 + R() * 0.8; }
      const yy = 1.05 - p.life * 0.9, r = W * (0.08 + p.life * 0.22), al = Math.sin(p.life * Math.PI) * 0.22;
      const g = ctx.createRadialGradient(X + p.x * W, Y + yy * H, 0, X + p.x * W, Y + yy * H, r); g.addColorStop(0, `rgba(170,170,180,${al})`); g.addColorStop(1, 'rgba(170,170,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + p.x * W, Y + yy * H, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'velocidad') {
    const cx = X + W / 2, cy = Y + H / 2; ctx.strokeStyle = 'rgba(255,255,255,.75)';
    for (const p of ps) { if (R() < 0.35) continue; const a = p.a + Math.sin(t * 7 + p.s * 20) * 0.02; const r0 = Math.max(W, H) * (0.32 + p.s * 0.12), r1 = Math.max(W, H) * 0.9; ctx.lineWidth = W * (0.002 + p.v * 0.006); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
  } else if (kind === 'polvo') {
    for (const p of ps) { p.x += dt * (0.02 + p.v * 0.04); p.y += Math.sin(t + p.a) * dt * 0.01; if (p.x > 1.02) { p.x = -0.02; p.y = R(); } ctx.fillStyle = `rgba(200,170,120,${0.25 + p.s * 0.35})`; ctx.beginPath(); ctx.arc(X + p.x * W, Y + p.y * H, W * (0.002 + p.s * 0.004), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
/* ---------- dibujar un panel animado dentro de una caja ---------- */
function kbAt(kind, q) {
  q = ease(q);
  switch (kind) {
    case 'in': return { z: 1 + 0.16 * q }; case 'out': return { z: 1.16 - 0.16 * q };
    case 'panR': return { z: 1.14, x: -0.25 + 0.5 * q }; case 'panL': return { z: 1.14, x: 0.25 - 0.5 * q };
    case 'panU': return { z: 1.14, y: 0.25 - 0.5 * q }; case 'panD': return { z: 1.14, y: -0.25 + 0.5 * q };
    default: return null;
  }
}
/* fit: caja (BX,BY,BW,BH); local: segundos dentro del panel */
function drawAnimItem(ctx, m, it, bmp, BX, BY, BW, BH, local, dur, lang, bg, P, opts = {}) {
  const a = itemAnim(it); const r = it.imgId && bmp ? (it.frame || bmp.height / bmp.width) : (it.blankH || 0.5);
  let iw = BW * 0.96, fh = iw * r; if (fh > BH * 0.9) { fh = BH * 0.9; iw = fh / r; }
  let X = BX + (BW - iw) / 2, Y = BY + (BH - fh) / 2;
  const p = local / 0.45; let alpha = 1, sc = 1;
  if (!opts.noEnter && p < 1) {
    const e = ease(p);
    if (a.enter === 'fade') alpha = e; else if (a.enter === 'slide') { Y += (1 - e) * BH * 0.3; alpha = Math.min(1, p * 2); } else if (a.enter === 'slideL') { X += (1 - e) * BW * 0.7; } else if (a.enter === 'zoom') { sc = 1.25 - 0.25 * e; alpha = Math.min(1, p * 2); }
  }
  if (a.shake && local < 0.35) { const k = (1 - local / 0.35) * BW * 0.018; X += Math.sin(local * 90) * k; Y += Math.cos(local * 77) * k; }
  ctx.save(); ctx.globalAlpha *= alpha * (opts.alpha ?? 1);
  if (sc !== 1) { ctx.translate(X + iw / 2, Y + fh / 2); ctx.scale(sc, sc); ctx.translate(-(X + iw / 2), -(Y + fh / 2)); }
  const q = Math.min(1, local / Math.max(0.1, dur));
  if (bmp) {
    const kb = kbAt(a.kb, q) || {}; if (a.parallax) kb.x = (kb.x || 0) + (q - 0.5) * 0.12;
    drawFramed(ctx, bmp, it, X, Y, iw, fh, kb);
  } else { ctx.fillStyle = it.color || bg; ctx.fillRect(X, Y, iw, fh); }
  if (a.particles && a.particles !== 'none') stepDrawParticles(ctx, P, X, Y, iw, fh, local, opts.dt ?? 1 / 30);
  for (const { L, t0 } of layerTimes(it, lang)) {
    const lt = local - t0; if (lt < 0) continue;
    const typ = layerAnimType(L); const o = {};
    if (typ === 'pop') { o.scale = lt < 0.28 ? Math.max(0.01, easeBack(lt / 0.28)) : 1; o.alpha = Math.min(1, lt / 0.1); if (L.kind === 'sfx' || L.kind === 'grito') o.scale *= 1 + 0.07 * Math.sin(lt * 22) * Math.exp(-lt * 4); }
    else if (typ === 'type') { const full = layerText(L, lang); o.text = full.slice(0, Math.floor(lt * 26)); o.alpha = Math.min(1, lt / 0.15); }
    else if (typ === 'fade') o.alpha = Math.min(1, lt / 0.4);
    if (a.parallax && L.kind === 'sticker' && L.fg) o.dx = -(q - 0.5) * iw * 0.09;
    drawLayer(ctx, L, X, Y, iw, fh, lang, o);
  }
  ctx.restore();
  return { X, Y, iw, fh };
}
/* ---------- secuencia completa de un capítulo ---------- */
async function buildSeq(m, c, lang, only = null) {
  await ensureFonts();
  const items = c.layout.items.filter(i => !only || i.id === only);
  const seq = []; let t = 0;
  for (const it of items) {
    const dur = itemDuration(it, lang);
    let bmp = null; if (it.imgId) { const b = await getImageBlob(m, it.imgId); if (b) try { bmp = await createImageBitmap(b); } catch (e) { } }
    await loadLayerBitmaps(m, it.layers);
    seq.push({ it, dur, start: t, bmp, P: makeParticles(itemAnim(it).particles, it.id.length * 97 + seq.length) });
    t += dur;
  }
  return { seq, total: t };
}
function drawSeqFrame(ctx, OW, OH, m, S2, t, lang, bg, dt) {
  ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, OW, OH);
  const { seq } = S2; if (!seq.length) return;
  let i = seq.findIndex(s => t >= s.start && t < s.start + s.dur); if (i < 0) i = t <= 0 ? 0 : seq.length - 1;
  const s = seq[i]; const local = t - s.start;
  // fondo desenfocado del panel actual
  if (s.bmp && CAN_FILTER) { ctx.save(); ctx.filter = 'blur(28px) brightness(45%)'; const k = Math.max(OW / s.bmp.width, OH / s.bmp.height) * 1.1; ctx.drawImage(s.bmp, (OW - s.bmp.width * k) / 2, (OH - s.bmp.height * k) / 2, s.bmp.width * k, s.bmp.height * k); ctx.restore(); }
  const enter = itemAnim(s.it).enter;
  if (i > 0 && local < 0.45 && (enter === 'fade' || enter === 'zoom')) { const pv = seq[i - 1]; drawAnimItem(ctx, m, pv.it, pv.bmp, 0, OH * 0.06, OW, OH * 0.86, pv.dur, pv.dur, lang, bg, null, { noEnter: true, alpha: 1 - ease(local / 0.45), dt: 0 }); }
  drawAnimItem(ctx, m, s.it, s.bmp, 0, OH * 0.06, OW, OH * 0.86, local, s.dur, lang, bg, s.P, { dt });
}
/* ---------- sonidos y música generados con código ---------- */
const SFX_TYPES = { boom: '💥 Boom', golpe: '👊 Golpe', slash: '⚔️ Slash', whoosh: '💨 Whoosh', crack: '🪨 Crack', pop: '🫧 Pop', subida: '📈 Subida (riser)', trueno: '⛈️ Trueno', campana: '🔔 Campana', latido: '❤️ Latido' };
const MUSIC_STYLES = { epica: '⚔️ Épica', tensa: '😰 Tensa', tranquila: '🌙 Tranquila', accion: '🔥 Acción', misterio: '🕯️ Misterio' };
function noiseBuf(ac, sec) { const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * sec)), ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function env(g, t, a, peak, dcy, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + dcy); }
function synthSFX(ac, type, t, out, vol = 1) {
  const g = ac.createGain(); g.connect(out); const V = vol;
  const tone = (f0, f1, d, wave = 'sine', peak = 0.8) => { const o = ac.createOscillator(); const gg = ac.createGain(); o.type = wave; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + d); env(gg, t, 0.005, peak * V, d); o.connect(gg); gg.connect(g); o.start(t); o.stop(t + d + 0.05); };
  const noise = (d, fType, f0, f1, peak = 0.6, q = 1) => { const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, d + 0.1); const f = ac.createBiquadFilter(); f.type = fType; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d); const gg = ac.createGain(); env(gg, t, 0.004, peak * V, d); n.connect(f); f.connect(gg); gg.connect(g); n.start(t); n.stop(t + d + 0.1); };
  switch (type) {
    case 'boom': tone(120, 30, 1.2, 'sine', 1); noise(0.9, 'lowpass', 1200, 60, 0.9); break;
    case 'golpe': tone(180, 50, 0.25, 'triangle', 0.9); noise(0.18, 'bandpass', 1800, 400, 0.8, 1.5); break;
    case 'slash': noise(0.35, 'bandpass', 900, 7000, 0.7, 4); tone(2400, 5200, 0.2, 'sawtooth', 0.08); break;
    case 'whoosh': noise(0.6, 'bandpass', 300, 3500, 0.5, 2); break;
    case 'crack': noise(0.12, 'highpass', 3000, 1200, 1); tone(400, 90, 0.18, 'square', 0.25); break;
    case 'pop': tone(500, 1400, 0.09, 'sine', 0.6); break;
    case 'subida': { const o = ac.createOscillator(); o.type = 'sawtooth'; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(6000, t + 2); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + 2); const gg = ac.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.35 * V, t + 1.9); gg.gain.exponentialRampToValueAtTime(0.0001, t + 2.05); o.connect(f); f.connect(gg); gg.connect(g); o.start(t); o.stop(t + 2.1); noise(2, 'highpass', 500, 8000, 0.15); break; }
    case 'trueno': noise(2.5, 'lowpass', 2500, 80, 1); tone(60, 30, 2, 'sine', 0.6); break;
    case 'campana': [1, 2.76, 5.4].forEach((k, i) => tone(660 * k, 660 * k, 2.2 - i * 0.5, 'sine', 0.35 / (i + 1))); break;
    case 'latido': [0, 0.28].forEach(d => { const o = ac.createOscillator(); const gg = ac.createGain(); o.frequency.setValueAtTime(70, t + d); o.frequency.exponentialRampToValueAtTime(40, t + d + 0.15); env(gg, t + d, 0.01, 0.9 * V, 0.18); o.connect(gg); gg.connect(g); o.start(t + d); o.stop(t + d + 0.3); }); break;
  }
}
function sfxForText(txt) { const s = norm(txt); if (/boom|bum|kaboom|explo|쾅/.test(s)) return 'boom'; if (/slash|shing|zas|corte|swish/.test(s)) return 'slash'; if (/whoosh|fiu|zoom|vuum|swoo/.test(s)) return 'whoosh'; if (/crack|crac|krak/.test(s)) return 'crack'; if (/pum|pow|bam|paf|golpe|thud|punch|wham|smash/.test(s)) return 'golpe'; if (/pop/.test(s)) return 'pop'; if (/ba dum|dokin|latido|thump/.test(s)) return 'latido'; return 'golpe'; }
async function renderSFXBuffer(type, sec = null) {
  const len = sec || ({ boom: 1.6, trueno: 2.8, subida: 2.2, campana: 2.4 }[type] || 0.9);
  const ac = new OfflineAudioContext(2, Math.ceil(44100 * len), 44100); const out = ac.createGain(); out.connect(ac.destination);
  synthSFX(ac, type, 0.01, out, 1); return ac.startRendering();
}
async function renderMusic(style, sec) {
  sec = Math.max(2, Math.min(600, sec)); const sr = 44100;
  const ac = new OfflineAudioContext(2, Math.ceil(sr * sec), sr); const master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.connect(master); const out = comp;
  const bpm = { epica: 84, tensa: 100, tranquila: 70, accion: 140, misterio: 64 }[style] || 90; const beat = 60 / bpm;
  const chords = { epica: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]], tensa: [[45, 52, 55, 60], [45, 51, 55, 58]], tranquila: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]], accion: [[52, 59, 64, 67], [48, 55, 60, 64], [50, 57, 62, 65], [47, 54, 59, 62]], misterio: [[45, 48, 52, 56], [44, 47, 51, 55]] }[style] || [[57, 60, 64]];
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const pad = (notes, t, d, wave, vol, cut) => notes.forEach(n => { const o = ac.createOscillator(); o.type = wave; o.frequency.value = hz(n); o.detune.value = (Math.random() - 0.5) * 12; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.6, d * 0.3)); g.gain.setValueAtTime(vol, t + d * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + d); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05); });
  const kick = t => { const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); env(g, t, 0.003, 0.9, 0.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35); };
  const snare = t => { const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, 0.25); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; const g = ac.createGain(); env(g, t, 0.002, 0.45, 0.18); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.25); };
  const hat = (t, v = 0.12) => { const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, 0.06); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ac.createGain(); env(g, t, 0.001, v, 0.04); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.06); };
  const tom = (t, f0) => { const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.4); env(g, t, 0.003, 0.7, 0.45); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5); };
  const bass = (n, t, d, v = 0.35) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n - 12); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ac.createGain(); env(g, t, 0.01, v, d * 0.9); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + d); };
  const bar = beat * 4; const nBars = Math.ceil(sec / bar);
  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar; const ch = chords[b % chords.length];
    if (style === 'epica') { pad(ch, t0, bar, 'sawtooth', 0.05, 1400); bass(ch[0], t0, bar, 0.3); for (let k = 0; k < 4; k++) { tom(t0 + k * beat, k % 2 ? 90 : 70); if (k === 3) tom(t0 + k * beat + beat / 2, 110); } if (b % 2) snare(t0 + beat * 3.5); }
    else if (style === 'tensa') { pad(ch, t0, bar, 'triangle', 0.04, 900); for (let k = 0; k < 8; k++) { bass(ch[0], t0 + k * beat / 2, beat / 2, 0.28); hat(t0 + k * beat / 2, 0.06); } if (b % 2) kick(t0); }
    else if (style === 'tranquila') { pad(ch, t0, bar, 'sine', 0.06, 2500); for (let k = 0; k < 8; k++) { const n = ch[k % ch.length] + 12; const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(n); const g = ac.createGain(); env(g, t0 + k * beat / 2, 0.01, 0.06, beat * 0.9); o.connect(g); g.connect(out); o.start(t0 + k * beat / 2); o.stop(t0 + k * beat / 2 + beat); } }
    else if (style === 'accion') { pad(ch, t0, bar, 'sawtooth', 0.035, 2000); for (let k = 0; k < 8; k++) { bass(ch[0] + (k % 4 === 3 ? 3 : 0), t0 + k * beat / 2, beat / 2, 0.32); hat(t0 + k * beat / 2); } [0, 2].forEach(k => kick(t0 + k * beat)); [1, 3].forEach(k => snare(t0 + k * beat)); kick(t0 + 2.5 * beat); }
    else { pad(ch, t0, bar, 'sine', 0.05, 700); if (b % 2 === 0) { const o = ac.createOscillator(); o.frequency.value = hz(ch[3] + 24); const g = ac.createGain(); env(g, t0 + beat, 0.005, 0.12, 2.5); o.connect(g); g.connect(out); o.start(t0 + beat); o.stop(t0 + beat + 2.6); } }
  }
  const buf = await ac.startRendering();
  // fade out final
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); const n = Math.min(d.length, sr * 1.5); for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n; }
  return buf;
}
function audioBufferToWavBlob(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length; const b = new ArrayBuffer(44 + n * ch * 2), v = new DataView(b); const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }
  return new Blob([b], { type: 'audio/wav' });
}
/* banda sonora del manhwa animado: música + efectos automáticos */
async function manhwaSoundtrack(S2, lang, music, musicFileBuf, autoSfx = true) {
  const sr = 44100; const total = Math.max(1, S2.total + 0.5);
  const ac = new OfflineAudioContext(2, Math.ceil(sr * total), sr); const out = ac.createGain(); out.connect(ac.destination);
  if (music && music !== 'none') {
    let mb = musicFileBuf; if (!mb && MUSIC_STYLES[music]) mb = await renderMusic(music, total);
    if (mb) { const s = ac.createBufferSource(); s.buffer = mb; s.loop = !musicFileBuf ? false : true; const g = ac.createGain(); g.gain.value = 0.55; g.gain.setValueAtTime(0.55, Math.max(0, total - 1.5)); g.gain.linearRampToValueAtTime(0.0001, total); s.connect(g); g.connect(out); s.start(0); }
  }
  if (autoSfx) for (const s of S2.seq) {
    const a = itemAnim(s.it); if (a.shake) synthSFX(ac, 'boom', s.start + 0.02, out, 0.8);
    else if (a.enter !== 'none') synthSFX(ac, 'whoosh', s.start, out, 0.25);
    for (const { L, t0 } of layerTimes(s.it, lang)) { if (L.kind === 'sfx') synthSFX(ac, sfxForText(layerText(L, lang)), s.start + t0, out, 0.8); else if (layerAnimType(L) === 'pop' && L.kind !== 'sticker') synthSFX(ac, 'pop', s.start + t0, out, 0.18); }
  }
  return ac.startRendering();
}
/* ---------- grabar video desde un canvas (MP4 si el navegador puede, si no WebM) ---------- */
function pickVideoMime() { const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || ''; }
async function recordCanvas({ canvas, duration, drawAt, audioBuffer, onProgress, fps = 30, signal }) {
  if (!window.MediaRecorder || !canvas.captureStream) throw new Error('Tu navegador no puede grabar video. Usa Chrome o Edge en computadora.');
  const mime = pickVideoMime(); const stream = canvas.captureStream(fps);
  const ac = new AudioContext(); const dest = ac.createMediaStreamDestination();
  let src = null; if (audioBuffer) { src = ac.createBufferSource(); src.buffer = audioBuffer; src.connect(dest); }
  // pista silenciosa para que siempre haya audio
  const osc = ac.createOscillator(); const og = ac.createGain(); og.gain.value = 0; osc.connect(og); og.connect(dest); osc.start();
  dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 9e6, audioBitsPerSecond: 160000 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  drawAt(0); await sleep(120);
  await ac.resume(); rec.start(250); const t0 = ac.currentTime + 0.05; if (src) src.start(t0);
  let last = 0;
  await new Promise(res => {
    const tick = () => {
      if (signal?.aborted) return res();
      const t = Math.max(0, ac.currentTime - t0);
      drawAt(Math.min(t, duration), t - last); last = t; onProgress && onProgress(Math.min(1, t / duration));
      if (t >= duration + 0.1) return res();
      if (document.hidden) setTimeout(tick, 1000 / fps); else requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop(); await done; osc.stop(); ac.close();
  if (signal?.aborted) throw new Error('Cancelado');
  const type = (mime || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
}

/* ---------- Vista previa animada del capítulo ---------- */
ACT.bAnimPreview = async el => {
  const m = cur(); const c = chapterById(m, Route.a); const only = el?.dataset?.only || null;
  if (!c.layout.items.length) return toast('No hay paneles', 'err');
  let lang = BSEL.lang; let music = 'none'; let musicFile = null;
  const bg = modal(`<div class="row between"><h2>▶️ Vista previa animada${only ? ' · un panel' : ''}</h2><button class="sm" data-x="close">Cerrar</button></div>
    <div style="display:flex;justify-content:center"><canvas id="apC" width="1080" height="1920" style="height:62vh;max-width:100%;border-radius:14px;background:#000"></canvas></div>
    <div class="row nw"><button class="pri playbtn" id="apPlay">▶</button><input id="apSeek" type="range" min="0" max="100" step="0.01" value="0" class="grow"><span id="apT" class="small mono">0:00</span></div>
    <div class="row"><span class="small muted">Idioma</span>${['es', 'en', 'ko'].map(l => `<button class="sm ${l === lang ? 'pri' : ''}" data-pl="${l}">${l.toUpperCase()}</button>`).join('')}
      <label class="f" style="width:auto">Música<select id="apMus"><option value="none">Sin música</option>${Object.entries(MUSIC_STYLES).map(([k, v]) => `<option value="${k}">${v} (hecha con código)</option>`).join('')}<option value="file">📤 Subir mi canción…</option></select></label>
      <label class="row nw small"><input type="checkbox" id="apSfx" checked> Sonidos automáticos (golpes, POP)</label></div>
    <div class="acts"><button class="pri" data-x="exp">🎬 Exportar este video para TikTok</button></div>`, { wide: true, onClose: () => stop() });
  const cv = bg.querySelector('#apC'); const ctx = cv.getContext('2d');
  let S2 = null, playing = false, t = 0, raf = 0, ac = null, src = null, t0 = 0, sound = null, lastT = 0;
  const load = async () => { S2 = await buildSeq(m, c, lang, only); bg.querySelector('#apSeek').max = S2.total; draw(); sound = null; };
  const draw = (dt = 0) => { if (!S2) return; drawSeqFrame(ctx, 1080, 1920, m, S2, t, lang, c.layout.bg, dt); bg.querySelector('#apT').textContent = fmtDur(t) + ' / ' + fmtDur(S2.total); bg.querySelector('#apSeek').value = t; };
  const stop = () => { playing = false; cancelAnimationFrame(raf); try { src?.stop(); } catch (e) { } try { ac?.close(); } catch (e) { } ac = null; bg.querySelector('#apPlay').textContent = '▶'; };
  const play = async () => {
    if (!S2) return; if (t >= S2.total) t = 0;
    playing = true; bg.querySelector('#apPlay').textContent = '⏸';
    ac = new AudioContext();
    try { if (!sound) sound = await manhwaSoundtrack(S2, lang, music, musicFile, bg.querySelector('#apSfx').checked); src = ac.createBufferSource(); src.buffer = sound; src.connect(ac.destination); } catch (e) { src = null; }
    t0 = ac.currentTime - t; if (src) src.start(0, t); lastT = t;
    const loop = () => { if (!playing) return; t = ac.currentTime - t0; draw(t - lastT); lastT = t; if (t >= S2.total) { t = S2.total; draw(); return stop(); } raf = requestAnimationFrame(loop); };
    loop();
  };
  bg.querySelector('#apPlay').onclick = () => playing ? stop() : play();
  bg.querySelector('#apSeek').oninput = e => { const was = playing; stop(); t = +e.target.value; S2?.seq.forEach(s => s.P = makeParticles(itemAnim(s.it).particles, 9)); draw(); if (was) play(); };
  bg.querySelector('[data-x=close]').onclick = () => { stop(); bg.close(); };
  bg.querySelectorAll('[data-pl]').forEach(b => b.onclick = async () => { stop(); lang = b.dataset.pl; bg.querySelectorAll('[data-pl]').forEach(x => x.classList.toggle('pri', x === b)); await load(); });
  bg.querySelector('#apMus').onchange = async e => { stop(); sound = null; if (e.target.value === 'file') { const [f] = await pickFiles({ multiple: false, accept: 'audio/*' }); if (!f) { e.target.value = 'none'; music = 'none'; return; } try { musicFile = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await f.arrayBuffer()); music = 'file'; toast('Canción cargada'); } catch (er) { toast('No pude leer ese audio', 'err'); e.target.value = 'none'; music = 'none'; } } else { music = e.target.value; musicFile = null; } };
  bg.querySelector('#apSfx').onchange = () => { stop(); sound = null; };
  bg.querySelector('[data-x=exp]').onclick = () => { stop(); bg.close(); exportAnimated(m, c, lang, { music, musicFile, autoSfx: true, only }); };
  await load();
};
/* ---------- Exportar MANHWA ANIMADO para TikTok (video) ---------- */
async function exportAnimated(m, c, lang, { music = 'none', musicFile = null, autoSfx = true, only = null } = {}) {
  const ctl = new AbortController();
  const bg = modal(`<h2>🎬 Creando tu manhwa animado</h2><p class="small muted">Se graba en tiempo real a 1080×1920 (dura lo mismo que el video). Deja esta pestaña abierta y visible.</p>
    <div class="bar"><i id="rcBar" style="width:0%"></i></div><div id="rcTxt" class="small muted">Preparando…</div><div class="acts"><button data-x="no" class="danger">Cancelar</button></div>`, { onClose: () => ctl.abort() });
  bg.querySelector('[data-x=no]').onclick = () => { ctl.abort(); bg.remove(); };
  try {
    const S2 = await buildSeq(m, c, lang, only);
    bg.querySelector('#rcTxt').textContent = 'Preparando música y efectos…';
    const sound = await manhwaSoundtrack(S2, lang, music, musicFile, autoSfx);
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const ctx = cv.getContext('2d');
    const { blob, ext } = await recordCanvas({ canvas: cv, duration: S2.total, audioBuffer: sound, signal: ctl.signal, drawAt: (t, dt) => drawSeqFrame(ctx, 1080, 1920, m, S2, t, lang, c.layout.bg, dt || 1 / 30), onProgress: p => { const b = bg.querySelector('#rcBar'); if (b) { b.style.width = Math.round(p * 100) + '%'; bg.querySelector('#rcTxt').textContent = `Grabando… ${Math.round(p * 100)}% (${fmtDur(p * S2.total)} de ${fmtDur(S2.total)})`; } } });
    bg.remove();
    downloadBlob(blob, `${safeName(m.name)}_cap${c.number}_animado_${lang}.${ext}`);
    toast(`Video listo (${ext.toUpperCase()}, ${(blob.size / 1e6).toFixed(1)} MB) 🎬${ext === 'webm' ? ' — TikTok acepta MP4; si no lo sube, usa Chrome actualizado o conviértelo.' : ''}`, 'ok');
  } catch (e) { bg.remove(); if (e.message !== 'Cancelado') toast(e.message, 'err'); }
}
