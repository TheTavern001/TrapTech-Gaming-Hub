'use strict';
// Rotating quests with AAA objectives.
const crypto = require('node:crypto');
const cfg = require('./config');
const AAA_Q = require('./quests-aaa');

const PERIODS = ['daily', 'weekly', 'seasonal'];
const OBJECTIVES = AAA_Q.AAA_OBJECTIVES;
const TIERS = AAA_Q.AAA_TIERS;

function generateTemplates(gameIds = []) {
  return AAA_Q.generateAAAQuests(gameIds);
}

// Lazy so the large template array is not built at module load (avoids OOM under 72 MB heap on Deplexo free tier).
let _TEMPLATES = null;
let _BY_ID = null;
function getTemplates() {
  if (!_TEMPLATES) {
    _TEMPLATES = generateTemplates();
    _BY_ID = new Map(_TEMPLATES.map(q => [q.id, q]));
  }
  return _TEMPLATES;
}
function getById() {
  getTemplates();
  return _BY_ID;
}

module.exports = {
  PERIODS,
  OBJECTIVES,
  TIERS,
  get TEMPLATES() { return getTemplates(); },
  get BY_ID() { return getById(); },
  generateTemplates
};
