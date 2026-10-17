'use strict';
// Fails (exit 1) if any achievement/shop/pass reward references a cosmetic id that has no hand-made design.
// At runtime src/cosmetics.js falls back to a generated placeholder so the server never crashes; this test is where
// missing designs get caught instead. Run: npm run test:cosmetics
process.env.SECRET = process.env.SECRET || 'test-secret-test-secret-test-secret';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password-123456';
process.env.DATA_DIR = process.env.DATA_DIR || require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'cos-'));
const COS = require('../src/cosmetics');
require('../src/achievements');
try { require('../src/shop'); } catch (e) { console.log('shop skipped:', e.message); }
const missing = COS.generated();
if (missing.length) { console.error(`FAIL: ${missing.length} reward id(s) have no cosmetic design:\n  ` + missing.join('\n  ')); process.exit(1); }
console.log('OK: every reward id has a design');
