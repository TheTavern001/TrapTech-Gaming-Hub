# v6 props: original procedural 3D models rendered with the shared neon-night rig (Cycles). Original art by the hub.
import bpy, bmesh, sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blib import *
V = mathutils.Vector
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/props'; os.makedirs(OUT, exist_ok=True)
JOB = argv[1:] or None
SAMPLES = 64

def scene(hdr='shanghai_bund.hdr', hs=0.6, rot=1.2, key=500, rim=900, front=(0, 0, 1), dist=7):
    sc = reset(); sc.cycles.samples = SAMPLES; world(hdr, hs, rot); neon_rig((0, 0, 0), dist, key, rim, front); return sc
def link(o): bpy.context.scene.collection.objects.link(o); return o
def mesh_obj(name, bm, m):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = link(bpy.data.objects.new(name, me))
    if m: o.data.materials.append(m)
    return o
def smooth(o):
    for f in o.data.polygons: f.use_smooth = True
    return o
def bevel(o, w, seg=3): b = o.modifiers.new('b', 'BEVEL'); b.width = w; b.segments = seg; b.limit_method = 'ANGLE'; return o
def subsurf(o, n=2): m = o.modifiers.new('s', 'SUBSURF'); m.levels = n; m.render_levels = n; return o
def cyl(r, d, m, loc=(0, 0, 0), rot=(0, 0, 0), v=64, r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc, rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    o = bpy.context.object; o.data.materials.append(m); return o
def sph(r, m, loc=(0, 0, 0), sc=(1, 1, 1), seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc); o = bpy.context.object; o.scale = sc; o.data.materials.append(m); smooth(o); return o
def torus(R, r, m, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=12, location=loc, rotation=rot); o = bpy.context.object; o.data.materials.append(m); smooth(o); return o
def box(sx, sy, sz, m, loc=(0, 0, 0), bev=0.05, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m); bevel(o, bev, 4); smooth(o); return o
def star(R, r, h, m, z=0, n=5):
    bm = bmesh.new(); vs = [bm.verts.new((math.cos(math.pi / 2 + i * math.pi / n) * (R if i % 2 == 0 else r), math.sin(math.pi / 2 + i * math.pi / n) * (R if i % 2 == 0 else r), 0)) for i in range(2 * n)]
    f = bm.faces.new(vs); ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, h), verts=[e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)])
    o = mesh_obj('star', bm, m); o.location.z = z; bevel(o, 0.012, 2); return o
def gold(name='gold', rough=0.2): return mat(name, (1.0, 0.68, 0.26, 1), 1.0, rough)
def chrome(name='chrome', rough=0.06): return mat(name, (0.92, 0.93, 0.96, 1), 1.0, rough)
def angle_stripes(m, n, width, col2, rmin=0.0, axis='Z'):
    """mix col2 into base colour as n radial stripes (object coords), only where radius > rmin"""
    nt = m.node_tree; p = nt.nodes['Principled BSDF']; base = tuple(p.inputs['Base Color'].default_value)
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    at = nt.nodes.new('ShaderNodeMath'); at.operation = 'ARCTAN2'; nt.links.new(sep.outputs[1], at.inputs[0]); nt.links.new(sep.outputs[0], at.inputs[1])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = n / math.tau; nt.links.new(at.outputs[0], mu.inputs[0])
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(mu.outputs[0], fr.inputs[0])
    lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = width; nt.links.new(fr.outputs[0], lt.inputs[0])
    # radius mask
    vl = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(sep.outputs[0], vl.inputs[0]); nt.links.new(sep.outputs[1], vl.inputs[1])
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; nt.links.new(vl.outputs[0], ln.inputs[0])
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = rmin; nt.links.new(ln.outputs['Value'], gt.inputs[0])
    mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; nt.links.new(lt.outputs[0], mm.inputs[0]); nt.links.new(gt.outputs[0], mm.inputs[1])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs[6].default_value = base; mix.inputs[7].default_value = col2
    nt.links.new(mm.outputs[0], mix.inputs[0]); nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    return ln
def cam_top(scale, res, tilt=0.0, dist=10):
    a = math.radians(tilt); return ortho_cam((0, -math.sin(a) * dist, math.cos(a) * dist), (0, 0, 0), scale, res)
def cam_front(scale, res, yaw=0.0, pitch=0.0, dist=10):
    y, p = math.radians(yaw), math.radians(pitch); return ortho_cam((math.sin(y) * math.cos(p) * dist, -math.cos(y) * math.cos(p) * dist, math.sin(p) * dist), (0, 0, 0), scale, res)
def clear():
    for o in list(bpy.data.objects):
        if o.type not in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o, do_unlink=True)

JOBS = {}
def job(f): JOBS[f.__name__] = f; return f

@job
def coin():
    scene(front=(0, -1, 0)); G = gold('g', 0.22)
    c = cyl(1, 0.16, G, rot=(math.pi / 2, 0, 0), v=96); bevel(c, 0.04, 4); smooth(c)
    for s in (-1, 1):
        t = torus(0.84, 0.035, G, (0, s * 0.08, 0), (math.pi / 2, 0, 0))
        st = star(0.6, 0.26, 0.06, G); st.rotation_euler = (-s * math.pi / 2, 0, 0); st.location = (0, s * 0.07, 0)
    # reeded edge
    angle_stripes(G, 90, 0.5, (0.75, 0.5, 0.18, 1), 0.97, 'Y')
    root = bpy.data.objects.new('r', None); link(root)
    for o in bpy.data.objects:
        if o.type == 'MESH': o.parent = root
    cam_front(2.3, (96, 96), pitch=8); area('ck', (0, -6, 2.5), (0, 0, 0), 300, (1, 0.9, 0.75), 4)
    for i in range(8):
        root.rotation_euler = (0, 0, i / 8 * math.pi); render(f'{OUT}/coin_{i}.png')

@job
def saw():
    scene(front=(0, -0.45, 1)); steel = mat('steel', (0.5, 0.52, 0.56, 1), 1.0, 0.26)
    p = steel.node_tree.nodes['Principled BSDF']; p.inputs['Anisotropic'].default_value = 0.8
    bm = bmesh.new(); n = 28; vs = []
    for i in range(n):
        a0 = i / n * math.tau; a1 = (i + 0.72) / n * math.tau
        vs.append(bm.verts.new((math.cos(a0) * 0.86, math.sin(a0) * 0.86, 0))); vs.append(bm.verts.new((math.cos(a1) * 1.0, math.sin(a1) * 1.0, 0)))
    f = bm.faces.new(vs); ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, 0.05), verts=[e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)])
    o = mesh_obj('blade', bm, steel); bevel(o, 0.006, 1)
    red = mat('red', (0.7, 0.02, 0.04, 1), 0.3, 0.35, coat=1)
    cyl(0.6, 0.07, red, (0, 0, 0.02)); dark = mat('dark', (0.05, 0.05, 0.06, 1), 0.9, 0.3)
    cyl(0.28, 0.12, dark, (0, 0, 0.04)); cyl(0.12, 0.16, chrome('c'), (0, 0, 0.05))
    for i in range(6):
        a = i / 6 * math.tau; cyl(0.04, 0.14, chrome('c2', 0.15), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.06), v=16)
    for i in range(3):
        a = i / 3 * math.tau + 0.4; bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.09, depth=0.2, location=(math.cos(a) * 0.73, math.sin(a) * 0.73, 0.02))
        h = bpy.context.object; h.data.materials.append(dark)
    cam_top(2.08, (160, 160)); render(f'{OUT}/saw.png')

@job
def zapnode():
    scene(front=(0, -0.45, 1)); dark = mat('d', (0.04, 0.04, 0.05, 1), 0.8, 0.3)
    b = cyl(1.0, 0.3, dark, v=64); bevel(b, 0.08, 3); smooth(b)
    torus(0.8, 0.09, chrome('c', 0.1), (0, 0, 0.18))
    for i in range(8):
        a = i / 8 * math.tau; box(0.16, 0.08, 0.1, mat('y', (1, 0.75, 0.05, 1), 0.2, 0.3, coat=1), (math.cos(a) * 0.93, math.sin(a) * 0.93, 0.12), 0.02, (0, 0, a))
    sph(0.48, mat('core', (1, 0.9, 0.4, 1), 0, 0.2, emit=(1, 0.7, 0.1, 1), estr=3), (0, 0, 0.15), (1, 1, 0.6))
    gl = mat('glass', (1, 1, 1, 1), 0, 0.02); gl.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 1
    sph(0.6, gl, (0, 0, 0.2), (1, 1, 0.6))
    cam_top(2.2, (96, 96), tilt=15); render(f'{OUT}/zapnode.png')

@job
def rocket():
    scene(front=(0, -1, 0)); white = mat('w', (0.85, 0.86, 0.88, 1), 0.3, 0.3, coat=0.6); red = mat('r', (0.75, 0.03, 0.05, 1), 0.2, 0.3, coat=1)
    dark = mat('d', (0.05, 0.05, 0.06, 1), 0.8, 0.3)
    b = cyl(0.22, 1.5, white, (0.1, 0, 0), (0, math.pi / 2, 0)); smooth(b)
    n = cyl(0.22, 0.55, red, (-0.92, 0, 0), (0, -math.pi / 2, 0), r2=0.0); smooth(n)
    cyl(0.225, 0.12, red, (0.35, 0, 0), (0, math.pi / 2, 0)); cyl(0.225, 0.05, dark, (-0.3, 0, 0), (0, math.pi / 2, 0))
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4; f = box(0.42, 0.03, 0.3, red, (0.7, math.cos(a) * 0.3, math.sin(a) * 0.3), 0.01, (a, 0, 0))
    cyl(0.18, 0.2, dark, (0.95, 0, 0), (0, math.pi / 2, 0), r2=0.13)
    cyl(0.15, 0.02, mat('e', (1, 0.5, 0.1, 1), 0, 0.3, emit=(1, 0.5, 0.1, 1), estr=10), (1.055, 0, 0), (0, math.pi / 2, 0))
    cam_front(2.5, (160, 64), yaw=0, pitch=12); render(f'{OUT}/rocket.png')

@job
def shield():
    scene(front=(0, -1, 0))
    gl = mat('glass', (0.7, 0.9, 1, 1), 0, 0.03); gl.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 1
    sph(1.0, gl)
    bm = bmesh.new(); pts = [(0, 0.62), (0.5, 0.42), (0.46, -0.08), (0, -0.62), (-0.46, -0.08), (-0.5, 0.42)]
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in pts]); ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0.16, 0), verts=[e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)])
    o = mesh_obj('sh', bm, mat('core', (0.2, 0.7, 1, 1), 0, 0.2, emit=(0.1, 0.55, 1, 1), estr=2.5)); o.location.y = -0.08; bevel(o, 0.04, 3)
    torus(1.0, 0.025, chrome('c'), (0, 0, 0), (math.pi / 2, 0, 0))
    cam_front(2.15, (96, 96), pitch=5); render(f'{OUT}/shield.png')

@job
def balls():
    scene(hs=1.0, front=(0, -1, 0)); s = sph(1, chrome('c', 0.05), seg=64); cam_front(2.04, (64, 64), pitch=20); render(f'{OUT}/ball_chrome.png')
    s.data.materials[0] = mat('ivory', (0.92, 0.9, 0.84, 1), 0, 0.12, coat=1); render(f'{OUT}/ball_ivory.png')
    s.data.materials[0] = gold('g', 0.12); render(f'{OUT}/ball_gold.png')

CHIP = {'white': (0.86, 0.86, 0.84), 'lime': (0.35, 0.7, 0.05), 'cyan': (0.0, 0.55, 0.7), 'blue': (0.05, 0.2, 0.75), 'purple': (0.35, 0.12, 0.7),
        'pink': (0.85, 0.15, 0.45), 'orange': (0.9, 0.35, 0.03), 'yellow': (0.95, 0.75, 0.05), 'amber': (0.85, 0.5, 0.02), 'red': (0.7, 0.03, 0.05), 'black': (0.03, 0.03, 0.035), 'green': (0.02, 0.4, 0.15)}
@job
def chips():
    scene(front=(0, -0.4, 1)); cam_top(2.1, (128, 128), tilt=14)
    for name, c in CHIP.items():
        clear(); base = mat('b' + name, (*c, 1), 0, 0.42, coat=0.35)
        ins = (0.95, 0.95, 0.93, 1) if name != 'white' else (0.1, 0.25, 0.7, 1)
        ln = angle_stripes(base, 6, 0.32, ins, 0.74)
        o = cyl(1, 0.2, base, v=96); bevel(o, 0.05, 4); smooth(o)
        inner = mat('i' + name, tuple(min(1, k * 1.25 + 0.05) for k in c) + (1,), 0, 0.3, coat=0.6)
        cyl(0.62, 0.006, inner, (0, 0, 0.101), v=96)
        torus(0.66, 0.012, mat('rr', ins, 0, 0.3), (0, 0, 0.1))
        render(f'{OUT}/chip_{name}.png')
    clear(); G = gold('g', 0.18); o = cyl(1, 0.2, G, v=96); bevel(o, 0.05, 4); smooth(o); angle_stripes(G, 6, 0.32, (0.08, 0.08, 0.09, 1), 0.74)
    cyl(0.62, 0.006, gold('g2', 0.08), (0, 0, 0.101), v=96); torus(0.66, 0.012, mat('rr', (0.1, 0.1, 0.1, 1), 0.5, 0.3), (0, 0, 0.1)); render(f'{OUT}/chip_gold.png')

BRICK = {'red': (0.8, 0.05, 0.06), 'orange': (0.95, 0.35, 0.02), 'yellow': (0.95, 0.75, 0.04), 'lime': (0.45, 0.85, 0.08), 'cyan': (0.02, 0.7, 0.85), 'violet': (0.45, 0.25, 0.95), 'pink': (0.95, 0.2, 0.6)}
@job
def bricks():
    scene(front=(0, -0.3, 1)); cam_top(2.64, (128, 56), tilt=10)
    for name, c in BRICK.items():
        clear(); m = mat('m' + name, (*c, 1), 0, 0.12, emit=(*c, 1), estr=0.35, coat=1)
        m.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value = 0.3
        box(2.4, 1.0, 0.45, m, bev=0.14); render(f'{OUT}/brick_{name}.png')
    clear(); box(2.4, 1.0, 0.45, gold('g', 0.16), bev=0.14); star(0.32, 0.14, 0.05, gold('g2', 0.1), 0.22); render(f'{OUT}/brick_gold.png')
    clear(); st = mat('st', (0.6, 0.62, 0.66, 1), 1, 0.3); st.node_tree.nodes['Principled BSDF'].inputs['Anisotropic'].default_value = 0.5
    box(2.4, 1.0, 0.45, st, bev=0.1)
    for x in (-1.0, 1.0):
        for y in (-0.32, 0.32): sph(0.06, chrome('c'), (x, y, 0.22))
    render(f'{OUT}/brick_steel.png')

@job
def paddle():
    scene(front=(0, -0.4, 1))
    b = cyl(0.42, 4.2, chrome('c', 0.12), rot=(0, math.pi / 2, 0)); smooth(b)
    for s in (-1, 1): sph(0.42, chrome('c', 0.12), (s * 2.1, 0, 0))
    cyl(0.43, 1.6, mat('n', (0.1, 0.9, 1, 1), 0, 0.2, emit=(0.1, 0.85, 1, 1), estr=4), rot=(0, math.pi / 2, 0))
    for s in (-1, 1): cyl(0.435, 0.16, mat('p', (1, 0.2, 0.7, 1), 0, 0.2, emit=(1, 0.2, 0.75, 1), estr=4), (s * 1.55, 0, 0), (0, math.pi / 2, 0))
    cam_top(5.2, (256, 56), tilt=30); render(f'{OUT}/paddle.png')

@job
def bomb():
    scene(front=(0, -1, 0.3))
    sph(1, mat('b', (0.02, 0.02, 0.025, 1), 0.4, 0.18, coat=1), seg=64)
    c = cyl(0.32, 0.3, mat('m', (0.5, 0.5, 0.55, 1), 1, 0.3), (0.38, 0, 0.88), (0, 0.4, 0)); bevel(c, 0.04, 2); smooth(c)
    cu = bpy.data.curves.new('fuse', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.06; sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
    for i, (p, h) in enumerate([((0.45, 0, 1.0), (0.4, 0, 0.9)), ((0.7, 0, 1.35), (0.55, 0, 1.25)), ((1.05, 0, 1.4), (0.9, 0, 1.45))]):
        bp = sp.bezier_points[i]; bp.co = p; bp.handle_left = h; bp.handle_right = tuple(2 * a - b for a, b in zip(p, h))
    f = link(bpy.data.objects.new('fuse', cu)); f.data.materials.append(mat('rope', (0.5, 0.35, 0.18, 1), 0, 0.8))
    sph(0.12, mat('sp', (1, 0.7, 0.2, 1), 0, 0.3, emit=(1, 0.6, 0.15, 1), estr=30), (1.07, 0, 1.4))
    # red warning band
    torus(0.99, 0.05, mat('r', (0.9, 0.05, 0.05, 1), 0, 0.3, emit=(1, 0.05, 0.05, 1), estr=3), (0, 0, 0), (math.pi / 2 - 0.25, 0, 0))
    cam_front(3.2, (128, 128), yaw=-15, pitch=12); bpy.context.scene.camera.location.z += 0.35 * 0; render(f'{OUT}/bomb.png')

@job
def spinner():
    scene(front=(0, -0.3, 1))
    bm = bmesh.new(); pts = [(0, -1.0), (0.42, 0.25), (0.3, 0.55), (0, 0.65), (-0.3, 0.55), (-0.42, 0.25)]
    f = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in pts]); ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, 0.18), verts=[e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)])
    o = mesh_obj('ptr', bm, gold('g', 0.16)); bevel(o, 0.06, 4); smooth(o)
    sph(0.13, mat('gem', (1, 0.1, 0.3, 1), 0, 0.02, emit=(1, 0.1, 0.35, 1), estr=2), (0, 0.35, 0.22), (1, 1, 0.6))
    cam_top(2.2, (96, 128), tilt=8); bpy.context.scene.camera.data.ortho_scale = 2.0; bpy.context.scene.render.resolution_x = 72; bpy.context.scene.render.resolution_y = 96
    bpy.context.scene.camera.location.y -= 0.0; render(f'{OUT}/pointer.png')
    clear(); h = cyl(1, 0.3, chrome('c', 0.1), v=96); bevel(h, 0.12, 4); smooth(h)
    torus(0.8, 0.05, gold('g', 0.15), (0, 0, 0.16))
    sph(0.42, mat('gem', (0.5, 0.1, 1, 1), 0, 0.02, emit=(0.5, 0.15, 1, 1), estr=1.5), (0, 0, 0.18), (1, 1, 0.55))
    for i in range(8):
        a = i / 8 * math.tau; sph(0.07, gold('g', 0.15), (math.cos(a) * 0.62, math.sin(a) * 0.62, 0.16))
    cam_top(2.1, (128, 128)); render(f'{OUT}/hub.png')

@job
def snake():
    scene(front=(0, -0.3, 1))
    sk = mat('skin', (0.05, 0.42, 0.18, 1), 0, 0.28, coat=0.8); nt = sk.node_tree; p = nt.nodes['Principled BSDF']
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 9; vo.feature = 'DISTANCE_TO_EDGE'
    bu = nt.nodes.new('ShaderNodeBump'); bu.inputs['Strength'].default_value = 0.6; nt.links.new(vo.outputs['Distance'], bu.inputs['Height']); nt.links.new(bu.outputs['Normal'], p.inputs['Normal'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (0.01, 0.12, 0.05, 1); cr.color_ramp.elements[1].position = 0.12; cr.color_ramp.elements[1].color = (0.12, 0.62, 0.25, 1)
    nt.links.new(vo.outputs['Distance'], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], p.inputs['Base Color'])
    sph(1, sk, (0, 0, 0), (1, 1, 0.6)); cam_top(2.1, (96, 96)); render(f'{OUT}/snake_body.png')
    clear(); sph(1, sk, (0, 0, 0), (1.15, 0.92, 0.55))
    eye = mat('eye', (0.9, 0.7, 0.05, 1), 0, 0.05, coat=1); pup = mat('pup', (0, 0, 0, 1), 0, 0.05)
    for s in (-1, 1):
        sph(0.2, eye, (0.45, s * 0.5, 0.33), (1, 1, 0.8)); sph(0.09, pup, (0.55, s * 0.55, 0.45), (0.6, 1, 0.6))
        sph(0.05, pup, (1.05, s * 0.18, 0.2))
    cam_top(2.4, (96, 96)); render(f'{OUT}/snake_head.png')

@job
def target():
    scene(front=(0, -0.3, 1))
    cols = [(0.9, 0.9, 0.88), (0.75, 0.03, 0.05)] * 5
    for i, r in enumerate([1.0, 0.82, 0.64, 0.46, 0.28, 0.12]):
        c = cyl(r, 0.2 + i * 0.012, mat('t%d' % i, (*cols[i], 1), 0, 0.45, coat=0.4), (0, 0, i * 0.006), v=96)
    t = torus(1.0, 0.06, chrome('c', 0.15), (0, 0, 0.08))
    cyl(0.05, 0.3, gold('g'), (0, 0, 0.1), v=24)
    cam_top(2.2, (128, 128), tilt=12); render(f'{OUT}/target.png')

for name, fn in JOBS.items():
    if JOB and name not in JOB: continue
    print('JOB', name); fn()
