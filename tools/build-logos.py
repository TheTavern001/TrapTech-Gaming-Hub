#!/usr/bin/env python3
"""Builds the crisp vector logos (v5). Text is converted to outlines from Orbitron (SIL OFL 1.1, already bundled in
public/fonts) so the SVGs render identically everywhere with no font loading. Output: public/assets/brand/*.svg"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'brand')
F900 = TTFont(os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'orbitron-latin-900-normal.woff2'))
F700 = TTFont(os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts', 'orbitron-latin-700-normal.woff2'))

def text_path(font, text, x, y, size, tracking=0.0):
    """Return (svg path d, advance width) for text with baseline at y."""
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm; s = size / upm
    pen = SVGPathPen(gs); cx = 0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None: cx += upm * 0.3; continue
        tp = TransformPen(pen, (s, 0, 0, -s, x + cx * s, y))
        gs[g].draw(tp); cx += gs[g].width + tracking * upm
    return pen.getCommands(), (cx - tracking * upm) * s

def width(font, text, size, tracking=0.0):
    return text_path(font, text, 0, 0, size, tracking)[1]

CHROME = '''<linearGradient id="{id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".42" stop-color="#d9dcef"/><stop offset=".55" stop-color="#8d93b8"/><stop offset=".75" stop-color="#c9cde6"/><stop offset="1" stop-color="#f4f5fb"/></linearGradient>'''
PURPLE = '''<linearGradient id="{id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d5ff"/><stop offset=".45" stop-color="#b47bff"/><stop offset=".6" stop-color="#7c3aed"/><stop offset="1" stop-color="#c4a1ff"/></linearGradient>'''
NEON = '''<linearGradient id="{id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c026d3"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>'''

# --- Trap Tech "TT" monogram (100 x 100 design box): flared top bar, inner bar, twin tapered stems
TT_PATH = ('M4 12 Q4 6 10 6 H90 Q96 6 96 12 V20 Q96 24 92 24 H86 Q82 24 80 28 H20 Q18 24 14 24 H8 Q4 24 4 20 Z '
           'M22 31 H78 V37 H22 Z '
           'M34 37 H47 V86 L40.5 95 L34 86 Z M53 37 H66 V86 L59.5 95 L53 86 Z')
def tt_mark(x, y, size, gid='ttc'):
    s = size / 100
    return f'<g transform="translate({x} {y}) scale({s})"><path d="{TT_PATH}" fill="url(#{gid})" stroke="#272c52" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 9 H92" stroke="#fff" stroke-opacity=".85" stroke-width="1.6" stroke-linecap="round"/></g>'

def svg(w, h, defs, body, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}"><title>{title}</title><defs>{defs}</defs>{body}</svg>\n'

def write(name, data):
    with open(os.path.join(OUT, name), 'w') as f: f.write(data)
    print('wrote', name, len(data), 'bytes')

STROKE = 'stroke="#1b1f3f" stroke-width="{w}" stroke-linejoin="round" paint-order="stroke"'
# Trap Tech mark
write('traptech-mark.svg', svg(100, 100, CHROME.format(id='ttc'), tt_mark(0, 0, 100), 'Trap Tech Solutions'))
# Trap Tech horizontal wordmark
d1, w1 = text_path(F900, 'TRAP TECH', 76, 46, 34, 0.06)
d2, w2 = text_path(F900, 'SOLUTIONS', 76 + w1 + 14, 46, 34, 0.06)
W = 76 + w1 + 14 + w2 + 6
write('traptech-wordmark.svg', svg(W, 64, CHROME.format(id='ttc') + PURPLE.format(id='ttp'),
  tt_mark(4, 2, 60) + f'<path d="{d1}" fill="url(#ttc)" {STROKE.format(w=1.6)}/><path d="{d2}" fill="url(#ttp)" {STROKE.format(w=1.6)}/>', 'Trap Tech Solutions'))
# Trap Tech stacked
d1, w1 = text_path(F900, 'TRAP TECH', 96, 44, 32, 0.06)
d2, w2 = text_path(F900, 'SOLUTIONS', 96, 86, 32, 0.06)
W = 96 + max(w1, w2) + 6
write('traptech-stacked.svg', svg(W, 100, CHROME.format(id='ttc') + PURPLE.format(id='ttp'),
  tt_mark(2, 6, 86) + f'<path d="{d1}" fill="url(#ttc)" {STROKE.format(w=1.5)}/><path d="{d2}" fill="url(#ttp)" {STROKE.format(w=1.5)}/>', 'Trap Tech Solutions'))

# --- Gaming Hub mark: neon controller + crown (120 x 110 box)
CTRL = ('M30 40 H90 C106 40 114 52 117 70 L120 88 C122 101 110 108 101 99 L90 88 H30 L19 99 C10 108 -2 101 0 88 L3 70 C6 52 14 40 30 40 Z')
CROWN = 'M38 30 L42 8 L52 20 L60 4 L68 20 L78 8 L82 30 Z'
def hub_mark(x, y, size):
    s = size / 120
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<path d="{CROWN}" fill="url(#hp)" stroke="#2a0f55" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<circle cx="42" cy="8" r="3.5" fill="#f0abfc"/><circle cx="60" cy="4" r="3.5" fill="#f0abfc"/><circle cx="78" cy="8" r="3.5" fill="#f0abfc"/>'
            f'<path d="{CTRL}" fill="#140b33" stroke="url(#hn)" stroke-width="7" stroke-linejoin="round"/>'
            f'<path d="M30 46 H90 C101 46 108 54 111 66" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>'
            f'<path d="M27 55 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 z" fill="#c7d2fe" stroke="#22d3ee" stroke-width="1.5"/>'
            f'<circle cx="88" cy="56" r="4.6" fill="#22d3ee"/><circle cx="97" cy="65" r="4.6" fill="#a78bfa"/><circle cx="79" cy="65" r="4.6" fill="#f0abfc"/><circle cx="88" cy="74" r="4.6" fill="#67e8f9"/>'
            f'<circle cx="48" cy="80" r="5" fill="#1e1b4b" stroke="#8b5cf6" stroke-width="2"/><circle cx="72" cy="80" r="5" fill="#1e1b4b" stroke="#8b5cf6" stroke-width="2"/></g>')
HDEFS = NEON.format(id='hn') + PURPLE.format(id='hp') + CHROME.format(id='hc')
write('hub-mark.svg', svg(120, 110, HDEFS, hub_mark(0, 0, 120), 'The Gaming Hub'))
write('favicon.svg', svg(120, 120, HDEFS, '<rect width="120" height="120" rx="26" fill="#0b0820"/>' + hub_mark(8, 10, 104), 'The Gaming Hub'))
# Gaming Hub horizontal
dT, wT = text_path(F900, 'THE', 132, 30, 18, 0.1)
dG, wG = text_path(F900, 'GAMING', 130, 76, 46, 0.02)
dH, wH = text_path(F900, 'HUB', 130 + wG + 14, 76, 46, 0.02)
dB, wB = text_path(F700, 'BY TRAP TECH SOLUTIONS', 134, 102, 14.5, 0.14)
W = 130 + wG + 14 + wH + 6
write('hub-logo.svg', svg(W, 112, HDEFS,
  hub_mark(2, 4, 118) + f'<path d="{dT}" fill="url(#hc)" {STROKE.format(w=1.2)}/><path d="{dG}" fill="url(#hc)" {STROKE.format(w=2)}/><path d="{dH}" fill="url(#hp)" {STROKE.format(w=2)}/><path d="{dB}" fill="#c9cde6"/>', 'The Gaming Hub by Trap Tech Solutions'))
# Gaming Hub stacked (centered)
dG, wG = text_path(F900, 'GAMING', 0, 0, 48, 0.02); dH, wH = text_path(F900, 'HUB', 0, 0, 48, 0.02)
W = max(wG + 12 + wH, 260) + 20; cx = W / 2
dT, wT = text_path(F900, 'THE', 0, 0, 18, 0.1)
dT, _ = text_path(F900, 'THE', cx - wT / 2, 158, 18, 0.1)
x0 = cx - (wG + 12 + wH) / 2
dG, _ = text_path(F900, 'GAMING', x0, 206, 48, 0.02); dH, _ = text_path(F900, 'HUB', x0 + wG + 12, 206, 48, 0.02)
_, wB = text_path(F700, 'BY TRAP TECH SOLUTIONS', 0, 0, 14, 0.14); dB, _ = text_path(F700, 'BY TRAP TECH SOLUTIONS', cx - wB / 2, 232, 14, 0.14)
write('hub-stacked.svg', svg(W, 244, HDEFS,
  hub_mark(cx - 75, 4, 150) + f'<path d="{dT}" fill="url(#hc)" {STROKE.format(w=1.2)}/><path d="{dG}" fill="url(#hc)" {STROKE.format(w=2)}/><path d="{dH}" fill="url(#hp)" {STROKE.format(w=2)}/><path d="{dB}" fill="#c9cde6"/>', 'The Gaming Hub by Trap Tech Solutions'))
