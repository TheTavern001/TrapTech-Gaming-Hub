'use strict';
// Achievement system. Everything is evaluated on the SERVER from data the server already validated.
const db = require('./db');
const cfg = require('./config');
const boards = require('./boards');
const COS = require('./cosmetics');
const EXP_A = require('./achievements-expansion');

const fmt = (n) => Number(n).toLocaleString('en-US');
const A = [];
const add = (a) => A.push({ hidden: false, ...a });
const R = (type, id) => ({ type, id });

// ... all existing add() calls remain ...

// Expansion achievements
for (const a of EXP_A.EXPANSION) add(a);

const BY_ID = Object.fromEntries(A.map(a => [a.id, a]));
module.exports = { A, BY_ID /* + rest of original exports */ };
