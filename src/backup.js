'use strict';
// SQLite backups: consistent online snapshot (SQLite backup API via better-sqlite3), gzip, keep the newest
// BACKUP_KEEP (default 5, and at most BACKUP_MAX_MB = 75 MB in total) in $DATA_DIR/backups, and optionally push off-site to a GitHub branch.
//
// Off-site (optional): set BACKUP_GITHUB_TOKEN (fine-grained PAT, one repo, Contents: read & write) and
// BACKUP_GITHUB_REPO=owner/name (default: TheTavern001/gaming-hub-backups), BACKUP_GITHUB_BRANCH (default: backups).
// Each push replaces the branch with ONE orphan commit holding the newest BACKUP_GITHUB_KEEP (default 5) backups,
// so the backup repo does not grow forever (older blobs become unreachable and are garbage-collected by GitHub).
// Memory: everything is streamed (file -> gzip -> file, file -> base64 -> HTTPS); nothing is buffered whole.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream/promises');
const cfg = require('./config');
const db = require('./db');

const DIR = process.env.BACKUP_DIR || path.join(path.dirname(cfg.DB_PATH), 'backups');
const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP || '5', 10) || 5);
const INTERVAL_H = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24));
const GH = {
  token: process.env.BACKUP_GITHUB_TOKEN || '',
  repo: process.env.BACKUP_GITHUB_REPO || 'TheTavern001/gaming-hub-backups',
  branch: process.env.BACKUP_GITHUB_BRANCH || 'backups',
  keep: Math.max(1, parseInt(process.env.BACKUP_GITHUB_KEEP || '5', 10) || 5),
  api: new URL(process.env.BACKUP_GITHUB_API || 'https://api.github.com'), // override only for tests (mock server)
};
const NAME_RE = /^hub-\d{8}-\d{6}Z(-[a-z]+)?\.db\.gz$/;
const STATUS_FILE = path.join(DIR, 'status.json');
let running = null;

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\.\d+Z$/, 'Z');
function readStatus() { try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { return {}; } }
function writeStatus(s) { try { fs.writeFileSync(STATUS_FILE + '.tmp', JSON.stringify(s, null, 1)); fs.renameSync(STATUS_FILE + '.tmp', STATUS_FILE); } catch (e) { console.error('[backup] status', e.message); } }
function list() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => NAME_RE.test(f)).map(f => { const st = fs.statSync(path.join(DIR, f)); return { name: f, size: st.size, created_at: st.mtimeMs }; }); } catch {}
  return files.sort((a, b) => b.name.localeCompare(a.name));
}
// Keep the newest KEEP backups, and fewer if they would use more than BACKUP_MAX_MB in total (the newest is always kept).
const MAX_BYTES = Math.max(1, Number(process.env.BACKUP_MAX_MB || 75)) * 1048576;
function rotate() {
  let total = 0;
  list().forEach((f, i) => { total += f.size; if (i >= KEEP || (i > 0 && total > MAX_BYTES)) { try { fs.unlinkSync(path.join(DIR, f.name)); } catch {} } });
}
const fileOf = (name) => (NAME_RE.test(String(name)) ? path.join(DIR, name) : null);

async function snapshot(reason) {
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) if (f.startsWith('.tmp-')) { try { fs.unlinkSync(path.join(DIR, f)); } catch {} }
  // free-space check: the raw copy + its gzip must fit next to the live DB
  const dbSize = fs.statSync(cfg.DB_PATH).size;
  try { const s = fs.statfsSync(DIR); const free = s.bavail * s.bsize; if (free < dbSize * 1.3 + 1048576) throw new Error(`not enough free disk for a backup (${Math.round(free / 1048576)} MB free, DB is ${Math.round(dbSize / 1048576)} MB)`); } catch (e) { if (/free disk/.test(e.message)) throw e; }
  const name = `hub-${stamp()}${reason && reason !== 'manual' ? '-' + reason.replace(/[^a-z]/g, '') : ''}.db.gz`;
  const tmp = path.join(DIR, `.tmp-${process.pid}-${Date.now()}.db`);
  try {
    await db.backup(tmp); // SQLite online backup API: consistent copy while the app keeps writing
    await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 6, memLevel: 7 }), fs.createWriteStream(path.join(DIR, name + '.part')));
    fs.renameSync(path.join(DIR, name + '.part'), path.join(DIR, name));
  } finally { try { fs.unlinkSync(tmp); } catch {} try { fs.unlinkSync(path.join(DIR, name + '.part')); } catch {} }
  rotate();
  const st = fs.statSync(path.join(DIR, name));
  return { name, size: st.size, db_size: dbSize, created_at: st.mtimeMs };
}

// ---------- GitHub (REST, git database API) ----------
function gh(method, p, body, { stream } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'gaming-hub-backup', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${GH.token}` };
    let payload = null;
    if (stream) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = stream.length; }
    else if (body !== undefined) { payload = Buffer.from(JSON.stringify(body)); headers['Content-Type'] = 'application/json'; headers['Content-Length'] = payload.length; }
    const mod = GH.api.protocol === 'http:' ? http : https;
    const req = mod.request({ host: GH.api.hostname, port: GH.api.port || undefined, method, path: p, headers, timeout: 120e3 }, (res) => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(txt); } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
        else { const e = new Error(`GitHub ${method} ${p.replace(/\?.*/, '')} -> ${res.statusCode} ${json && json.message ? json.message : txt.slice(0, 120)}`); e.status = res.statusCode; reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('GitHub request timed out'))); req.on('error', reject);
    if (stream) stream.write(req).then(() => req.end(), (e) => req.destroy(e)); else req.end(payload);
  });
}
// JSON body {"encoding":"base64","content":"<base64 of file>"} streamed from disk (3-byte aligned chunks)
function blobStream(file) {
  const size = fs.statSync(file).size; const pre = '{"encoding":"base64","content":"'; const post = '"}';
  return { length: Buffer.byteLength(pre) + 4 * Math.ceil(size / 3) + Buffer.byteLength(post), async write(req) {
    const w = (b) => new Promise(r => (req.write(b) ? r() : req.once('drain', r)));
    await w(pre); let carry = Buffer.alloc(0);
    for await (const chunk of fs.createReadStream(file, { highWaterMark: 48 * 1024 })) {
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk; const n = buf.length - (buf.length % 3);
      if (n) await w(buf.subarray(0, n).toString('base64')); carry = Buffer.from(buf.subarray(n));
    }
    if (carry.length) await w(carry.toString('base64'));
    await w(post);
  } };
}
const README = `# Gaming Hub database backups\n\nAutomatic gzip'd SQLite snapshots pushed by the app (src/backup.js). This branch is rewritten on every\nbackup as a single commit holding the newest backups only.\n\nRestore: download a file, \`gunzip hub-....db.gz\`, check it with \`sqlite3 hub-....db 'PRAGMA integrity_check'\`,\nthen place it as hub.db in DATA_DIR while the app is stopped (see DEPLOY-DEPLEXO.md).\n`;
async function pushGithub(file, name) {
  const R = `/repos/${GH.repo}`;
  const blob = await gh('POST', `${R}/git/blobs`, undefined, { stream: blobStream(file) });
  let entries = []; let exists = true;
  try {
    const ref = await gh('GET', `${R}/git/ref/heads/${encodeURIComponent(GH.branch)}`);
    const commit = await gh('GET', `${R}/git/commits/${ref.object.sha}`);
    const tree = await gh('GET', `${R}/git/trees/${commit.tree.sha}?recursive=1`);
    entries = (tree.tree || []).filter(t => t.type === 'blob' && /^backups\/hub-.*\.db\.gz$/.test(t.path) && t.path !== `backups/${name}`);
  } catch (e) { if (e.status === 404 || e.status === 409) exists = false; else throw e; }
  entries.sort((a, b) => b.path.localeCompare(a.path));
  const keep = entries.slice(0, GH.keep - 1).map(t => ({ path: t.path, mode: '100644', type: 'blob', sha: t.sha }));
  const tree = await gh('POST', `${R}/git/trees`, { tree: [{ path: 'README.md', mode: '100644', type: 'blob', content: README }, { path: `backups/${name}`, mode: '100644', type: 'blob', sha: blob.sha }, ...keep] });
  const commit = await gh('POST', `${R}/git/commits`, { message: `backup ${name}`, tree: tree.sha, parents: [] });
  if (exists) await gh('PATCH', `${R}/git/refs/heads/${encodeURIComponent(GH.branch)}`, { sha: commit.sha, force: true });
  else await gh('POST', `${R}/git/refs`, { ref: `refs/heads/${GH.branch}`, sha: commit.sha });
  return { repo: GH.repo, branch: GH.branch, commit: commit.sha, files: keep.length + 1 };
}

// Create a backup (and push it when a token is configured). One at a time.
function run(reason = 'manual', { push = true } = {}) {
  if (running) return running;
  running = (async () => {
    const t0 = Date.now(); const status = readStatus();
    const out = { ok: true, reason, at: t0 };
    try { Object.assign(out, await snapshot(reason)); }
    catch (e) { out.ok = false; out.error = e.message; status.last_error = { at: t0, error: e.message }; writeStatus(status); console.error('[backup] failed:', e.message); return out; }
    status.last_local = { at: t0, name: out.name, size: out.size, reason };
    if (push && GH.token) {
      try { out.github = { ok: true, ...(await pushGithub(path.join(DIR, out.name), out.name)) }; status.last_github = { at: Date.now(), ok: true, name: out.name, commit: out.github.commit }; }
      catch (e) { out.github = { ok: false, error: e.message }; status.last_github = { at: Date.now(), ok: false, name: out.name, error: e.message }; console.error('[backup] GitHub push failed:', e.message); }
    }
    out.ms = Date.now() - t0; writeStatus(status);
    console.log(`[backup] ${out.name} (${Math.round(out.size / 1024)} KB gz, ${out.ms} ms)${out.github ? ` github: ${out.github.ok ? 'ok' : out.github.error}` : ''}`);
    return out;
  })().finally(() => { running = null; });
  return running;
}
function info() {
  return { dir: DIR, keep: KEEP, max_mb: Math.round(MAX_BYTES / 1048576), interval_hours: INTERVAL_H, running: !!running, backups: list(), status: readStatus(),
    github: { enabled: !!GH.token, repo: GH.repo, branch: GH.branch, keep: GH.keep } };
}
// Daily schedule: checks every 30 min whether the newest backup is older than BACKUP_INTERVAL_HOURS.
function schedule() {
  if (process.env.BACKUP_DISABLE === '1') return;
  const tick = () => {
    const last = Math.max(readStatus().last_local?.at || 0, ...list().map(f => f.created_at), 0);
    if (Date.now() - last >= INTERVAL_H * 3600e3) run('daily').catch(() => {});
  };
  setTimeout(tick, 2 * 60e3).unref(); setInterval(tick, 30 * 60e3).unref();
}
module.exports = { run, info, list, fileOf, schedule, DIR };
