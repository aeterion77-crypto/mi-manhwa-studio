#!/usr/bin/env node
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

function runClaude(prompt, model) {
  return new Promise((ok, fail) => {
    const mdl = ['opus', 'sonnet', 'haiku'].includes(model) ? ['--model', model] : [];
    const p = spawn(BIN, ['-p', 'Sigue las instrucciones que llegan por la entrada estándar.', '--output-format', 'json', ...mdl, ...EXTRA], { cwd: CWD, shell: process.platform === 'win32' });
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

// trabajos: el resultado se guarda aunque cierres o recargues la app
const JOBS_FILE = join(CWD, '.trabajos-puente.json');
let JOBS = {}; try { JOBS = JSON.parse(readFileSync(JOBS_FILE, 'utf8')); } catch {}
for (const j of Object.values(JOBS)) if (j.status === 'running') { j.status = 'error'; j.error = 'El puente se cerró mientras trabajaba. Vuelve a intentarlo.'; }
function saveJobs() { const now = Date.now(); for (const [k, j] of Object.entries(JOBS)) if (now - j.at > 3 * 24 * 3600 * 1000) delete JOBS[k]; try { writeFileSync(JOBS_FILE, JSON.stringify(JOBS)); } catch {} }
function startJob(prompt, title, model) {
  const id = randomBytes(8).toString('hex'); JOBS[id] = { status: 'running', title: String(title || 'tarea'), at: Date.now() }; saveJobs();
  console.log('🤖 Claude Code trabajando' + (model ? ' (' + model + ')' : '') + ': ' + JOBS[id].title + '…');
  runClaude(String(prompt || ''), model).then(out => { JOBS[id] = { ...JOBS[id], status: 'done', text: typeof out === 'string' ? out : JSON.stringify(out), done: Date.now() }; console.log('   ✔ listo: ' + JOBS[id].title); saveJobs(); })
    .catch(e => { JOBS[id] = { ...JOBS[id], status: 'error', error: e.message, done: Date.now() }; console.log('   ✕ ' + e.message); saveJobs(); });
  return id;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.headers['x-token'] !== TOKEN) return send(res, 401, { error: 'Llave incorrecta' });
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/status') return send(res, 200, { ok: true, cwd: CWD, bin: BIN, ask: true, jobs: true, models: true });
  if (req.method === 'GET' && url.pathname === '/file') { // archivos que Claude Code genere en la carpeta (por ejemplo un video renderizado)
    const p = resolve(CWD, url.searchParams.get('path') || '');
    if (!p.startsWith(CWD + sep) || !existsSync(p) || !statSync(p).isFile()) return send(res, 404, { error: 'No existe' });
    const types = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
    res.writeHead(200, { ...cors, 'Content-Type': types[extname(p)] || 'application/octet-stream' }); return createReadStream(p).pipe(res);
  }
  if (req.method === 'POST' && url.pathname === '/job') {
    let body = ''; for await (const ch of req) body += ch;
    let j; try { j = JSON.parse(body); } catch { return send(res, 400, { error: 'JSON inválido' }); }
    return send(res, 200, { id: startJob(j.prompt, j.title, j.model) });
  }
  if (req.method === 'GET' && url.pathname === '/job') {
    const j = JOBS[url.searchParams.get('id') || '']; if (!j) return send(res, 404, { error: 'No encontré ese trabajo' });
    return send(res, 200, { status: j.status, text: j.status === 'done' ? j.text : undefined, error: j.error, at: j.at, done: j.done });
  }
  if (req.method === 'POST' && url.pathname === '/ask') { // la app le pide a tu Claude Code cualquier tarea de texto (biblia, guiones, ideas…)
    let body = ''; for await (const ch of req) body += ch;
    let j; try { j = JSON.parse(body); } catch { return send(res, 400, { error: 'JSON inválido' }); }
    try { console.log('🤖 Claude Code trabajando: ' + String(j.title || 'tarea') + '…'); const out = await runClaude(String(j.prompt || ''), j.model); console.log('   ✔ listo'); return send(res, 200, { text: typeof out === 'string' ? out : JSON.stringify(out) }); }
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
