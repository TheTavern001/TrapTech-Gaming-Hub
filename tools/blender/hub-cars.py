# Procedural stylised-realistic car bodies for the Gaming Hub (original work, CC0 by the Hub).
import bpy, bmesh, math, sys
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
def mat(name, col, metal=0.0, rough=0.5, emit=None, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 2.0
    if alpha < 1: b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND'
    return m
M = dict(paint=mat('paint', (0.8, 0.1, 0.1), 0.5, 0.3), glass=mat('glass', (0.03, 0.05, 0.08), 0.2, 0.05), chrome=mat('chrome', (0.9, 0.9, 0.92), 1.0, 0.15),
         tire=mat('tire', (0.02, 0.02, 0.022), 0.0, 0.9), rim=mat('rim', (0.7, 0.72, 0.75), 1.0, 0.3), trim=mat('trim', (0.03, 0.03, 0.035), 0.1, 0.6),
         light_f=mat('light_f', (0.95, 0.95, 0.9), 0.0, 0.1, (1, 0.95, 0.8)), light_r=mat('light_r', (0.6, 0.02, 0.02), 0.0, 0.2, (1, 0.05, 0.05)), box=mat('box', (0.92, 0.92, 0.9), 0.0, 0.55))
def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
def prism(name, prof, w, m, taper=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); h = w / 2
    a = [bm.verts.new((x, -h, z)) for x, z in prof]; b = [bm.verts.new((x, h, z)) for x, z in prof]
    bm.faces.new(a[::-1]); bm.faces.new(b)
    n = len(prof)
    for i in range(n): j = (i + 1) % n; bm.faces.new((a[i], a[j], b[j], b[i]))
    if taper:  # tumblehome: pull top verts inward
        zmax = max(z for _, z in prof); zmin = min(z for _, z in prof)
        for v in bm.verts: t = (v.co.z - zmin) / max(1e-6, zmax - zmin); v.co.y *= 1 - taper * t
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(m); return o
def bevel(o, wd, seg=2):
    md = o.modifiers.new('bv', 'BEVEL'); md.width = wd; md.segments = seg; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(25)
def apply(o):
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def cut(o, x, z, r, w):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=w + 0.4, location=(x, 0, z), rotation=(math.pi / 2, 0, 0)); c = bpy.context.object
    md = o.modifiers.new('arch', 'BOOLEAN'); md.object = c; md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; apply(o); bpy.data.objects.remove(c)
def box(name, loc, size, m, bv=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name; o.scale = size; bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m); bevel(o, bv, 1) if bv else None; apply(o); return o
def wheel(x, y, r, wd):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=wd, location=(x, y, r), rotation=(math.pi / 2, 0, 0)); t = bpy.context.object; t.data.materials.append(M['tire']); bevel(t, 0.05, 2); apply(t)
    s = 1 if y > 0 else -1
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=r * 0.62, depth=0.04, location=(x, y + s * wd / 2, r), rotation=(math.pi / 2, 0, 0)); h = bpy.context.object; h.data.materials.append(M['rim'])
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r * 0.18, depth=0.06, location=(x, y + s * (wd / 2 + 0.02), r), rotation=(math.pi / 2, 0, 0)); k = bpy.context.object; k.data.materials.append(M['chrome'])
    return [t, h, k]
def roof_paint(o, zmin):
    # faces facing up near the top become painted roof; everything else on the cabin stays glass
    if len(o.data.materials) < 2: o.data.materials.append(M['paint'])
    for p in o.data.polygons:
        c = o.matrix_world @ p.center
        if p.normal.z > 0.6 and c.z > zmin: p.material_index = 1
def pillars(o, zlo, zhi, xs, w):
    for x in xs: box('pillar', (x, 0, (zlo + zhi) / 2), (0.08, w, zhi - zlo), M['paint'], 0)
def build(kind):
    clear(); parts = []
    if kind == 'sedan':
        L, W, R = 4.6, 1.84, 0.34; wx = (1.42, -1.38)
        body = [(-2.3, 0.32), (2.3, 0.32), (2.34, 0.62), (2.2, 0.8), (1.1, 0.92), (-1.6, 0.94), (-2.25, 0.9), (-2.32, 0.6)]
        cab = [(1.05, 0.9), (-1.55, 0.92), (-1.0, 1.42), (0.35, 1.44)]
    elif kind == 'hatch':
        L, W, R = 3.95, 1.78, 0.32; wx = (1.24, -1.24)
        body = [(-1.95, 0.3), (1.97, 0.3), (2.0, 0.6), (1.85, 0.78), (0.9, 0.92), (-1.9, 0.95), (-1.98, 0.6)]
        cab = [(0.85, 0.9), (-1.88, 0.93), (-1.72, 1.45), (0.0, 1.47)]
    elif kind == 'suv':
        L, W, R = 4.7, 1.96, 0.4; wx = (1.5, -1.45)
        body = [(-2.35, 0.42), (2.35, 0.42), (2.38, 0.8), (2.25, 1.05), (1.2, 1.15), (-2.3, 1.18), (-2.37, 0.8)]
        cab = [(1.15, 1.12), (-2.28, 1.15), (-2.2, 1.85), (0.45, 1.88)]
    elif kind == 'van':
        L, W, R = 5.0, 2.0, 0.37; wx = (1.65, -1.7)
        body = [(-2.5, 0.38), (2.5, 0.38), (2.52, 0.78), (2.35, 1.05), (1.75, 1.2), (-2.48, 1.2), (-2.52, 0.78)]
        cab = [(1.7, 1.18), (-2.46, 1.18), (-2.44, 2.15), (0.95, 2.18)]
    elif kind == 'pickup':
        L, W, R = 5.2, 1.98, 0.4; wx = (1.7, -1.6)
        body = [(-2.6, 0.45), (2.6, 0.45), (2.62, 0.85), (2.45, 1.12), (1.4, 1.18), (-2.58, 1.18), (-2.62, 0.85)]
        cab = [(1.35, 1.15), (-0.55, 1.15), (-0.5, 1.92), (0.65, 1.94)]
    elif kind == 'boxtruck':
        L, W, R = 6.4, 2.25, 0.46; wx = (2.25, -1.9)
        body = [(-3.2, 0.55), (3.2, 0.55), (3.22, 0.95), (3.05, 1.35), (2.2, 1.45), (1.6, 1.45), (1.6, 0.95), (-3.2, 0.95)]
        cab = [(3.0, 1.4), (1.62, 1.42), (1.62, 2.5), (2.35, 2.52)]
    b = prism('body', body, W, M['paint']); bevel(b, 0.09, 3); apply(b)
    for x in wx: cut(b, x, R, R + 0.07, W)
    parts.append(b)
    c = prism('cabin', cab, W * 0.9, M['glass'], taper=0.12); bevel(c, 0.06, 2); apply(c)
    ztop = max(z for _, z in cab); roof_paint(c, ztop - 0.05); parts.append(c)
    # B/C pillars (painted) so the glasshouse reads as windows
    xs = sorted(x for x, _ in cab); mid = (xs[0] + xs[-1]) / 2
    zlo = min(z for _, z in cab) + 0.02
    if kind in ('sedan', 'hatch', 'suv', 'van'): parts.append(box('bpillar', (mid + 0.15, 0, (zlo + ztop) / 2), (0.1, W * 0.9 - 0.06, ztop - zlo - 0.06), M['paint'], 0))
    if kind == 'boxtruck': parts.append(box('cargo', (-0.75, 0, 2.0), (4.9, W + 0.05, 2.1), M['box'], 0.05)); parts.append(box('chassis', (0, 0, 0.5), (6.2, W * 0.8, 0.25), M['trim'], 0))
    if kind == 'pickup': parts.append(box('bedrail', (-1.55, 0, 1.22), (2.0, W * 0.98, 0.12), M['trim'], 0.02))
    fx = max(x for x, _ in body); rx = min(x for x, _ in body); bz = body[2][1]
    lz = bz - 0.02
    for s in (-1, 1):
        parts.append(box('hl', (fx - 0.02, s * (W / 2 - 0.25), lz + 0.08), (0.08, 0.36, 0.12), M['light_f'], 0.015))
        parts.append(box('tl', (rx + 0.02, s * (W / 2 - 0.22), lz + 0.12), (0.06, 0.3, 0.14), M['light_r'], 0.015))
        parts.append(box('mirror', (max(x for x, _ in cab) - 0.12, s * (W / 2 + 0.08), zlo + 0.12), (0.14, 0.14, 0.1), M['paint'], 0.02))
        for x in wx: parts += wheel(x, s * (W / 2 - 0.12), R, 0.26 if kind != 'boxtruck' else 0.32)
    parts.append(box('grille', (fx + 0.005, 0, lz - 0.02), (0.05, W * 0.42, 0.14), M['trim'], 0.01))
    parts.append(box('fbump', (fx + 0.02, 0, body[0][1] + 0.1), (0.1, W * 0.96, 0.13), M['trim'], 0.02))
    parts.append(box('rbump', (rx - 0.02, 0, body[0][1] + 0.1), (0.1, W * 0.96, 0.13), M['trim'], 0.02))
    parts.append(box('sill', (0, 0, body[0][1] + 0.04), (L * 0.6, W + 0.01, 0.06), M['trim'], 0))
    parts.append(box('chrome', (0, 0, (body[3][1] + body[2][1]) / 2), (L * 0.5, W + 0.012, 0.025), M['chrome'], 0))
    for o in parts:
        for p in o.data.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); o = bpy.context.object; o.name = 'car_' + kind
    md = o.modifiers.new('ws', 'WEIGHTED_NORMAL'); md.keep_sharp = True; apply(o)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons); print('TRIS', kind, tris)
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/rc-{kind}.glb', export_format='GLB', export_yup=True, use_selection=True, export_apply=True)
for k in ['sedan', 'hatch', 'suv', 'van', 'pickup', 'boxtruck']: build(k)
