// Shared 21+ cannabis-culture branding for Hub games (original art, code-drawn). Ad slots come from brand.json
// (event sponsors can swap entries/images). Nothing here is aimed at children.
export const DEFAULT = { ads: [{ text: 'GREEN LEAF CO.', sub: 'Craft dispensary - 21+', bg: '#0f3d2a', fg: '#f2c94c' }], signs: ['DISPENSARY'] };
export async function loadBrand(base) { try { const r = await fetch((base || '../') + 'brand.json', { cache: 'no-cache' }); if (r.ok) return Object.assign({}, DEFAULT, await r.json()); } catch (e) {} return DEFAULT; }
export function leaf(x, cx, cy, r, col) { x.save(); x.translate(cx, cy); x.fillStyle = col; const L = [[0, 1], [-0.42, 0.82], [0.42, 0.82], [-0.85, 0.5], [0.85, 0.5], [-0.62, 0.3], [0.62, 0.3]];
  for (const [a, s] of [[0, 1], [-0.45, 0.85], [0.45, 0.85], [-0.95, 0.62], [0.95, 0.62], [-1.45, 0.38], [1.45, 0.38]]) { x.save(); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(r * 0.16 * s, -r * 0.5 * s, 0, -r * s); x.quadraticCurveTo(-r * 0.16 * s, -r * 0.5 * s, 0, 0); x.fill(); x.restore(); }
  x.fillRect(-r * 0.03, 0, r * 0.06, r * 0.35); x.restore(); }
export function drawAd(x, w, h, ad) { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, ad.bg); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalAlpha = 0.12; for (let i = 0; i < 6; i++) leaf(x, (i * 197) % w, (i * 89) % h + 40, 60, ad.fg); x.globalAlpha = 1; leaf(x, h * 0.55, h * 0.58, h * 0.36, ad.fg);
  x.textAlign = 'left'; x.textBaseline = 'middle'; x.font = `900 ${Math.round(h * 0.2)}px Arial`; x.fillStyle = ad.fg; x.fillText(ad.text, h * 1.05, h * 0.42, w - h * 1.15); x.font = `700 ${Math.round(h * 0.1)}px Arial`; x.fillStyle = '#ffffffcc'; x.fillText(ad.sub || '', h * 1.05, h * 0.68, w - h * 1.15);
  x.fillStyle = '#e8413c'; x.beginPath(); x.arc(w - 46, 40, 28, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '900 24px Arial'; x.textAlign = 'center'; x.fillText('21+', w - 46, 41); x.strokeStyle = ad.fg; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); }
export function adTexture(THREE, canvasTex, ad) { if (ad.img) { const t = new THREE.TextureLoader().load(ad.img); t.colorSpace = THREE.SRGBColorSpace; return t; } return canvasTex(512, 256, (x, w, h) => drawAd(x, w, h, ad)); }
