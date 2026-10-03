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
  'stack-2048': ('STACK 2048', 'Slide, merge, double up', '#facc15', (0.5, 0.5)),
  'munchies-snake': ('MUNCHIES SNAKE', 'Eat, grow, do not bite yourself', '#a3e635', (0.5, 0.5)),
  'brick-breaker': ('BRICK BREAKER', 'Aim the bounce, clear the wall', '#f97316', (0.5, 0.2)),
  'sky-hopper': ('SKY HOPPER', 'One tap over the night city', '#22d3ee', (0.5, 0.5)),
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
    if gid == 'stack-2048':
        import math
        im = tile(art('wood-dark.webp'), S, S); felt = tile(art('rl-felt.webp'), 1100, 1100); m = Image.new('L', (1100, 1100), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 1099, 1099], 60, fill=255)
        im.paste(felt, (150, 150), m); d = ImageDraw.Draw(im); d.rounded_rectangle([150, 150, 1250, 1250], 60, outline='#d4a373', width=14)
        COL = {2: '#e2e8f0', 4: '#a3e635', 8: '#22d3ee', 16: '#60a5fa', 32: '#a78bfa', 64: '#f472b6', 128: '#fb923c', 256: '#facc15', 512: '#f59e0b', 1024: '#ef4444', 2048: '#fde047'}
        vals = [2048, 1024, 512, 256, 4, 128, 64, 32, 2, 8, 16, 4, 0, 2, 8, 2]; cs = 1100 / 4; f = font('orbitron-latin-900-normal', 80)
        for i, v in enumerate(vals):
            if not v: continue
            cx = 150 + (i % 4 + 0.5) * cs; cy = 150 + (i // 4 + 0.5) * cs; r = cs * 0.42; col = COL[v]
            sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([cx - r + 8, cy - r + 14, cx + r + 8, cy + r + 14], fill=(0, 0, 0, 150)); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
            d = ImageDraw.Draw(im); d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
            for k in range(8):
                a = k / 8 * 2 * math.pi; d.arc([cx - r * 0.9, cy - r * 0.9, cx + r * 0.9, cy + r * 0.9], math.degrees(a) - 8, math.degrees(a) + 8, fill='white', width=int(r * 0.16))
            d.ellipse([cx - r * 0.68, cy - r * 0.68, cx + r * 0.68, cy + r * 0.68], fill=col, outline=(0, 0, 0, 70), width=4)
            t = str(v); fs = font('orbitron-latin-900-normal', int(r * (0.42 if len(t) > 3 else 0.55 if len(t) > 2 else 0.68)))
            d.text((cx, cy), t, font=fs, fill='#1e293b' if v <= 4 else 'white', anchor='mm')
        return im.convert('RGB')
    if gid == 'munchies-snake':
        import math
        im = tile(art('dr-grass.webp'), S, S); d = ImageDraw.Draw(im)
        pts = [(260 + i * 28, 520 + 240 * math.sin(i / 7)) for i in range(32)]
        for i in range(len(pts) - 1, -1, -1):
            k = i / (len(pts) - 1); x, y = pts[len(pts) - 1 - i]; r = 46 if i == 0 else 40 - k * 12
            import colorsys; rr, gg, bb = colorsys.hls_to_rgb(((280 - k * 140) % 360) / 360, 0.55, 0.85)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(int(rr * 255), int(gg * 255), int(bb * 255)))
        hx, hy = pts[-1]
        for s_ in (-1, 1): d.ellipse([hx + 10 - 11, hy + s_ * 18 - 11, hx + 10 + 11, hy + s_ * 18 + 11], fill='white'); d.ellipse([hx + 14 - 5, hy + s_ * 18 - 5, hx + 14 + 5, hy + s_ * 18 + 5], fill='black')
        for (n, cx, cy) in (('tt-orange.webp', 1240, 500), ('tt-lime.webp', 420, 900), ('tt-lemon.webp', 900, 1050), ('tt-grapefruit.webp', 1180, 260)): paste_rot(im, art(n), cx, cy, 130, 20)
        paste_rot(im, art('coin-lg.webp'), 700, 260, 120)
        return im.convert('RGB')
    return None
SCENES = {'drift-rush': (0.5, 0.5), 'high-score': (0.5, 0.5), 'terp-tapper': (0.5, 0.45), 'stack-2048': (0.5, 0.42), 'munchies-snake': (0.5, 0.45)}
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
    x0, ty = int(W * 0.06), int(H - H * 0.09 - ts * 1.25)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).text((x0, ty), title, font=f, fill=acc); glow = glow.filter(ImageFilter.GaussianBlur(ts * 0.18))
    im = Image.alpha_composite(im, glow); im = Image.alpha_composite(im, glow); d = ImageDraw.Draw(im)
    d.text((x0, ty), title, font=f, fill='white')
    # v5 research: CrazyGames covers allow the title only and Poki tests found text-light tiles convert better, so no tagline/CTA text on the art
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
