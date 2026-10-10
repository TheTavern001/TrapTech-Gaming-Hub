# Trap Tech logo (FINAL, Reese Oct 10): white angular double-T + gold crown from brand-src/traptech-v7/logo-final.jpg, rebuilt as
# vector SVG; wordmark 'TRAP TECH' / spaced gold 'SOLUTIONS' outlined from the site's Orbitron font. Writes public/assets/brand/tt-*.svg;
# tools/build-brand-tt.js rasterizes PNG/WebP, favicons and PWA icons.
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
ROOT = os.path.join(os.path.dirname(__file__), '..'); OUT = os.path.join(ROOT, 'public', 'assets', 'brand')
FONT = TTFont(os.path.join(ROOT, 'public', 'fonts', 'orbitron-latin-600-normal.woff2'))
GS = FONT.getGlyphSet(); CMAP = FONT.getBestCmap(); UPM = FONT['head'].unitsPerEm; HM = FONT['hmtx']
def text_path(s, x, base, size, track=0.0):
    """SVG path data for s; returns (d, width)."""
    sc = size / UPM; pen = SVGPathPen(GS); cx = x
    for ch in s:
        g = CMAP.get(ord(ch)); adv = HM[g][0] * sc
        if ch != ' ': GS[g].draw(TransformPen(pen, (sc, 0, 0, -sc, cx, base)))
        cx += adv + track * size
    return pen.getCommands(), cx - x - track * size
# FINAL (Reese, Oct 10 02:47): brand-src/traptech-v7/logo-final.jpg - bold white angular double-T with a gold metallic crown
# (gradient gold, thin dark outline). Traced by hand into a 710 x 800 grid; mark() draws it at (ox, oy) scaled by s.
L=[(25,255),(335,255),(335,770),(250,682),(250,328),(192,328),(162,366),(124,366)]
R=[(710-x,y) for x,y in L]
pts=lambda P:' '.join(f'{x},{y}' for x,y in P)
crown='M180,88 L196,150 L226,203 M196,150 L214,120 M226,203 L258,110 L304,182 L355,34 L406,182 L452,110 L484,203 M514,150 L496,120 M484,203 L514,150 L530,88'
band='M218,214 Q355,196 492,214'
GOLD='<linearGradient id="ttg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc9c"/><stop offset=".45" stop-color="#c9954a"/><stop offset=".7" stop-color="#8a5a24"/><stop offset="1" stop-color="#e7c27a"/></linearGradient>'
def _mark(extra_tr=''):
  return f'''<g{extra_tr}><g fill="#ffffff"><polygon points="{pts(L)}"/><polygon points="{pts(R)}"/></g>
<g fill="none" stroke-linejoin="miter" stroke-miterlimit="8" stroke-linecap="butt"><path d="{crown}" stroke="#2a1a08" stroke-width="18"/><path d="{band}" stroke="#2a1a08" stroke-width="24"/><path d="{crown}" stroke="url(#ttg)" stroke-width="13"/><path d="{band}" stroke="url(#ttg)" stroke-width="19"/></g></g>'''


SILVER = GOLD
CYAN = '#e2b866'
def mark(ox=0, oy=0, s=1.0):
    # native art spans x 18..692, y 18..782 (674 x 764); normalise to a 100 x 113.4 box like the old API
    k = s * 100 / 674
    return f'<g transform="translate({ox} {oy}) scale({k:.5f}) translate(-18 -18)">' + _mark() + '</g>'
def svg(w, h, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="Trap Tech Solutions"><title>Trap Tech Solutions</title><defs>{GOLD}</defs>{extra}{body}</svg>\n'
def words(x, top, size1=44):
    d1, w1 = text_path('TRAP TECH', x, top + size1 * 0.78, size1, 0.06)
    size2 = size1 * 0.5; tr = (w1 - text_path('SOLUTIONS', 0, 0, size2)[1]) / (8 * size2)  # spread SOLUTIONS to the same width
    d2, w2 = text_path('SOLUTIONS', x, top + size1 * 0.78 + size2 * 1.75, size2, tr)
    return f'<path d="{d1}" fill="#ffffff"/><path d="{d2}" fill="{CYAN}"/>', w1, size1 * 0.78 + size2 * 1.75
W = {}
# 1) mark (crowned TT)
W['mono'] = svg(100, 114, mark())
# 2) wordmark only (two lines)
b, w1, hh = words(4, 4); W['chrome'] = svg(w1 + 8, hh + 10, b)
# 3) horizontal: mark left, words right, vertically centred on the T
b, w1, hh = words(112, 40); W['horizontal'] = svg(112 + w1 + 6, 118, mark(2, 2) + b)
# 4) stacked lockup
b, w1, hh = words(0, 0); bw = w1; X = 6
b, w1, hh = words(X, 168); W['lockup'] = svg(bw + 2 * X, 168 + hh + 10, mark((bw + 2 * X) / 2 - 70, 4, 1.4) + b)
# 5) badge: mark on a dark disc with a thin cyan ring
W['badge'] = svg(256, 256, f'<circle cx="128" cy="128" r="124" fill="#0b1530"/><circle cx="128" cy="128" r="119" fill="none" stroke="{CYAN}" stroke-width="2" opacity=".6"/>' + mark(60, 52, 1.36))
for k, s in W.items(): open(os.path.join(OUT, f'tt-{k}.svg'), 'w').write(s)
# favicon: the crowned mark on the hub's dark tile
open(os.path.join(OUT, 'tt-favicon.svg'), 'w').write(svg(128, 128, '<rect width="128" height="128" rx="26" fill="#0b1530"/>' + mark(16, 7, 0.96)))
for k, s in W.items():
    import re; m = re.search(r'viewBox="0 0 (\d+) (\d+)"', s); print(k, m.group(1), m.group(2), len(s) // 1024, 'KB')
# maskable PWA icon: mark inside the 80% safe zone on full-bleed navy
open(os.path.join(OUT, 'tt-maskable.svg'), 'w').write(svg(128, 128, '<rect width="128" height="128" fill="#0b1530"/>' + mark(30, 26, 0.68)))
