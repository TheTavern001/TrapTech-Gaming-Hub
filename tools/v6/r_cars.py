# v6 Drift Rush: Kenney Car Kit (CC0) models re-lit and rendered top-down with glossy car-paint materials + original props.
import bpy, sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blib import *
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/cars'; os.makedirs(OUT, exist_ok=True)
M = os.path.join(SRC, 'carkit', 'Models', 'GLB format')
def fit(objs):
    bpy.context.view_layer.update(); pts = []
    for o in objs:
        if o.type == 'MESH': pts += [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]; mx = [max(p[i] for p in pts) for i in range(3)]; return mn, mx
def gloss(objs):
    for o in objs:
        if o.type != 'MESH': continue
        for m in o.data.materials:
            p = m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
            if p: p.inputs['Roughness'].default_value = 0.22; p.inputs['Coat Weight'].default_value = 1.0; p.inputs['Coat Roughness'].default_value = 0.04
def shot(file, name, px_per_unit=64, pad=0.15, tilt=0.0):
    sc = reset(); sc.cycles.samples = 64; world('shanghai_bund.hdr', 0.3, 0.4); objs = imp(os.path.join(M, file)); gloss(objs)
    mn, mx = fit(objs); cx, cy = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2; w, h = mx[0] - mn[0] + pad, mx[1] - mn[1] + pad
    neon_rig((cx, cy, 0), 6, 200, 700, (0, -0.3, 1))
    s = max(w, h); res = (max(8, round(w * px_per_unit)), max(8, round(h * px_per_unit)))
    ortho_cam((cx, cy, 20), (cx, cy, 0), s, res); render(f'{OUT}/{name}.png'); return objs
for f, n in [('sedan-sports.glb', 'car_sedan'), ('hatchback-sports.glb', 'car_hatch'), ('police.glb', 'car_police'), ('taxi.glb', 'car_taxi')]:
    shot(f, n, 72)
shot('cone.glb', 'cone', 90); shot('box.glb', 'box', 60)
# tyre stack (3 Kenney debris tyres)
sc = reset(); sc.cycles.samples = 64; world('shanghai_bund.hdr', 0.7, 0.4); allo = []
for i, (x, y) in enumerate([(0, 0), (0.62, 0), (0.31, 0.54)]):
    objs = imp(os.path.join(M, 'debris-tire.glb')); allo += objs
    for o in objs:
        if o.parent is None: o.location = (x, y, 0); o.rotation_mode = 'XYZ'; o.rotation_euler = (0, math.pi / 2, 0)
mn, mx = fit(allo); cx, cy = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2; s = max(mx[0] - mn[0], mx[1] - mn[1]) + 0.1
neon_rig((cx, cy, 0), 6, 450, 900, (0, -0.3, 1)); ortho_cam((cx, cy, 20), (cx, cy, 0), s, (72, 72)); render(f'{OUT}/tires.png')
# nitro canister (original)
sc = reset(); sc.cycles.samples = 64; world('shanghai_bund.hdr', 0.7, 0.4)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.5, depth=1.6, rotation=(math.pi / 2, 0, 0)); b = bpy.context.object; b.data.materials.append(mat('n', (0.02, 0.35, 0.9, 1), 0.5, 0.2, coat=1))
for f in b.data.polygons: f.use_smooth = True
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, 0.8, 0)); s1 = bpy.context.object; s1.data.materials.append(b.data.materials[0]); s1.scale = (1, 0.5, 1)
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.18, depth=0.4, location=(0, 1.15, 0), rotation=(math.pi / 2, 0, 0)); bpy.context.object.data.materials.append(mat('c', (0.9, 0.9, 0.95, 1), 1, 0.08))
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.51, depth=0.3, location=(0, -0.1, 0), rotation=(math.pi / 2, 0, 0)); bpy.context.object.data.materials.append(mat('e', (0.2, 0.9, 1, 1), 0, 0.2, emit=(0.15, 0.9, 1, 1), estr=6))
neon_rig((0, 0, 0), 6, 450, 900, (0, -0.3, 1)); ortho_cam((0, 0, 20), (0, 0, 0), 2.7, (72, 72)); render(f'{OUT}/nitro.png')
# street-lamp head seen from above (original)
sc = reset(); sc.cycles.samples = 64; world('shanghai_bund.hdr', 0.7, 0.4)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.9, 0, 0)); a = bpy.context.object; a.scale = (1.8, 0.16, 0.12); a.data.materials.append(mat('pole', (0.12, 0.12, 0.14, 1), 0.9, 0.35))
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.9, 0, 0)); h = bpy.context.object; h.scale = (0.7, 0.36, 0.16); h.data.materials.append(mat('hd', (0.15, 0.15, 0.17, 1), 0.9, 0.3))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.24, location=(0, 0, 0)); bpy.context.object.data.materials.append(mat('pb', (0.12, 0.12, 0.14, 1), 0.9, 0.3))
neon_rig((1, 0, 0), 6, 450, 900, (0, -0.3, 1)); ortho_cam((1.1, 0, 20), (1.1, 0, 0), 2.6, (128, 32)); render(f'{OUT}/lamp.png')
