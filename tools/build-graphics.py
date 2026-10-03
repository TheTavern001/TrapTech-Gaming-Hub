#!/usr/bin/env python3
"""v5 graphics pipeline: turns the downloaded CC0 / public-domain sources in assets-src/ (see CREDITS.md)
into optimized WebP game art in public/assets/v5/. Re-run: python3 tools/build-graphics.py"""
import os, math
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps, ImageChops
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), '..'); SRC = os.path.join(ROOT, 'assets-src'); OUT = os.path.join(ROOT, 'public', 'assets', 'v5')
os.makedirs(OUT, exist_ok=True)
def src(n, maxside=None):
    im = Image.open(os.path.join(SRC, n))
    if maxside: im.draft('RGB', (maxside, maxside))
    return im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
def save(im, n, q=82):
    p = os.path.join(OUT, n); im.save(p, 'WEBP', quality=q, method=6); print(f'{n:34s} {im.size[0]}x{im.size[1]} {os.path.getsize(p)//1024} KB')
def band(n, y0, y1, w):  # crop a horizontal band of an equirectangular panorama (wraps seamlessly left-right)
    im = src(n, 4096); W, H = im.size; c = im.crop((0, int(H * y0), W, int(H * y1))); return c.resize((w, int(w * c.size[1] / W)), Image.LANCZOS)
def cover(im, w, h, cx=0.5, cy=0.5):
    W, H = im.size; s = max(w / W, h / H); im = im.resize((max(w, int(W * s)), max(h, int(H * s))), Image.LANCZOS)
    W, H = im.size; x = int((W - w) * cx); y = int((H - h) * cy); return im.crop((x, y, x + w, y + h))
def tile(n, size, dark=1.0, sat=1.0, tint=None):
    im = src(n, 2048).convert('RGB').resize((size, size), Image.LANCZOS)
    if sat != 1.0: im = ImageEnhance.Color(im).enhance(sat)
    if tint: im = Image.blend(im, Image.new('RGB', im.size, tint), 0.0) if False else ImageChops.multiply(im, Image.new('RGB', im.size, tint))
    if dark != 1.0: im = ImageEnhance.Brightness(im).enhance(dark)
    return im
def disc(im, cx, cy, r, out, feather=2):  # circular cut-out (coins, fruit slices, targets) with soft edge
    c = im.convert('RGBA').crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).resize((out, out), Image.LANCZOS)
    m = Image.new('L', (out * 4, out * 4), 0); ImageDraw.Draw(m).ellipse((4, 4, out * 4 - 4, out * 4 - 4), fill=255); m = m.resize((out, out), Image.LANCZOS)
    if feather: m = m.filter(ImageFilter.GaussianBlur(feather / 2))
    c.putalpha(ImageChops.multiply(c.split()[3], m)); return c
def hue(im, deg):  # hue rotate (keeps realism; used to make lemon/grapefruit from lime/orange photos)
    a = im.split()[3] if im.mode == 'RGBA' else None
    h, s, v = im.convert('RGB').convert('HSV').split(); h = h.point(lambda x: (x + int(deg / 360 * 255)) % 256)
    o = Image.merge('HSV', (h, s, v)).convert('RGB').convert('RGBA');
    if a: o.putalpha(a)
    return o
def vignette(im, k=0.55):
    w, h = im.size; m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for i in range(40): t = i / 40; d.ellipse((-w * 0.3 + w * 0.3 * t, -h * 0.3 + h * 0.3 * t, w * 1.3 - w * 0.3 * t, h * 1.3 - h * 0.3 * t), fill=int(255 * t))
    m = m.filter(ImageFilter.GaussianBlur(w / 20)); dark = ImageEnhance.Brightness(im).enhance(1 - k); return Image.composite(im, dark, m)

# ---------- Jetpack Dash: real night skyline (Shanghai Bund HDRI, Poly Haven CC0), parallax layers ----------
sky = band('ph_shanghai_bund.jpg', 0.12, 0.505, 2400); sky = ImageEnhance.Contrast(ImageEnhance.Color(sky).enhance(1.25)).enhance(1.1)
save(sky.convert('RGB'), 'jp-city.webp', 80)
coins = src('ov_gold_coins.png', 2500); W, H = coins.size
coin = disc(coins, W * 0.757, H * 0.5, H * 0.47, 96, 1); coin = ImageEnhance.Brightness(coin).enhance(1.12); save(coin, 'coin.webp', 88)
coinL = disc(coins, W * 0.757, H * 0.5, H * 0.47, 200, 1); save(ImageEnhance.Brightness(coinL).enhance(1.12), 'coin-lg.webp', 88)

# ---------- Drift Rush: real asphalt + grass (Poly Haven CC0), Kenney CC0 car + cones ----------
save(tile('ph_asphalt_02.jpg', 512, dark=0.62), 'dr-asphalt.webp', 78)
save(tile('ph_aerial_grass_rock.jpg', 512, dark=0.55, sat=0.9), 'dr-grass.webp', 76)
for c in ['car_red_1', 'car_black_1', 'car_blue_1', 'car_yellow_1']:
    im = Image.open(os.path.join(SRC, 'kenney_racing/PNG/Cars', c + '.png')).convert('RGBA'); save(im.resize((im.size[0] * 2, im.size[1] * 2), Image.LANCZOS), f'dr-{c}.webp', 90)
for o in ['cone_straight', 'barrel_red', 'tires_white', 'oil']:
    im = Image.open(os.path.join(SRC, 'kenney_racing/PNG/Objects', o + '.png')).convert('RGBA'); save(im.resize((im.size[0] * 2, im.size[1] * 2), Image.LANCZOS), f'dr-{o}.webp', 90)

# ---------- Plinko + Spin to Win: real bar interior (Poly Haven warm_bar CC0), wood + metal textures ----------
bar = band('ph_warm_bar.jpg', 0.2, 0.8, 2400)
save(vignette(ImageEnhance.Brightness(bar.filter(ImageFilter.GaussianBlur(5))).enhance(0.5)).convert('RGB'), 'bar-blur.webp', 74)
bar2 = band('ph_warm_restaurant_night.jpg', 0.2, 0.8, 2400)
save(vignette(ImageEnhance.Brightness(bar2.filter(ImageFilter.GaussianBlur(6))).enhance(0.45)).convert('RGB'), 'lounge-blur.webp', 74)
save(tile('ph_black_walnut_veneer_01.jpg', 768, dark=0.42), 'wood-dark.webp', 78)
save(tile('ph_lacquered_cherry_wood.jpg', 768, dark=0.9), 'wood-cherry.webp', 78)
save(tile('ph_metal_plate.jpg', 512, dark=0.7, sat=0.2), 'metal-plate.webp', 78)

# ---------- Memory Match: wood table, red velvet card backs, 16 photo faces (CC0 / PD photos) ----------
save(tile('ph_dark_wooden_planks.jpg', 768, dark=0.55), 'mm-table.webp', 78)
save(tile('ph_velour_velvet.jpg', 384, dark=0.8), 'mm-back.webp', 80)
def face(n, cx, cy, side, name, deg=0):
    im = src(n, 2400); W, H = im.size; s = side * min(W, H); c = im.convert('RGBA').crop((int(W * cx - s / 2), int(H * cy - s / 2), int(W * cx + s / 2), int(H * cy + s / 2))).resize((256, 256), Image.LANCZOS)
    if deg: c = ImageEnhance.Color(hue(c, deg)).enhance(1.3)
    save(c.convert('RGB'), f'mm-{name}.webp', 80)
FACES = [('ov_lime.jpg', .259, .574, .76, 'lime', 0), ('ov_orange.jpg', .376, .485, .9, 'orange', 0), ('ov_orange.jpg', .376, .485, .9, 'lemon', 17), ('ov_orange.jpg', .376, .485, .9, 'grapefruit', -22),
         ('ov_gold_coins.png', .757, .5, .98, 'coin', 0), ('ov_cannabis_leaf_photo.jpg', .5, .38, .75, 'leaf', 0), ('ov_archery.jpg', .5, .45, .95, 'target', 0), ('ov_dartboard.jpg', .5, .5, .9, 'darts', 0),
         ('ov_roulette_photo.jpg', .38, .55, .8, 'roulette', 0), ('ov_poker_chips.jpg', .3, .62, .7, 'chips', 0), ('ov_boombox.jpg', .5, .45, .62, 'boombox', 0), ('ov_controllers.jpg', .62, .52, .85, 'controller', 0),
         ('ov_dice.jpg', .4, .5, .85, 'dice', 0), ('ov_headphones.jpg', .55, .45, .8, 'headphones', 0), ('ov_vinyl.jpg', .4, .55, .85, 'vinyl', 0), ('ov_diamond.jpg', .5, .4, .7, 'crystal', 0)]
for f in FACES: face(*f)

# ---------- High Score: brick wall range, real archery target + gold coin targets ----------
save(vignette(tile('ph_brick_wall_02.jpg', 1024, dark=0.42), 0.6), 'hs-wall.webp', 76)
arch = src('ov_archery.jpg', 1400); W, H = arch.size
save(disc(arch, W * 0.5, H * 0.455, H * 0.40, 200, 2), 'hs-target.webp', 86)

# ---------- Blazed Roulette: real casino wheel photo backdrop (CC0), green felt from velvet texture ----------
rp = src('ov_roulette_photo.jpg', 1600)
save(vignette(ImageEnhance.Brightness(cover(rp, 1600, 900).filter(ImageFilter.GaussianBlur(7))).enhance(0.38)).convert('RGB'), 'rl-bg.webp', 74)
felt = hue(tile('ph_velour_velvet.jpg', 512, dark=0.75).convert('RGBA'), 140).convert('RGB'); save(felt, 'rl-felt.webp', 80)

# ---------- Terp Tapper: real cannabis leaf photo backdrop (CC0), real citrus-slice notes (terpene theme) ----------
leaf = src('ov_cannabis_leaf_photo.jpg', 2000)
save(vignette(ImageEnhance.Brightness(cover(leaf, 900, 1400, 0.5, 0.4).filter(ImageFilter.GaussianBlur(3))).enhance(0.42), 0.5).convert('RGB'), 'tt-bg.webp', 74)
lime = src('ov_lime.jpg', 1400); W, H = lime.size; lm = disc(lime, W * 0.259, H * 0.574, H * 0.36, 160, 2)
org = src('ov_orange.jpg', 1400); W, H = org.size; og = disc(org, W * 0.376, H * 0.485, H * 0.435, 160, 2)
save(lm, 'tt-lime.webp', 86); save(ImageEnhance.Color(hue(og, 17)).enhance(1.1), 'tt-lemon.webp', 86); save(og, 'tt-orange.webp', 86); save(hue(og, -22), 'tt-grapefruit.webp', 86)
print('done')
