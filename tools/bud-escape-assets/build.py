# usage: python3 -I build.py <kenney dir> <openclipart dir> <out dir>
# Packs the Bud Escape sprites into one atlas (atlas.webp + atlas.json: name -> [x, y, w, h]).
# <kenney dir> holds the extracted Kenney packs (kenney_<pack>/...), <openclipart dir> the PNG renders of the Openclipart SVGs
# (oc-<id>.png, see README.md). Every source is CC0 / public domain; the list below is the licence record.
import json, os, sys
from PIL import Image, ImageEnhance

K, OC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
IND = 'kenney_platformer-pack-industrial/PNG/Retina/platformIndustrial_%s.png'
TOON = 'kenney_toon-characters/%s/PNG/Poses HD/character_%s_%s.png'
PART = 'kenney_particle-pack/PNG (Transparent)/%s.png'
SMOKE = 'kenney_smoke-particles/PNG/%s/%s.png'
ROBOT = 'kenney_robot-pack/PNG/Side view/%s.png'
NP = 'kenney_new-platformer-pack-1.1/Sprites/Tiles/Double/%s.png'
SS = 'kenney_space-shooter-remastered/PNG/%s.png'

items = []  # (name, path, scale or target height, tint, crop)
def add(name, path, size=1.0, tint=None, crop=True): items.append((name, path, size, tint, crop))

# Cash (Toon Characters "Male person"), warehouse staff (Female person, Male adventurer) and the security robot
for p in ['run0', 'run1', 'run2', 'idle', 'hold', 'jump', 'fall', 'hurt', 'fallDown', 'slide', 'cheer0', 'cheer1', 'wide', 'duck', 'show']:
    add('cash_' + p, TOON % ('Male person', 'malePerson', p), 0.8)
for key, folder, slug in (('fw', 'Female person', 'femalePerson'), ('ma', 'Male adventurer', 'maleAdventurer')):
    for i in range(8): add(f'{key}_walk{i}', TOON % (folder, slug, f'walk{i}'), 0.55)
    for i in range(2): add(f'{key}_cheer{i}', TOON % (folder, slug, f'cheer{i}'), 0.55)
for i in range(8): add(f'rb_walk{i}', TOON % ('Robot', 'robot', f'walk{i}'), 0.55)
# warehouse (Platformer Pack Industrial, retina)
for n in ['001', '002', '005', '029', '030', '031', '036', '037', '039', '040', '041', '042', '043', '045', '046', '053', '054', '055',
          '057', '058', '059', '064', '065', '066', '067', '073', '074', '075', '076', '081', '082', '085', '086', '087', '088', '089',
          '090', '091', '092', '094', '095', '099', '100', '104', '105', '106']:
    add('i' + n, IND % n, 1.0, None, n not in ('001', '002', '029', '030', '059', '094', '095'))
# drones, walker, sled, cannon cart (Robot Pack side view)
for n in ['robot_redBody', 'robot_redHurt', 'robot_greenBody', 'robot_yellowBody', 'robot_blueDrive1', 'robot_blueDrive2', 'tracks_long1', 'tracks_long2', 'tracks_short1']:
    add(n, ROBOT % n, 0.8)
# collectibles and props (New Platformer Pack)
for n in ['gem_green', 'gem_blue', 'chain', 'bomb', 'bomb_active', 'block_exclamation', 'star', 'heart']:
    add(n, NP % n, 0.6)
add('laserRed', SS % 'Lasers/laserRed16', 1.0); add('laserPurple', SS % 'Lasers/laserBlue16', 1.0, '#e879f9')
# effects (Smoke Particles + Particle Pack, white particles tinted here)
for i in range(9): add(f'boom{i}', SMOKE % ('Explosion', f'explosion0{i}'), 0.3)
for i in (0, 4, 8, 12, 16, 20): add(f'puff{i}', SMOKE % ('White puff', f'whitePuff{i:02d}'), 0.34)
for i in (0, 3, 6): add(f'black{i}', SMOKE % ('Black smoke', f'blackSmoke{i:02d}'), 0.3)
for n, t in (('muzzle_02', '#fdba74'), ('muzzle_04', '#fde047'), ('spark_05', '#f0abfc'), ('spark_06', '#fde68a'), ('spark_07', '#f5d0fe'),
             ('light_01', '#d946ef'), ('light_02', '#ffffff'), ('circle_03', '#ffffff'), ('star_06', '#ffffff'), ('smoke_04', '#cbd5e1'),
             ('dirt_01', '#a8a29e'), ('flare_01', '#ffffff'), ('magic_05', '#a3e635'), ('trace_06', '#ffffff')):
    add(n, PART % n, 0.25, t)
# cannabis art (Openclipart, public domain): plant, leaf, bong; plus a security camera
add('plant', os.path.join(OC, 'oc-265563.png'), 0.55); add('plant2', os.path.join(OC, 'oc-238184.png'), 0.55)
add('leaf', os.path.join(OC, 'oc-277751.png'), 0.5); add('bong', os.path.join(OC, 'oc-320677.png'), 0.62); add('camera', os.path.join(OC, 'oc-1594.png'), 0.3)

def load(name, path, size, tint, crop):
    p = path if os.path.isabs(path) else os.path.join(K, path)
    im = Image.open(p).convert('RGBA')
    if tint:
        r, g, b = (int(tint[i:i + 2], 16) for i in (1, 3, 5))
        lum = im.convert('L'); a = im.getchannel('A')
        im = Image.merge('RGBA', (lum.point(lambda v: v * r // 255), lum.point(lambda v: v * g // 255), lum.point(lambda v: v * b // 255), a))
    if name.startswith('plant'):  # botanical renders are olive; push them toward the saturated greens of the Kenney art
        a = im.getchannel('A'); im = ImageEnhance.Brightness(ImageEnhance.Color(im.convert('RGB')).enhance(1.7)).enhance(1.12).convert('RGBA'); im.putalpha(a)
    if crop:
        bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb: im = im.crop(bb)
    w, h = max(1, round(im.width * size)), max(1, round(im.height * size))
    return im.resize((w, h), Image.LANCZOS) if (w, h) != im.size else im

ims = [(n, load(n, p, s, t, c)) for n, p, s, t, c in items]
ims.sort(key=lambda t: -t[1].height)
W, PAD = 2048, 2; x = y = rowh = 0; pos = {}
for n, im in ims:
    if x + im.width + PAD > W: x, y, rowh = 0, y + rowh + PAD, 0
    pos[n] = [x, y, im.width, im.height]; x += im.width + PAD; rowh = max(rowh, im.height)
H = y + rowh
sheet = Image.new('RGBA', (W, H))
for n, im in ims: sheet.paste(im, tuple(pos[n][:2]))
os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'atlas.webp'), quality=90, method=6)
json.dump(pos, open(os.path.join(OUT, 'atlas.json'), 'w'), separators=(',', ':'))
print(W, H, len(pos), 'sprites', os.path.getsize(os.path.join(OUT, 'atlas.webp')) // 1024, 'KB')
