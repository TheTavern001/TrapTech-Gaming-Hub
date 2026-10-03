// Minimal mock of the GitHub git-database REST API used by src/backup.js (blobs, trees, commits, refs), for testing
// the off-site backup push without a real token. Checks the Bearer token, stores blobs in memory, and on GET /_state
// reports the branch's files with sizes and sha256 so a test can compare them with the local backups.
// Usage: PORT=8820 TOKEN=test-token node tools/deplexo/mock-github.js   then run the app with
//   BACKUP_GITHUB_TOKEN=test-token BACKUP_GITHUB_API=http://127.0.0.1:8820 BACKUP_GITHUB_REPO=o/r
'use strict';
const http = require('http'); const crypto = require('crypto');
const PORT = +process.env.PORT || 8820; const TOKEN = process.env.TOKEN || 'test-token';
const objs = new Map(); const refs = new Map(); const log = [];
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
let empty = process.env.EMPTY === '1'; // EMPTY=1 mimics a repo with no commits (GitHub answers 409 to blob creation)
http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null; const u = req.url.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const send = (code, j) => { log.push(`${req.method} ${u.replace(/\?.*/, '')} ${code}`); res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (req.url === '/_state') {
      const files = []; const head = refs.get('refs/heads/backups');
      if (head) for (const t of objs.get(objs.get(head).tree).tree) { const b = objs.get(t.sha); files.push({ path: t.path, size: b ? b.data.length : null, sha256: b ? crypto.createHash('sha256').update(b.data).digest('hex') : null }); }
      return send(200, { refs: Object.fromEntries(refs), head, parents: head ? objs.get(head).parents : null, files, log: log.slice() });
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { message: 'Bad credentials' });
    if (req.method === 'POST' && u === '/git/blobs') { if (empty) return send(409, { message: 'Git Repository is empty.' }); const data = Buffer.from(body.content, body.encoding === 'base64' ? 'base64' : 'utf8'); const s = sha(data); objs.set(s, { type: 'blob', data }); return send(201, { sha: s }); }
    let m;
    if (req.method === 'GET' && (m = u.match(/^\/git\/ref\/heads\/(.+)$/))) { const r = refs.get('refs/heads/' + decodeURIComponent(m[1])); return r ? send(200, { ref: 'refs/heads/' + m[1], object: { sha: r, type: 'commit' } }) : send(404, { message: 'Not Found' }); }
    if (req.method === 'GET' && (m = u.match(/^\/git\/commits\/(\w+)$/))) { const c = objs.get(m[1]); return c ? send(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents }) : send(404, { message: 'Not Found' }); }
    if (req.method === 'GET' && (m = u.match(/^\/git\/trees\/(\w+)/))) { const t = objs.get(m[1]); return t ? send(200, { sha: m[1], tree: t.tree }) : send(404, { message: 'Not Found' }); }
    if (req.method === 'POST' && u === '/git/trees') {
      const tree = body.tree.map(e => { if (e.content !== undefined) { const d = Buffer.from(e.content); const s = sha(d); objs.set(s, { type: 'blob', data: d }); return { path: e.path, mode: e.mode, type: 'blob', sha: s }; } if (!objs.has(e.sha)) throw new Error('missing ' + e.sha); return { path: e.path, mode: e.mode, type: 'blob', sha: e.sha }; });
      const s = sha(JSON.stringify(tree)); objs.set(s, { type: 'tree', tree }); return send(201, { sha: s });
    }
    if (req.method === 'POST' && u === '/git/commits') { const s = sha(JSON.stringify(body) + Date.now()); objs.set(s, { type: 'commit', tree: body.tree, parents: body.parents, message: body.message }); return send(201, { sha: s }); }
    if (req.method === 'POST' && u === '/git/refs') { refs.set(body.ref, body.sha); return send(201, { ref: body.ref, object: { sha: body.sha } }); }
    if (req.method === 'PATCH' && (m = u.match(/^\/git\/refs\/heads\/(.+)$/))) { refs.set('refs/heads/' + decodeURIComponent(m[1]), body.sha); return send(200, { object: { sha: body.sha } }); }
    send(404, { message: 'Not Found ' + req.method + ' ' + u });
  });
}).listen(PORT, '127.0.0.1', () => console.log('mock github on', PORT));
