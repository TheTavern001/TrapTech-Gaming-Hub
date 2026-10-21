'use strict';
// Achievement system. Server-evaluated only.
const db = require('./db');
const cfg = require('./config');
const boards = require('./boards');
const COS = require('./cosmetics');
const AAA = require('./achievements-aaa');

const A = [];
const add = (a) => A.push({ hidden: false, ...a });

// Load AAA achievements
for (const a of AAA.AAA) add(a);

const BY_ID = Object.fromEntries(A.map(a => [a.id, a]));

// Safe defaults so admin-ops.js loadBadges does not crash.
const ADMIN_BADGES = [];
const ADMIN_BY = {};

module.exports = { A, BY_ID, ADMIN_BADGES, ADMIN_BY };
