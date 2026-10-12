// Permanent cosmetics catalogue regression test. Run against a disposable DB:
//   tools/fresh-api.sh tools/e2e-shop-catalog.js
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300)); } };
(async () => {
  let r = await fetch(BASE + '/api/shop/catalog?limit=60&offset=0');
  let j = await r.json();
  ok(r.status === 200 && j.ok, 'catalogue endpoint responds');
  ok(j.catalogue_count === 1000 && j.total >= 1000, 'catalogue exposes at least 1,000 items', { count: j.total, fixed: j.catalogue_count });
  ok(j.items.length === 60 && j.has_more, 'catalogue is paginated');
  ok(new Set(j.items.map(x => x.id)).size === j.items.length, 'page has unique item IDs');
  ok(j.items.every(x => x.on_sale && x.current_price > 0), 'permanent catalogue items are priced and available');
  ok(j.css && j.css.includes('v7'), 'page-scoped preview CSS is returned');
  r = await fetch(BASE + '/api/store');
  const store = await r.json();
  ok(r.status === 200 && store.ok && store.prestige.length === 10, 'store exposes ten limited prestige collectibles');
  ok(store.prestige.every(x => x.usd_cents >= 100000 && x.supply > 0), 'prestige collectibles are all $1,000+ with finite supply');

  const first = j.items.find(x => x.generated);
  r = await fetch(BASE + '/api/shop/item/' + encodeURIComponent(first.id));
  const detail = await r.json();
  ok(r.status === 200 && detail.ok && detail.on_sale && detail.price && detail.price.price > 0, 'catalogue item opens in detail sheet and is purchasable');
  r = await fetch(BASE + '/api/shop/catalog?limit=20&offset=0&type=badge');
  j = await r.json();
  ok(j.items.length > 0 && j.items.every(x => x.type === 'badge'), 'category filter returns only badges');
  r = await fetch(BASE + '/api/shop/catalog?limit=20&offset=0&q=not-a-real-cosmetic-name');
  j = await r.json();
  ok(j.ok && j.total === 0 && j.items.length === 0, 'search handles no-result query');
  r = await fetch(BASE + '/api/shop/catalog?limit=20&offset=20');
  const next = await r.json();
  const firstPage = await (await fetch(BASE + '/api/shop/catalog?limit=20&offset=0')).json();
  ok(next.items.length === 20 && next.items[0].id !== firstPage.items[0].id, 'offset pagination advances through the collection');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
