# Original procedural astronaut (v6) - modelled, posed and rendered in Blender (Cycles). Original art, CC0 by the hub.
# Frames: run(8) fly(6) hit(6) idle(6). Side view, facing right (+X).
import bpy, bmesh, sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blib import *
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/astro'; TEST = 'test' in argv
os.makedirs(OUT, exist_ok=True)
sc = reset(); sc.cycles.samples = 12 if TEST else 72
world('shanghai_bund.hdr', 0.55, 1.2)
V = mathutils.Vector

def fabric(name, col, rough=0.62, scale=38.0, bump=0.18):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = col; p.inputs['Roughness'].default_value = rough
    p.inputs['Sheen Weight'].default_value = 0.5; p.inputs['Sheen Roughness'].default_value = 0.4
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 6
    w = nt.nodes.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 3.0; w.inputs['Distortion'].default_value = 6; w.inputs['Detail'].default_value = 3
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'ADD'
    nt.links.new(n.outputs['Fac'], mx.inputs[0]); nt.links.new(w.outputs['Fac'], mx.inputs[1])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump; b.inputs['Distance'].default_value = 0.02
    nt.links.new(mx.outputs['Value'], b.inputs['Height']); nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m
SUIT = fabric('suit', (0.86, 0.86, 0.83, 1)); SUIT2 = fabric('suit2', (0.78, 0.79, 0.8, 1), 0.7)
STRIPE = fabric('stripe', (0.85, 0.12, 0.05, 1), 0.5, bump=0.1)
RING = mat('ring', (0.55, 0.57, 0.62, 1), 1.0, 0.25); DARK = mat('dark', (0.03, 0.03, 0.035, 1), 0.6, 0.4)
VISOR = mat('visor', (1.0, 0.72, 0.28, 1), 1.0, 0.04); GLOVE = fabric('glove', (0.74, 0.74, 0.72, 1), 0.7)
BOOT = mat('boot', (0.2, 0.2, 0.22, 1), 0.0, 0.55)
TANK = mat('tank', (0.72, 0.74, 0.78, 1), 1.0, 0.22); RED = mat('red', (0.7, 0.04, 0.06, 1), 0.3, 0.3, coat=1.0)
LED_C = mat('ledc', (0.1, 0.9, 1, 1), 0, 0.3, emit=(0.1, 0.9, 1, 1), estr=12); LED_R = mat('ledr', (1, 0.1, 0.2, 1), 0, 0.3, emit=(1, 0.15, 0.25, 1), estr=10)
LED_G = mat('ledg', (0.2, 1, 0.4, 1), 0, 0.3, emit=(0.2, 1, 0.4, 1), estr=8); NOZ = mat('noz', (1, 0.5, 0.15, 1), 0, 0.3, emit=(1, 0.55, 0.2, 1), estr=4)

def link(o): bpy.context.scene.collection.objects.link(o); return o
def empty(name, loc, parent=None):
    e = link(bpy.data.objects.new(name, None)); e.location = loc
    if parent: e.parent = parent
    return e
def smooth(o, sub=2):
    for f in o.data.polygons: f.use_smooth = True
    if sub: m = o.modifiers.new('s', 'SUBSURF'); m.levels = sub; m.render_levels = sub
    return o
def capsule(name, r, L, m, parent, loc=(0, 0, 0), down=True, rx=1.0, ry=1.0):
    """capsule from z=0 down to z=-L (radius r), origin at the joint"""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=r)
    for v in bm.verts:
        v.co.x *= rx; v.co.y *= ry
        if v.co.z < 0: v.co.z -= (L - 2 * r)
        v.co.z -= r
    bm.to_mesh(me); bm.free(); o = link(bpy.data.objects.new(name, me)); o.data.materials.append(m); o.parent = parent; o.location = loc
    for f in o.data.polygons: f.use_smooth = True
    return o
def rbox(name, size, m, parent, loc=(0, 0, 0), bev=0.08, sub=2):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = V((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(me); bm.free(); o = link(bpy.data.objects.new(name, me)); o.data.materials.append(m); o.parent = parent; o.location = loc
    b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = 3
    return smooth(o, sub)
def sphere(name, r, m, parent, loc=(0, 0, 0), scale=(1, 1, 1)):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=r); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.data.materials.append(m); o.parent = parent; o.location = loc; o.scale = scale
    for f in o.data.polygons: f.use_smooth = True
    return o
def ring(name, R, r, m, parent, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32, minor_segments=10, location=(0, 0, 0))
    o = bpy.context.object; o.data.materials.append(m); o.parent = parent; o.location = loc; o.rotation_euler = rot
    for f in o.data.polygons: f.use_smooth = True
    return o
def cyl(name, r, d, m, parent, loc=(0, 0, 0), rot=(0, 0, 0), r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=d)
    else: bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r, radius2=r2, depth=d)
    o = bpy.context.object; o.data.materials.append(m); o.parent = parent; o.location = loc; o.rotation_euler = rot
    for f in o.data.polygons: f.use_smooth = True
    return o

# ---- body ----
ROOT = empty('root', (0, 0, 0)); HIP = empty('hip', (0, 0, 1.02), ROOT); TOR = empty('torso', (0, 0, 0), HIP)
rbox('torso', (0.5, 0.62, 0.72), SUIT, TOR, (0, 0, 0.36), 0.16)
rbox('belt', (0.53, 0.64, 0.1), SUIT2, TOR, (0, 0, 0.02), 0.04)
rbox('chestbox', (0.14, 0.34, 0.2), SUIT2, TOR, (0.26, 0, 0.42), 0.04, 1)
for i, mm in enumerate((LED_C, LED_R, LED_G)): sphere('led', 0.025, mm, TOR, (0.335, -0.09 + i * 0.09, 0.46))
rbox('stripe', (0.52, 0.64, 0.05), STRIPE, TOR, (0, 0, 0.6), 0.02, 1)
NECK = empty('neck', (0, 0, 0.74), TOR)
ring('neckring', 0.24, 0.05, RING, NECK, (0, 0, 0))
sphere('helmet', 0.34, SUIT, NECK, (0.0, 0, 0.3))
sphere('visor', 0.3, VISOR, NECK, (0.13, 0, 0.29), (0.85, 0.96, 0.82))
ring('visorrim', 0.27, 0.035, RING, NECK, (0.17, 0, 0.29), (0, math.radians(90), 0))
sphere('lamp', 0.05, LED_C, NECK, (0.06, -0.3, 0.52))
# jetpack (life-support pack with twin thrusters)
PACK = empty('pack', (-0.36, 0, 0.38), TOR)
rbox('packbox', (0.28, 0.6, 0.78), SUIT2, PACK, (0, 0, 0), 0.07)
for sy in (-0.18, 0.18):
    cyl('tank', 0.13, 0.7, TANK, PACK, (-0.2, sy, 0.0)); sphere('cap', 0.13, TANK, PACK, (-0.2, sy, 0.35))
    cyl('band', 0.135, 0.07, RED, PACK, (-0.2, sy, 0.15))
    cyl('nozzle', 0.09, 0.2, DARK, PACK, (-0.2, sy, -0.45), r2=0.13)
    cyl('noz', 0.1, 0.01, NOZ, PACK, (-0.2, sy, -0.55))
sphere('pled', 0.03, LED_C, PACK, (-0.06, -0.31, 0.25))
# limbs
def arm(side):
    y = 0.36 * side; S = empty('sh%d' % side, (0, y, 0.6), TOR)
    sphere('shoulder', 0.16, SUIT, S, (0, 0, 0))
    capsule('upper', 0.12, 0.42, SUIT, S, (0, 0, 0.0))
    ring('r', 0.115, 0.03, RING, S, (0, 0, -0.38))
    E = empty('el%d' % side, (0, 0, -0.4), S)
    capsule('fore', 0.11, 0.38, SUIT, E); capsule('cuff', 0.115, 0.08, STRIPE, E, (0, 0, -0.24))
    sphere('glove', 0.1, GLOVE, E, (0.02, 0, -0.42), (1.1, 0.9, 1.1))
    return S, E
def leg(side):
    y = 0.16 * side; Hh = empty('hp%d' % side, (0, y, 0.0), HIP)
    capsule('thigh', 0.15, 0.5, SUIT, Hh, (0, 0, 0.05))
    ring('r', 0.14, 0.03, RING, Hh, (0, 0, -0.44))
    K = empty('kn%d' % side, (0, 0, -0.46), Hh)
    capsule('shin', 0.135, 0.42, SUIT, K)
    B = empty('ft%d' % side, (0, 0, -0.42), K)
    rbox('boot', (0.34, 0.2, 0.16), BOOT, B, (0.06, 0, -0.06), 0.06, 1)
    rbox('sole', (0.36, 0.21, 0.04), DARK, B, (0.06, 0, -0.14), 0.02, 1)
    return Hh, K, B
SN, EN = arm(-1); SF, EF = arm(1); HN, KN, FN = leg(-1); HF, KF, FF = leg(1)
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith(('torso', 'helmet')): pass

def ry(o, a): o.rotation_euler = (0, -a, 0)   # positive a swings a hanging limb forward (+X)
def pose(lean=0.1, bob=0.0, sh=(0, 0), el=(0.4, 0.4), th=(0, 0), kn=(0, 0), ft=(0, 0), head=0.0, roll=0.0):
    HIP.location.z = 1.02 + bob; ry(TOR, -lean); ROOT.rotation_euler = (0, roll, 0); ry(NECK, -head)
    ry(SN, sh[0]); ry(SF, sh[1]); ry(EN, el[0]); ry(EF, el[1])
    ry(HN, th[0]); ry(HF, th[1]); ry(KN, -kn[0]); ry(KF, -kn[1]); ry(FN, ft[0]); ry(FF, ft[1])
S = math.sin; C = math.cos
def run(p):
    a = S(p); b = S(p + math.pi)
    k = lambda q: 0.25 + 1.1 * max(0, S(q + 1.3)) ** 1.5
    pose(lean=0.22, bob=0.05 * abs(C(p)), sh=(-0.7 * a, -0.7 * b), el=(0.9 + 0.2 * a, 0.9 + 0.2 * b),
         th=(0.75 * a, 0.75 * b), kn=(k(p), k(p + math.pi)), ft=(0.1 - 0.2 * a, 0.1 - 0.2 * b), head=-0.1)
def fly(p):
    pose(lean=0.32, bob=0.02 * S(p), sh=(0.55 + 0.05 * S(p), 0.75 + 0.05 * S(p + 1)), el=(0.9, 0.8),
         th=(-0.15 + 0.08 * S(p), 0.25 + 0.08 * S(p + 2)), kn=(0.7 + 0.1 * S(p), 0.9 + 0.1 * S(p + 2)), ft=(-0.35, -0.3), head=-0.2)
def hit(p):  # p 0..1
    e = math.sin(min(1, p * 1.6) * math.pi / 2)
    pose(lean=0.1 - 0.75 * e, bob=0.0, sh=(2.4 + 0.6 * e, 2.0 + 0.9 * e + 0.2 * S(p * 9)), el=(0.6 - 0.4 * e, 0.5),
         th=(0.4 + 0.6 * e, 0.8 + 0.4 * e), kn=(0.3 + 0.4 * e, 0.6 + 0.2 * e), ft=(-0.2, -0.3), head=0.35 * e)
def idle(p):
    pose(lean=0.04, bob=-0.01 + 0.012 * S(p), sh=(0.08 + 0.03 * S(p), -0.05 + 0.03 * S(p + 1)), el=(0.35, 0.3),
         th=(0.04, -0.06), kn=(0.08, 0.1), ft=(0, 0), head=0.03 * S(p))
neon_rig((0, 0, 1.25), 7, key=520, rim=1300, front=(0, -1, 0))
# face the camera slightly (3/4 side view) so the visor and chest read well
ROOT.rotation_euler = (0, 0, 0)
cam = ortho_cam((4.6, -10.8, 1.55), (0, 0, 1.25), 3.0, (176, 192))
JOBS = {'run': (run, 8, 'cyc'), 'fly': (fly, 6, 'cyc'), 'hit': (hit, 6, 'lin'), 'idle': (idle, 6, 'cyc')}
which = [a for a in argv[1:] if a in JOBS] or list(JOBS)
for name in which:
    fn, n, kind = JOBS[name]
    for i in range(1 if TEST else n):
        p = (i / n) * math.tau if kind == 'cyc' else i / (n - 1)
        fn(p); bpy.context.view_layer.update(); render(os.path.join(OUT, f'{name}_{i}.png'))
