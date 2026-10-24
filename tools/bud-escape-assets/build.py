# usage: python3 -I build.py <src dir> <out dir>
# Builds the Bud Escape art: atlas.webp + atlas.json (name -> [x, y, w, h], plus "_anchor" feet anchors).
# <src dir> holds the unpacked downloads (see README.md):
#   ga/      GameArt2D freebies (CC0): redhatfiles/, freescifiplatform/, free_plane_sprite/
#   oga/     OpenGameArt (CC0): crates/ (FreeArt boxes & crates)
#   kenney/  Kenney packs (CC0): kenney_<pack>/...
#   oc/      Openclipart renders (public domain): oc-<id>.png
#   r3d/     toon renders made by toon.js from models.json (Kenney 3D kits, CC0, plus models built in toon.html)
# Every sprite below is listed with its source; this file is the licence record. Kenney and Openclipart pieces get the same
# thick dark outline as the GameArt2D art so the whole game reads in one cartoon style.
import json, os, sys
from PIL import Image, ImageEnhance, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
P = lambda *a: os.path.join(SRC, *a)
INK = (31, 24, 40)
items = []  # (name, loader)

def load(path):
    return Image.open(path).convert('RGBA')

def crop_alpha(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(bb) if bb else im

def scale(im, s):
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    return im.resize((w, h), Image.LANCZOS)

def outline(im, px):
    pad = px + 2
    big = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2)); big.paste(im, (pad, pad))
    a = big.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    for _ in range(px): a = a.filter(ImageFilter.MaxFilter(3))
    ink = Image.new('RGBA', big.size, INK + (0,)); ink.putalpha(a)
    ink.alpha_composite(big); return ink

def tint(im, rgb):
    lum = im.convert('L'); a = im.getchannel('A'); r, g, b = rgb
    return Image.merge('RGBA', (lum.point(lambda v: v * r // 255), lum.point(lambda v: v * g // 255), lum.point(lambda v: v * b // 255), a))

def hue_shift_reds(im, to_hue):
    # recolour strongly red pixels (Red Hat Boy's cap) to another hue, keep shading
    hsv = im.convert('RGB').convert('HSV'); h, s, v = hsv.split(); hp, sp = h.load(), s.load()
    for y in range(im.height):
        for x in range(im.width):
            if (hp[x, y] < 26 or hp[x, y] > 236) and sp[x, y] > 110: hp[x, y] = (to_hue + hp[x, y] if hp[x, y] < 128 else to_hue - (256 - hp[x, y])) % 256
    out = Image.merge('HSV', (h, s, v)).convert('RGBA'); out.putalpha(im.getchannel('A')); return out

def add(name, fn): items.append((name, fn))
def simple(path, s, ol=0, sat=None, tnt=None):
    def f():
        im = load(path)
        if tnt: im = tint(im, tnt)
        if sat:
            a = im.getchannel('A'); im = ImageEnhance.Color(im.convert('RGB')).enhance(sat).convert('RGBA'); im.putalpha(a)
        im = scale(crop_alpha(im), s)
        return outline(im, ol) if ol else im
    return f

anchors = {}
# --- Cash Green: GameArt2D "Red Hat Boy" (CC0), cap recoloured green. One shared crop so every frame keeps the same anchor.
RH = P('ga', 'redhatfiles', 'png'); RH_BOX, RH_S = (57, 20, 598, 531), 0.4
for anim, n, key in (('Run', 8, 'run'), ('Jump', 12, 'jump'), ('Dead', 10, 'dead'), ('Hurt', 8, 'hurt'), ('Idle', 10, 'idle')):
    for i in range(n):
        add(f'cash_{key}{i}', (lambda a=anim, i=i: scale(hue_shift_reds(load(os.path.join(RH, f'{a} ({i + 1}).png')).crop(RH_BOX), 95), RH_S)))
anchors['cash'] = [round((390 - RH_BOX[0]) * RH_S, 1), round((506 - RH_BOX[1]) * RH_S, 1)]
# --- warehouse staff: Kenney Toon Characters (CC0), outlined
TOON = P('kenney', 'kenney_toon-characters', '%s', 'PNG', 'Poses HD', 'character_%s_%s.png')
for key, folder, slug in (('fw', 'Female person', 'femalePerson'), ('ma', 'Male adventurer', 'maleAdventurer')):
    for i in range(8): add(f'{key}_walk{i}', simple(TOON % (folder, slug, f'walk{i}'), 0.6, 4))
    for i in range(2): add(f'{key}_cheer{i}', simple(TOON % (folder, slug, f'cheer{i}'), 0.6, 4))
# --- lab extras: GameArt2D "Free Sci-Fi Platformer Tileset" (CC0)
GA = P('ga', 'freescifiplatform', 'png')
for n, f, s in (('barrel_red', 'Objects/Barrel (1).png', 0.5), ('barrel_green', 'Objects/Barrel (2).png', 0.5), ('saw', 'Objects/Saw.png', 0.45)):
    add(n, simple(os.path.join(GA, f), s))
# drone shot: GameArt2D "Free Plane Sprite" bullet (CC0)
for i in range(5): add(f'shot{i}', simple(P('ga', 'free_plane_sprite', 'png', 'Bullet', f'Bullet ({i + 1}).png'), 0.35))
# --- government crates: "FreeArt boxes & crates" (OpenGameArt, CC0); blue tint for the stamped government crates
CR = P('oga', 'crates')
for n in ('obj_crate001', 'obj_crate002', 'obj_crate004', 'obj_box001', 'obj_box004', 'obj_box005'): add(n, simple(os.path.join(CR, n + '.png'), 0.75))
add('crate_blue', simple(os.path.join(CR, 'obj_crate001.png'), 0.75, 0, None, (120, 170, 255)))
# --- Kenney props (CC0), outlined
IND = P('kenney', 'kenney_platformer-pack-industrial', 'PNG', 'Retina', 'platformIndustrial_%s.png')
for n, s in (('039', 0.6), ('040', 0.6), ('045', 0.6), ('053', 0.6), ('064', 0.8), ('065', 0.8), ('081', 0.5), ('090', 0.6), ('091', 0.6), ('106', 0.6)):
    add('i' + n, simple(IND % n, s, 3))
NP = P('kenney', 'kenney_new-platformer-pack-1.1', 'Sprites', 'Tiles', 'Double', '%s.png')
add('gem_green', simple(NP % 'gem_green', 0.55, 3, 1.25)); add('chain', simple(NP % 'chain', 0.55, 2)); add('bomb_active', simple(NP % 'bomb_active', 0.55, 3))
# --- effects (Kenney Smoke Particles + Particle Pack, CC0), no outline; white particles tinted here
SM = P('kenney', 'kenney_smoke-particles', 'PNG', '%s', '%s.png')
for i in range(9): add(f'boom{i}', simple(SM % ('Explosion', f'explosion0{i}'), 0.3))
for i in (0, 4, 8, 12, 16, 20): add(f'puff{i}', simple(SM % ('White puff', f'whitePuff{i:02d}'), 0.34))
PP = P('kenney', 'kenney_particle-pack', 'PNG (Transparent)', '%s.png')
for n, t in (('muzzle_02', (253, 186, 116)), ('muzzle_04', (253, 224, 71)), ('spark_05', (254, 240, 138)), ('spark_06', (253, 230, 138)), ('light_01', (217, 70, 239)),
             ('light_02', (255, 255, 255)), ('light_03', (250, 204, 21)), ('circle_03', (255, 255, 255)), ('star_06', (255, 255, 255)), ('dirt_01', (168, 162, 158)), ('magic_05', (163, 230, 53)), ('trace_06', (255, 255, 255))):
    add(n, simple(PP % n, 0.25, 0, None, t))
# --- cannabis leaf mark (Openclipart, public domain) and wall camera
add('leaf', simple(P('oc', 'oc-277751.png'), 0.5, 3)); add('camera', simple(P('oc', 'oc-1594.png'), 0.3, 3))
# --- toon renders (toon.js + models.json): dolly, vehicles, drones, robot arm, zapper nodes, lab walls, props, grow-room plants
R3_SCALE = {'w': 0.72, 'f': 0.5, 'p': 0.42, 's': 0.45, 'v': 0.55, 'd': 0.5, 'o': 0.4}
for fn in sorted(os.listdir(P('r3d'))):
    if fn.endswith('.png'): n = fn[:-4]; add(n, simple(P('r3d', fn), R3_SCALE[n[0]], 0 if n[0] in 'wf' else 4))
ims = [(n, f()) for n, f in items]
ims.sort(key=lambda t: -t[1].height)
W, PAD = 2048, 2; x = y = rowh = 0; pos = {}
for n, im in ims:
    if x + im.width + PAD > W: x, y, rowh = 0, y + rowh + PAD, 0
    pos[n] = [x, y, im.width, im.height]; x += im.width + PAD; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (W, y + rowh))
for n, im in ims: sheet.paste(im, tuple(pos[n][:2]))
os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'atlas.webp'), quality=88, method=6)
pos['_anchor'] = anchors
json.dump(pos, open(os.path.join(OUT, 'atlas.json'), 'w'), separators=(',', ':'))
print('atlas', W, sheet.height, len(ims), 'sprites', os.path.getsize(os.path.join(OUT, 'atlas.webp')) // 1024, 'KB')

