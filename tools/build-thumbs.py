#!/usr/bin/env python3
"""v5: build store thumbnails for every game from REAL gameplay frames.
Input: /tmp/frames/<id>.png (raw canvas captured by tools/shoot-games.js)
Output: public/assets/cards/v5/<id>.webp (800x450), <id>-tall.webp (600x620), <id>.png (1200x630 share/OG image)
Title type: Orbitron (SIL OFL, bundled in /public/fonts). Trap Tech wordmark: our own logo."""
import os, io
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
from fontTools.ttLib import TTFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/assets/cards/v5'); os.makedirs(OUT, exist_ok=True)
def font(name, size):
    ttf = f'/tmp/{name}.ttf'
    if not os.path.exists(ttf):
        f = TTFont(os.path.join(ROOT, 'public/fonts', name + '.woff2')); f.flavor = None; f.save(ttf)
    return ImageFont.truetype(ttf, size)
GAMES = {
  'jetpack-dash': ('JETPACK DASH', 'Fly the night skyline', '#22d3ee', (0.5, 0.52)),
  'drift-rush': ('DRIFT RUSH', 'Slide it. Bank it.', '#f472b6', (0.5, 0.6)),
  'plinko': ('PLINKO', 'Aim, drop, hit the x2 pegs', '#fbbf24', (0.5, 0.86)),
  'spin-to-win': ('SPIN TO WIN', 'Time the perfect release', '#f59e0b', (0.5, 0.36)),
  'memory-match': ('MEMORY MATCH', 'Find the pairs, beat the clock', '#a3e635', (0.5, 0.5)),
  'high-score': ('HIGH SCORE', 'Fast hands win', '#ef4444', (0.5, 0.45)),
  'blazed-roulette': ('BLAZED ROULETTE', 'Points-only table, 8 spins', '#34d399', (0.5, 0.3)),
  'terp-tapper': ('TERP TAPPER', 'Tap the citrus to the beat', '#fde047', (0.5, 0.62)),
}
TT = Image.open(os.path.join(ROOT, 'public/assets/brand/traptech-wordmark.png')).convert('RGBA')
def crop(im, W, H, focus):
    s = max(W / im.width, H / im.height) * 1.04; im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    fx, fy = focus; x = min(max(0, round(im.width * fx - W / 2)), im.width - W); y = min(max(0, round(im.height * fy - H / 2)), im.height - H)
    return im.crop((x, y, x + W, y + H))
def trim_letterbox(im):
    g = im.convert('L'); bb = g.point(lambda v: 255 if v > 14 else 0).getbbox(); return im.crop(bb) if bb else im
A = os.path.join(ROOT, 'public/assets/v5')
def art(n): return Image.open(os.path.join(A, n)).convert('RGBA')
def tile(img, W, H):
    out = Image.new('RGBA', (W, H))
    for x in range(0, W, img.width):
        for y in range(0, H, img.height): out.paste(img, (x, y))
    return out
def paste_rot(base, im, cx, cy, size, ang=0, shadow=True):
    im = im.resize((round(im.width * size / max(im.size)), round(im.height * size / max(im.size))), Image.LANCZOS).rotate(ang, expand=True, resample=Image.BICUBIC)
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel('A').point(lambda a: a * 0.6)); sh = sh.filter(ImageFilter.GaussianBlur(size * 0.06))
        base.alpha_composite(sh, (int(cx - im.width / 2 + size * 0.05), int(cy - im.height / 2 + size * 0.07)))
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))
def scene(gid):
    # staged hero shots built from the same in-game art (used where a raw portrait frame crops badly)
    S = 1400
    if gid == 'drift-rush':
        im = tile(art('dr-grass.webp'), S, S); road = tile(art('dr-asphalt.webp'), S, S); m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
        pts = [(x, S * 0.5 + 330 * __import__('math').sin(x / S * 3.2)) for x in range(-50, S + 60, 20)]
        d.line(pts, fill=255, width=430, joint='curve'); im.paste(road, (0, 0), m)
        dd = ImageDraw.Draw(im)
        for off, col in ((-222, None), (222, None)):
            for i in range(len(pts) - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]; dd.line([(x0, y0 + off), (x1, y1 + off)], fill=('#dc2626' if i % 2 else '#f4f4f5'), width=22)
        for i in range(0, len(pts) - 1, 3): (x0, y0), (x1, y1) = pts[i], pts[i + 1]; dd.line([(x0, y0), (x1, y1)], fill=(240, 240, 240, 200), width=6)
        for k in range(26): dd.ellipse([600 - k * 14, 640 + k * 9, 612 - k * 14, 650 + k * 9], fill=(10, 10, 12, 150))
        paste_rot(im, art('dr-car_red_1.webp'), 700, 620, 300, 58)
        paste_rot(im, art('dr-car_blue_1.webp'), 1040, 520, 270, 92)
        paste_rot(im, art('dr-car_yellow_1.webp'), 330, 880, 260, 80)
        for (cx, cy) in ((880, 760), (930, 790), (480, 600)): paste_rot(im, art('dr-cone_straight.webp'), cx, cy, 70)
        for (cx, cy) in ((180, 300), (1250, 1100), (950, 260)): paste_rot(im, art('dr-tires_white.webp'), cx, cy, 120)
        return im.convert('RGB')
    if gid == 'high-score':
        im = tile(art('hs-wall.webp'), S, S); ov = Image.new('RGBA', (S, S), (8, 6, 16, 120)); im.alpha_composite(ov)
        for (cx, cy, sz, ang) in ((420, 640, 420, 0), (930, 520, 300, 0), (1120, 860, 210, 0), (640, 980, 160, 0)): paste_rot(im, art('hs-target.webp'), cx, cy, sz, ang)
        paste_rot(im, art('coin-lg.webp'), 760, 300, 190)
        d = ImageDraw.Draw(im)
        for r, a in ((250, 200), (290, 120), (330, 60)): d.ellipse([420 - r, 640 - r, 420 + r, 640 + r], outline=(255, 255, 255, a), width=6)
        return im.convert('RGB')
    if gid == 'terp-tapper':
        bg = Image.open(os.path.join(A, 'tt-bg.webp')).convert('RGBA').resize((S, S)); bg.alpha_composite(Image.new('RGBA', (S, S), (6, 4, 14, 120))); d = ImageDraw.Draw(bg)
        cols = [(163, 230, 53), (253, 224, 71), (251, 146, 60), (244, 114, 182)]; lw = S // 4; notes = ['tt-lime.webp', 'tt-lemon.webp', 'tt-orange.webp', 'tt-grapefruit.webp']
        for l, c in enumerate(cols):
            lane = Image.new('RGBA', (lw - 16, S), c + (0,)); ld = ImageDraw.Draw(lane)
            for y in range(S): ld.line([(0, y), (lw, y)], fill=c + (int(70 * y / S),))
            bg.alpha_composite(lane, (l * lw + 8, 0))
        hy = int(S * 0.8); d.rectangle([0, hy - 4, S, hy + 4], fill=(255, 255, 255, 230))
        for l, c in enumerate(cols): d.ellipse([l * lw + lw / 2 - 110, hy - 110, l * lw + lw / 2 + 110, hy + 110], outline=c + (255,), width=12)
        for (l, y, sz) in ((0, 300, 230), (1, 560, 230), (2, 180, 230), (3, 640, 230), (2, 900 , 200), (0, 1020, 200)): paste_rot(bg, art(notes[l]), l * lw + lw / 2, y, sz, (y * 7) % 360)
        return bg.convert('RGB')
    return None
SCENES = {'drift-rush': (0.5, 0.5), 'high-score': (0.5, 0.5), 'terp-tapper': (0.5, 0.45)}
def card(gid, W, H):
    title, tag, acc, focus = GAMES[gid]
    src = scene(gid) if gid in SCENES else trim_letterbox(Image.open(f'/tmp/frames/{gid}.png').convert('RGB'))
    if gid in SCENES: focus = SCENES[gid]
    base = crop(src, W, H, focus); base = ImageEnhance.Contrast(base).enhance(1.08); base = ImageEnhance.Color(base).enhance(1.1)
    im = base.convert('RGBA'); ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(H):  # bottom-up dark gradient for type legibility
        t = max(0, (y - H * 0.38) / (H * 0.62)); d.line([(0, y), (W, y)], fill=(5, 6, 20, int(235 * t ** 1.3)))
    for y in range(int(H * 0.2)): d.line([(0, y), (W, y)], fill=(5, 6, 20, int(150 * (1 - y / (H * 0.2)))))
    im = Image.alpha_composite(im, ov); d = ImageDraw.Draw(im)
    ts = int(min(W * 0.105, H * 0.15)); f = font('orbitron-latin-900-normal', ts)
    while d.textlength(title, font=f) > W * 0.88: ts -= 2; f = font('orbitron-latin-900-normal', ts)
    x0, ty = int(W * 0.06), int(H - H * 0.1 - ts * 1.9)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).text((x0, ty), title, font=f, fill=acc); glow = glow.filter(ImageFilter.GaussianBlur(ts * 0.18))
    im = Image.alpha_composite(im, glow); im = Image.alpha_composite(im, glow); d = ImageDraw.Draw(im)
    d.text((x0, ty), title, font=f, fill='white')
    f2 = font('exo-2-latin-700-normal', int(ts * 0.42)); d.text((x0 + 2, ty + int(ts * 1.18)), tag.upper(), font=f2, fill=acc)
    # Trap Tech wordmark (top-left) + accent bar
    tw = int(W * 0.26); tt = TT.resize((tw, round(TT.height * tw / TT.width)), Image.LANCZOS); im.alpha_composite(tt, (int(W * 0.05), int(H * 0.06)))
    d.rectangle([x0, ty - int(ts * 0.35), x0 + int(W * 0.12), ty - int(ts * 0.35) + max(3, ts // 12)], fill=acc)
    return im.convert('RGB')
for gid in GAMES:
    if not os.path.exists(f'/tmp/frames/{gid}.png'): print('skip (no frame)', gid); continue
    card(gid, 800, 450).save(f'{OUT}/{gid}.webp', 'WEBP', quality=84, method=6)
    card(gid, 600, 620).save(f'{OUT}/{gid}-tall.webp', 'WEBP', quality=84, method=6)
    card(gid, 1200, 630).save(f'{OUT}/{gid}.png', 'PNG', optimize=True)
    print('ok', gid)
