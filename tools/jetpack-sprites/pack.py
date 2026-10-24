# usage: python3 -I pack.py <frames dir> <out dir>  -> pilot.webp + pilot.json for public/assets/jetpack/
# Each animation is cropped to the union of its frames' alpha bounds and laid out as one row. The camera in render.html is
# orthographic, 3.4 m across 320 px, with the feet (y = 0) 2.6 m below the top edge; (ax, ay) is that point in the crop.
import json, os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
PX, SPAN, TOP = 320, 3.4, 2.6
ppm = PX / SPAN
rows = []
for name, n in (('run', 8), ('fly', 4), ('die', 6)):
    ims = [Image.open(os.path.join(src, f'{name}-{i}.png')).convert('RGBA') for i in range(n)]
    boxes = [im.getchannel('A').getbbox() for im in ims]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    rows.append((name, [im.crop((x0, y0, x1, y1)) for im in ims], PX / 2 - x0, TOP * ppm - y0))
W = max(sum(c.width for c in cr) for _, cr, _, _ in rows)
H = sum(cr[0].height for _, cr, _, _ in rows)
sheet, meta, y = Image.new('RGBA', (W, H)), {'ppm': ppm, 'anims': {}}, 0
for name, crops, ax, ay in rows:
    x, frames = 0, []
    for c in crops:
        sheet.paste(c, (x, y)); frames.append([x, y, c.width, c.height]); x += c.width
    meta['anims'][name] = {'frames': frames, 'ax': ax, 'ay': ay}
    y += crops[0].height
os.makedirs(out, exist_ok=True)
sheet.save(os.path.join(out, 'pilot.webp'), quality=88, method=6)
json.dump(meta, open(os.path.join(out, 'pilot.json'), 'w'))
print(W, H, json.dumps({k: [len(v['frames']), v['ax'], round(v['ay'], 1)] for k, v in meta['anims'].items()}))
