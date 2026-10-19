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

const TEMPLATES = generateTemplates();
const BY_ID = new Map(TEMPLATES.map(q => [q.id, q]));

module.exports = { PERIODS, OBJECTIVES, TIERS, TEMPLATES, BY_ID, generateTemplates };
