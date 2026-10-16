const https = require('https');
const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'TrapTechHub/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

let cache = { games: [], fetchedAt: 0 };
const CACHE_MS = 10 * 60 * 1000;

async function loadGames() {
  const now = Date.now();
  if (cache.games.length && now - cache.fetchedAt < CACHE_MS) return cache.games;

  const games = [];

  try {
    const ga = await fetchJson('https://www.gamearter.com/api/v1/catalog/games?limit=200');
    if (ga && ga.games) {
      for (const g of ga.games) {
        games.push({
          id: 'ga-' + g.slug,
          title: g.name,
          source: 'GameArter',
          thumbnail: g.thumbnail,
          categories: g.categories || [],
          embedUrl: 'https://www.gamearter.com/game/' + g.slug + '/',
          mobile: g.platforms && g.platforms.mobile
        });
      }
    }
  } catch (e) { console.error('GameArter fetch failed', e.message); }

  try {
    const gd = await fetchJson('https://catalog.api.gamedistribution.com/api/v2.0/rss/All/?format=json&amount=100');
    if (Array.isArray(gd)) {
      for (const g of gd) {
        const embed = 'https://embed.gamedistribution.com/?url=' + encodeURIComponent(g.Url);
        games.push({
          id: 'gd-' + g.Md5,
          title: g.Title,
          source: 'GameDistribution',
          thumbnail: (g.Asset && g.Asset[0]) || '',
          categories: g.Category || [],
          embedUrl: embed,
          description: g.Description || '',
          mobile: g.Mobile === 'true'
        });
      }
    }
  } catch (e) { console.error('GameDistribution fetch failed', e.message); }

  cache = { games, fetchedAt: now };
  return games;
}

module.exports = { loadGames };
