# v7 photoreal art pass: original procedural 3D models, PBR materials, HDRI + area lights, Cycles + OIDN.
# Run headless:  blender -b --python tools/v7/r_v7.py -- OUTDIR job [job ...]
# Jobs: snacks, grow, sling, haze, wheel, growroom. Every model here is original (modelled in code for the hub).
import bpy, bmesh, sys, os, math, random, mathutils
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v6'))
from blib import *
V = mathutils.Vector
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/v7'; os.makedirs(OUT, exist_ok=True)
JOBS_ARG = argv[1:]
SAMPLES = int(os.environ.get('SAMPLES', '64'))
random.seed(7)

def scene(hdr='studio_small_09.hdr', hs=0.5, rot=1.2, key=500, rim=700, front=(0, -1, 0.6), dist=7, samples=None):
    sc = reset(); sc.cycles.samples = samples or SAMPLES; world(hdr, hs, rot); neon_rig((0, 0, 0), dist, key, rim, front)
    sc.render.use_motion_blur = False; return sc
def link(o): bpy.context.scene.collection.objects.link(o); return o
def smooth(o):
    for f in o.data.polygons: f.use_smooth = True
    return o
def mod_bevel(o, w, seg=3): b = o.modifiers.new('b', 'BEVEL'); b.width = w; b.segments = seg; b.limit_method = 'ANGLE'; return o
def subsurf(o, n=2): m = o.modifiers.new('s', 'SUBSURF'); m.levels = n; m.render_levels = n; return o
def disp(o, strength=0.05, scale=2.0, kind='CLOUDS'):
    t = bpy.data.textures.new('t' + o.name, kind); t.noise_scale = scale; m = o.modifiers.new('d', 'DISPLACE'); m.texture = t; m.strength = strength; return o
def cyl(r, d, m, loc=(0, 0, 0), rot=(0, 0, 0), v=64, r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc, rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    o = bpy.context.object; o.data.materials.append(m); return o
def sph(r, m, loc=(0, 0, 0), sc=(1, 1, 1), seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc); o = bpy.context.object; o.scale = sc; o.data.materials.append(m); smooth(o); return o
def ico(r, m, loc=(0, 0, 0), sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc); o = bpy.context.object; o.data.materials.append(m); smooth(o); return o
def torus(R, r, m, loc=(0, 0, 0), rot=(0, 0, 0), seg=64, mseg=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=mseg, location=loc, rotation=rot); o = bpy.context.object; o.data.materials.append(m); smooth(o); return o
def box(sx, sy, sz, m, loc=(0, 0, 0), bev=0.05, rot=(0, 0, 0), seg=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m); 
    if bev: mod_bevel(o, bev, seg)
    smooth(o); return o
def tube(points, r, m, res=8):
    cu = bpy.data.curves.new('c', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3; sp = cu.splines.new('POLY'); sp.points.add(len(points) - 1)
    for i, p in enumerate(points): sp.points[i].co = (p[0], p[1], p[2], 1)
    o = link(bpy.data.objects.new('tube', cu)); o.data.materials.append(m); return o
def clear():
    for o in list(bpy.data.objects):
        if o.type not in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o, do_unlink=True)
def group(objs, name='grp'):
    root = link(bpy.data.objects.new(name, None))
    for o in objs: o.parent = root
    return root
def cam_top(scale, res, tilt=0.0, dist=10):
    a = math.radians(tilt); return ortho_cam((0, -math.sin(a) * dist, math.cos(a) * dist), (0, 0, 0), scale, res)
def cam_front(scale, res, yaw=0.0, pitch=0.0, dist=10, target=(0, 0, 0)):
    y, p = math.radians(yaw), math.radians(pitch); t = V(target); return ortho_cam(tuple(t + V((math.sin(y) * math.cos(p) * dist, -math.cos(y) * math.cos(p) * dist, math.sin(p) * dist))), target, scale, res)
def node_noise_bump(m, scale=40, strength=0.2, detail=8):
    nt = m.node_tree; p = nt.nodes['Principled BSDF']; n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = strength; nt.links.new(n.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs['Normal'], p.inputs['Normal']); return n
def node_color_noise(m, c1, c2, scale=8, detail=6, ramp=(0.35, 0.65)):
    nt = m.node_tree; p = nt.nodes['Principled BSDF']; n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = ramp[0]; cr.color_ramp.elements[0].color = c1; cr.color_ramp.elements[1].position = ramp[1]; cr.color_ramp.elements[1].color = c2
    nt.links.new(n.outputs['Fac'], cr.inputs[0]); nt.links.new(cr.outputs[0], p.inputs['Base Color']); return n
def wood_mat(name, c1=(0.35, 0.17, 0.07, 1), c2=(0.16, 0.07, 0.03, 1), rough=0.45, coat=0.0, scale=3.0):
    m = mat(name, c1, 0, rough, coat=coat); nt = m.node_tree; p = nt.nodes['Principled BSDF']
    w = nt.nodes.new('ShaderNodeTexWave'); w.wave_type = 'RINGS'; w.inputs['Scale'].default_value = scale; w.inputs['Distortion'].default_value = 6; w.inputs['Detail'].default_value = 4
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = c1; cr.color_ramp.elements[1].color = c2
    nt.links.new(w.outputs['Fac'], cr.inputs[0]); nt.links.new(cr.outputs[0], p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.08; nt.links.new(w.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs['Normal'], p.inputs['Normal']); return m
def glass_mat(name, col=(0.85, 0.95, 1, 1), rough=0.02, ior=1.45):
    m = mat(name, col, 0, rough); p = m.node_tree.nodes['Principled BSDF']; p.inputs['Transmission Weight'].default_value = 1.0; p.inputs['IOR'].default_value = ior; return m
def leaf_mat(name='leaf', col=(0.09, 0.28, 0.05, 1)):
    m = mat(name, col, 0, 0.42); p = m.node_tree.nodes['Principled BSDF']
    try: p.inputs['Subsurface Weight'].default_value = 0.25; p.inputs['Subsurface Radius'].default_value = (0.2, 0.6, 0.1)
    except Exception: pass
    p.inputs['Coat Weight'].default_value = 0.15; p.inputs['Sheen Weight'].default_value = 0.15
    node_color_noise(m, col, (col[0] * 1.5, col[1] * 1.35, col[2] * 1.1, 1), scale=14, ramp=(0.3, 0.75)); return m
def emit_mat(name, col, s): m = mat(name, (0, 0, 0, 1), 0, 0.5, emit=col, estr=s); return m

# ---------------------- cannabis plant (original procedural model) ----------------------
def leaflet_mesh(L=1.0, W=0.16, teeth=13):
    bm = bmesh.new(); n = 26; left = []; right = []
    for i in range(n + 1):
        t = i / n; w = W * (math.sin(math.pi * min(1, t ** 0.85)) ** 1.15)
        saw = 1 + 0.16 * ((t * teeth) % 1.0) * (1 if 0.06 < t < 0.94 else 0)
        y = t * L; z = -0.18 * (t - 0.4) ** 2 * L + 0.05 * L
        left.append(bm.verts.new((-w * saw, y, z + w * 0.35))); right.append(bm.verts.new((w * saw, y, z + w * 0.35)))
    mid = [bm.verts.new((0, i / n * L, -0.18 * (i / n - 0.4) ** 2 * L + 0.05 * L)) for i in range(n + 1)]
    for i in range(n):
        bm.faces.new((left[i], mid[i], mid[i + 1], left[i + 1])); bm.faces.new((mid[i], right[i], right[i + 1], mid[i + 1]))
    me = bpy.data.meshes.new('leaflet'); bm.to_mesh(me); bm.free(); return me
_LEAF = {}
def fan_leaf(m, scale=1.0, n=7):
    me = _LEAF.get(m.name)
    try: me and me.name
    except ReferenceError: me = None
    if not me: me = _LEAF[m.name] = leaflet_mesh(); me.materials.append(m)
    lens = [1, 0.86, 0.86, 0.62, 0.62, 0.36, 0.36, 0.2, 0.2][:n]; angs = [0, 28, -28, 56, -56, 84, -84, 110, -110][:n]; parts = []
    for L, a in zip(lens, angs):
        o = link(bpy.data.objects.new('lf', me))
        o.scale = (scale * (0.8 + 0.2 * L), scale * L, scale); o.rotation_euler = (math.radians(-10 + 8 * abs(a) / 90), 0, math.radians(a)); parts.append(o)
    root = group(parts, 'fan'); return root
def plant(m_leaf, m_stem, m_bud, height=2.0, seed=1, buds=True, nodes=9):
    """lush flowering plant: alternating branch pairs, big 7/9-finger fan leaves, sugar leaves and frosty colas on the top third"""
    random.seed(seed); objs = []
    st = cyl(0.04, height, m_stem, loc=(0, 0, height / 2), v=12, r2=0.014); objs.append(st)
    for k in range(nodes):
        h = 0.18 + k * (height - 0.3) / nodes; sz = 0.95 * (1.0 - 0.055 * k) * (0.9 + 0.2 * random.random()); rot = k * math.pi / 2 + random.uniform(-0.35, 0.35)
        for side in (0, math.pi):
            a = rot + side; br = 0.3 + 0.5 * (1 - k / nodes); up = 0.25 + 0.2 * (1 - k / nodes)
            tip = V((math.cos(a) * br, math.sin(a) * br, h + up)); tb = tube([(0, 0, h), (tip.x * 0.55, tip.y * 0.55, h + up * 0.45), tuple(tip)], 0.014, m_stem); objs.append(tb)
            f = fan_leaf(m_leaf, sz, 9 if k < 3 else 7 if k < nodes - 2 else 5); f.location = (tip.x * 0.6, tip.y * 0.6, h + up * 0.5); f.rotation_euler = (math.radians(30 + random.uniform(-10, 18)), 0, a - math.pi / 2); objs.append(f)
            f2 = fan_leaf(m_leaf, sz * 0.7, 7 if k < nodes - 2 else 5); f2.location = tip; f2.rotation_euler = (math.radians(40 + random.uniform(-10, 10)), 0, a - math.pi / 2 + random.uniform(-0.6, 0.6)); objs.append(f2)
            if buds and k >= nodes - 5: objs += cola(m_bud, m_leaf, tip + V((0, 0, 0.03)), 0.08 + 0.018 * (k - nodes + 5), 0.24)
    if buds: objs += cola(m_bud, m_leaf, V((0, 0, height - 0.05)), 0.15, 0.5)
    for i in range(3):
        top = fan_leaf(m_leaf, 0.45, 5); top.location = (0, 0, height - 0.25 - i * 0.1); top.rotation_euler = (math.radians(50), 0, 0.4 + i * 2.1); objs.append(top)
    return group(objs, 'plant')
def cola(m_bud, m_leaf, base, r, h):
    out = []
    for i in range(int(14 + h * 30)):
        t = random.random(); z = t * h; rr = r * (1 - 0.6 * t) * (0.6 + 0.4 * random.random()); a = random.random() * math.tau
        o = ico(rr * 0.55, m_bud, tuple(base + V((math.cos(a) * rr * 0.6, math.sin(a) * rr * 0.6, z))), sub=2); out.append(o)
    for i in range(5):
        a = i / 5 * math.tau; f = fan_leaf(m_leaf, 0.12, 3); f.location = base + V((0, 0, h * 0.5 * random.random())); f.rotation_euler = (math.radians(60), 0, a); out.append(f)
    return out
def bud_mat():
    m = mat('bud', (0.32, 0.45, 0.16, 1), 0, 0.5); nt = m.node_tree; p = nt.nodes['Principled BSDF']
    # frosty trichome speckle + orange pistil flecks
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 260
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[0].color = (0.95, 0.95, 0.9, 1); cr.color_ramp.elements[1].position = 0.12; cr.color_ramp.elements[1].color = (0.3, 0.46, 0.15, 1)
    e = cr.color_ramp.elements.new(0.75); e.color = (0.38, 0.5, 0.18, 1); e2 = cr.color_ramp.elements.new(0.93); e2.color = (0.85, 0.42, 0.12, 1)
    nt.links.new(v.outputs['Distance'], cr.inputs[0]); nt.links.new(cr.outputs[0], p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.5; nt.links.new(v.outputs['Distance'], b.inputs['Height']); nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Sheen Weight'].default_value = 0.6; return m
def fabric_pot(r=0.45, h=0.5):
    m = mat('fabric', (0.05, 0.05, 0.055, 1), 0, 0.95); node_noise_bump(m, 180, 0.35)
    p = cyl(r, h, m, loc=(0, 0, h / 2), v=48, r2=r * 1.06); mod_bevel(p, 0.03, 3); smooth(p)
    soil = mat('soil', (0.08, 0.05, 0.03, 1), 0, 1.0); node_noise_bump(soil, 60, 0.9)
    s = cyl(r * 0.98, 0.02, soil, loc=(0, 0, h - 0.04), v=48); disp(s, 0.02, 0.05)
    return [p, s]

# ---------------------- jobs ----------------------
JOBS = {}
def job(f): JOBS[f.__name__] = f; return f
def R(path): render(os.path.join(OUT, path))
def ensure(d): os.makedirs(os.path.join(OUT, d), exist_ok=True)

@job
def snacks():
    """Neon Munchies pickups, top-down 3/4: donut, cookie, pizza slice, golden brownie, mint (chill) - 320 px renders."""
    ensure('snacks')
    def setup(): scene(front=(0, -0.6, 1), dist=6, key=420, rim=500); cam_top(2.4, (320, 320), tilt=28)
    # donut
    setup(); dough = mat('dough', (0.62, 0.36, 0.15, 1), 0, 0.6); node_noise_bump(dough, 30, 0.3)
    icing = mat('icing', (0.98, 0.36, 0.62, 1), 0, 0.18, coat=0.6)
    d = torus(0.62, 0.3, dough); d.scale = (1, 1, 0.8)
    ic = torus(0.62, 0.27, icing, loc=(0, 0, 0.1)); ic.scale = (1.02, 1.02, 0.55); disp(ic, 0.035, 0.4)
    cols = [(1, 0.95, 0.2, 1), (0.2, 0.8, 1, 1), (1, 1, 1, 1), (0.5, 0.95, 0.3, 1), (0.7, 0.3, 1, 1)]
    for i in range(46):
        a = random.random() * math.tau; rr = 0.62 + random.uniform(-0.2, 0.2)
        s = cyl(0.022, 0.1, mat('sp%d' % (i % 5), cols[i % 5], 0, 0.3, coat=0.5), loc=(math.cos(a) * rr, math.sin(a) * rr, 0.27), rot=(math.pi / 2, 0, random.random() * 3), v=8)
    R('snacks/donut.png')
    # cookie
    setup(); cm = mat('cookie', (0.7, 0.42, 0.16, 1), 0, 0.7); node_color_noise(cm, (0.8, 0.5, 0.2, 1), (0.48, 0.25, 0.08, 1), 4); node_noise_bump(cm, 12, 0.45)
    c = cyl(0.85, 0.2, cm, v=64); disp(c, 0.06, 0.3); subsurf(c, 1)
    ch = mat('choc', (0.12, 0.05, 0.02, 1), 0, 0.3, coat=0.3)
    for i in range(11):
        a = random.random() * math.tau; rr = random.random() * 0.68; o = ico(0.13, ch, (math.cos(a) * rr, math.sin(a) * rr, 0.1), 1); o.scale = (1, 1, 0.7); disp(o, 0.03, 0.1)
    R('snacks/cookie.png')
    # pizza slice (tip down, crust arc on top)
    setup(); crust = mat('crust', (0.78, 0.48, 0.18, 1), 0, 0.7); node_noise_bump(crust, 40, 0.5)
    arc = [(-0.27 + x * 0.045) for x in range(13)]; tip = (0, -0.95)
    def wedge(scale, z, thick, m):
        bm = bmesh.new(); vs = [bm.verts.new((tip[0], tip[1], z))] + [bm.verts.new((math.sin(a) * 1.85 * scale, tip[1] + math.cos(a) * 1.85 * scale, z)) for a in arc]
        f = bm.faces.new(vs); ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, thick), verts=[e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)])
        me = bpy.data.meshes.new('pz'); bm.to_mesh(me); bm.free(); o = link(bpy.data.objects.new('pz', me)); o.data.materials.append(m); return o
    pz = wedge(1.0, 0, 0.1, crust); mod_bevel(pz, 0.03, 2)
    cheese = mat('cheese', (1.0, 0.72, 0.2, 1), 0, 0.3, coat=0.4); node_color_noise(cheese, (1.0, 0.82, 0.32, 1), (0.92, 0.5, 0.08, 1), 9)
    ch = wedge(0.93, 0.1, 0.035, cheese); subsurf(ch, 1); disp(ch, 0.025, 0.15)
    tube([(math.sin(a) * 1.82, tip[1] + math.cos(a) * 1.82, 0.12) for a in arc], 0.1, crust)
    pep = mat('pep', (0.6, 0.08, 0.05, 1), 0, 0.35, coat=0.4); node_noise_bump(pep, 50, 0.3)
    for (x, y) in [(0, -0.3), (0.2, 0.3), (-0.2, 0.32), (0.0, 0.05), (0.05, 0.6), (-0.04, -0.58)]:
        o = cyl(0.12 if y > -0.5 else 0.07, 0.03, pep, loc=(x, y, 0.15), v=24); disp(o, 0.008, 0.1)
    R('snacks/pizza.png')
    # golden brownie (gold leaf)
    setup(); br = mat('brownie', (0.16, 0.07, 0.03, 1), 0, 0.65); node_noise_bump(br, 22, 0.9)
    b = box(1.25, 1.25, 0.45, br, bev=0.06); disp(b, 0.03, 0.5)
    gl = mat('goldleaf', (1.0, 0.72, 0.25, 1), 1.0, 0.25); node_noise_bump(gl, 30, 0.6)
    for i in range(7):
        o = box(random.uniform(0.15, 0.35), random.uniform(0.12, 0.3), 0.01, gl, loc=(random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), 0.235), bev=0, rot=(0, 0, random.random() * 3)); disp(o, 0.02, 0.05)
    area('glow', (0, -2, 3), (0, 0, 0), 300, (1, 0.8, 0.4), 2)
    R('snacks/brownie.png')
    # mint (chill power-up): frosted ice cube with a mint leaf
    setup(); ice = glass_mat('ice', (0.8, 0.95, 1, 1), 0.12, 1.31); c = box(0.95, 0.95, 0.95, ice, bev=0.12, rot=(0.2, 0.15, 0.5)); disp(c, 0.02, 0.4)
    lm = leaf_mat('mint', (0.15, 0.55, 0.15, 1)); f = fan_leaf(lm, 0.55, 1); f.location = (-0.1, -0.3, 0.55); f.rotation_euler = (0.4, 0, 2.2)
    R('snacks/mint.png')

@job
def grow():
    """Grow Guard: plants in fabric pots, pests, gadgets, light drop (3/4 view)."""
    ensure('grow')
    def setup(scale=2.4, res=(320, 320), pitch=28, target=(0, 0, 0)): scene(front=(0, -1, 0.7), dist=7, key=520, rim=650); cam_front(scale, res, pitch=pitch, target=target)
    lm = None
    # plant in pot (the thing you protect)
    setup(4.2, (360, 480), 18, (0, 0, 1.45)); lm = leaf_mat(); stem = mat('stem', (0.2, 0.32, 0.1, 1), 0, 0.6); bud = bud_mat()
    fabric_pot(); pl = plant(lm, stem, bud, 2.2, seed=3); pl.location = (0, 0, 0.45)
    R('grow/plant.png')
    # pests
    setup(2.2, (256, 256), 30)
    aph = mat('aphid', (0.45, 0.8, 0.25, 1), 0, 0.25, coat=0.5); p = aph.node_tree.nodes['Principled BSDF']; p.inputs['Subsurface Weight'].default_value = 0.4
    b = sph(0.45, aph, sc=(1, 1.35, 0.8)); h = sph(0.22, aph, (0, -0.6, 0.05)); legs = mat('leg', (0.2, 0.35, 0.1, 1), 0, 0.4)
    for s in (-1, 1):
        for k in range(3): tube([(s * 0.3, -0.3 + k * 0.3, -0.1), (s * 0.6, -0.4 + k * 0.35, -0.05), (s * 0.75, -0.5 + k * 0.4, -0.35)], 0.025, legs)
        tube([(s * 0.08, -0.75, 0.15), (s * 0.3, -1.05, 0.35), (s * 0.45, -1.2, 0.3)], 0.015, legs)
        sph(0.05, mat('eye', (0.05, 0.02, 0.02, 1), 0, 0.1, coat=1), (s * 0.12, -0.78, 0.13))
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE'): o.rotation_euler.z += math.pi / 2  # face left (walks toward the plants)
    R('grow/aphid.png')
    clear(); mite = mat('mite', (0.75, 0.12, 0.06, 1), 0, 0.3, coat=0.5); node_noise_bump(mite, 60, 0.2)
    sph(0.45, mite, sc=(1.25, 1, 0.75)); sph(0.2, mite, (-0.55, 0, 0.0))
    for s in (-1, 1):
        for k in range(4): tube([(-0.2 + k * 0.18, s * 0.3, -0.05), (-0.35 + k * 0.3, s * 0.75, 0.1), (-0.45 + k * 0.4, s * 0.95, -0.35)], 0.02, mat('ml', (0.5, 0.1, 0.05, 1), 0, 0.4))
    for k in range(10): sph(0.06, mat('spot', (0.12, 0.02, 0.02, 1), 0, 0.3), (random.uniform(-0.3, 0.4), random.uniform(-0.3, 0.3), 0.3))
    R('grow/mite.png')
    clear(); gnat = mat('gnat', (0.04, 0.04, 0.05, 1), 0.2, 0.3, coat=0.6); wing = glass_mat('wing', (0.85, 0.9, 1, 1), 0.08, 1.1)
    sph(0.18, gnat, (0.35, 0, 0.05)); sph(0.3, gnat, (-0.15, 0, 0), sc=(1.8, 0.8, 0.8)); sph(0.07, mat('ge', (0.6, 0.05, 0.05, 1), 0, 0.1, coat=1), (0.48, 0.1, 0.12))
    for s in (-1, 1):
        w = sph(0.45, wing, (-0.1, s * 0.45, 0.25), sc=(1.4, 0.55, 0.04)); w.rotation_euler = (s * 0.35, 0, s * -0.4)
        for k in range(3): tube([(0.1 - k * 0.2, s * 0.1, -0.1), (0.1 - k * 0.25, s * 0.4, -0.25), (0.0 - k * 0.3, s * 0.55, -0.6)], 0.012, gnat)
    R('grow/gnat.png')
    clear(); cat = mat('cat', (0.35, 0.72, 0.18, 1), 0, 0.35, coat=0.3); node_color_noise(cat, (0.42, 0.78, 0.2, 1), (0.25, 0.55, 0.1, 1), 5)
    for k in range(8): sph(0.24 - abs(k - 2) * 0.01, cat, (0.75 - k * 0.24, 0, 0.12 * math.sin(k * 0.9)))
    sph(0.26, mat('cath', (0.3, 0.55, 0.15, 1), 0, 0.3, coat=0.5), (0.98, 0, 0.12))
    for s in (-1, 1): sph(0.05, mat('ce', (0.02, 0.02, 0.02, 1), 0, 0.1, coat=1), (1.15, s * 0.1, 0.22))
    for k in range(8): sph(0.035, mat('cspot', (0.95, 0.85, 0.2, 1), 0, 0.3), (0.75 - k * 0.24, 0.2, 0.2))
    R('grow/caterpillar.png')
    clear(); shell = mat('beetle', (0.05, 0.3, 0.22, 1), 0.85, 0.22, coat=1.0)
    sph(0.55, shell, (-0.1, 0, 0.05), sc=(1.25, 0.95, 0.65)); sph(0.25, mat('bh', (0.03, 0.05, 0.05, 1), 0.6, 0.3), (0.62, 0, 0))
    tube([(-0.65, 0, 0.42), (0.55, 0, 0.42)], 0.012, mat('seam', (0.01, 0.02, 0.02, 1), 0, 0.3))
    for s in (-1, 1):
        for k in range(3): tube([(0.2 - k * 0.3, s * 0.35, -0.05), (0.3 - k * 0.35, s * 0.75, 0.05), (0.2 - k * 0.45, s * 0.95, -0.35)], 0.03, mat('bl', (0.02, 0.03, 0.03, 1), 0.3, 0.4))
        tube([(0.75, s * 0.1, 0.05), (1.0, s * 0.3, 0.25), (1.15, s * 0.25, 0.2)], 0.02, mat('bl', (0.02, 0.03, 0.03, 1), 0.3, 0.4))
    R('grow/beetle.png')
    # gadgets
    clear(); body = mat('plastic', (0.85, 0.86, 0.88, 1), 0, 0.3, coat=0.4); red = mat('lady', (0.85, 0.06, 0.04, 1), 0, 0.15, coat=1); blk = mat('blk', (0.02, 0.02, 0.02, 1), 0.2, 0.3)
    cyl(0.5, 0.25, body, (0, 0, -0.45), v=48); cyl(0.12, 0.5, mat('met', (0.6, 0.62, 0.65, 1), 1, 0.25), (0, 0, -0.15), v=24)
    d = sph(0.48, red, (0, 0, 0.25), sc=(1.15, 1, 0.7)); sph(0.22, blk, (0.5, 0, 0.2))
    for (x, y) in [(0.1, 0.25), (-0.2, -0.2), (-0.25, 0.22), (0.15, -0.25), (-0.45, 0)]: sph(0.09, blk, (x, y, 0.52), sc=(1, 1, 0.4))
    tube([(-0.02, -0.48, 0.25), (-0.02, 0.48, 0.25)], 0.01, blk)
    cyl(0.08, 0.5, mat('barrel', (0.15, 0.15, 0.17, 1), 1, 0.2), (0.7, 0, 0.1), rot=(0, math.pi / 2, 0), v=24)
    R('grow/launcher.png')
    clear(); yel = mat('sticky', (1.0, 0.85, 0.05, 1), 0, 0.08, coat=1); node_noise_bump(yel, 120, 0.15)
    box(0.9, 0.06, 1.15, yel, (0, 0, 0.2), bev=0.02); cyl(0.04, 1.6, mat('stake', (0.25, 0.18, 0.1, 1), 0, 0.7), (0, 0.05, -0.2), v=12)
    for k in range(9): sph(0.04, mat('bug', (0.02, 0.02, 0.02, 1), 0, 0.4), (random.uniform(-0.35, 0.35), -0.04, random.uniform(-0.25, 0.65)))
    R('grow/trap.png')
    clear(); bottle = mat('bottle', (0.1, 0.55, 0.3, 1), 0, 0.15, coat=0.6); bottle.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 0.6
    b = cyl(0.32, 0.9, bottle, (0, 0, -0.1), v=48); mod_bevel(b, 0.1, 4); smooth(b); cyl(0.12, 0.25, body, (0, 0, 0.45), v=24)
    tr = box(0.45, 0.2, 0.22, mat('trig', (0.95, 0.95, 0.97, 1), 0, 0.35), (0.15, 0, 0.62), bev=0.05); cyl(0.04, 0.3, blk, (0.45, 0, 0.66), rot=(0, math.pi / 2, 0), v=12)
    R('grow/mister.png')
    clear(); cage = mat('cage', (0.75, 0.76, 0.8, 1), 1, 0.25); uv = emit_mat('uv', (0.45, 0.25, 1.0, 1), 25)
    cyl(0.12, 1.1, uv, (0, 0, 0.1), v=24); cyl(0.35, 0.1, cage, (0, 0, -0.5), v=32); cyl(0.35, 0.1, cage, (0, 0, 0.7), v=32)
    for k in range(10): a = k / 10 * math.tau; tube([(math.cos(a) * 0.32, math.sin(a) * 0.32, -0.45), (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.65)], 0.015, cage)
    pl = bpy.data.lights.new('uvl', 'POINT'); pl.energy = 60; pl.color = (0.5, 0.3, 1); o = link(bpy.data.objects.new('uvl', pl)); o.location = (0, -0.6, 0.1)
    R('grow/zapper.png')
    clear(); cell = mat('cell', (0.03, 0.06, 0.18, 1), 0.6, 0.15, coat=1); fr = mat('frame', (0.75, 0.76, 0.8, 1), 1, 0.3)
    p = box(1.3, 0.9, 0.06, cell, (0, 0, 0.25), bev=0.01, rot=(math.radians(35), 0, 0))
    for i in range(1, 4): box(0.012, 0.9, 0.07, fr, (-0.65 + i * 0.325, 0, 0.25), bev=0, rot=(math.radians(35), 0, 0))
    for i in range(1, 3): box(1.3, 0.012, 0.07, fr, (0, -0.45 + i * 0.3, 0.25 + 0), bev=0, rot=(math.radians(35), 0, 0))
    cyl(0.05, 0.8, fr, (0, 0.1, -0.3), v=12); cyl(0.35, 0.06, fr, (0, 0.1, -0.7), v=24)
    R('grow/solar.png')
    clear(); drop = mat('drop', (1, 0.85, 0.4, 1), 0, 0.05, emit=(1, 0.75, 0.25, 1), estr=4); drop.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 0.5
    d = sph(0.45, drop, sc=(1, 1, 1.2)); bm = d.data
    R('grow/drop.png')

@job
def sling():
    """Sling Smash: side view blocks (wood/glass/stone), steel ball, Glitch Bot, slingshot fork."""
    ensure('sling')
    def setup(scale, res): scene(front=(0, -1, 0.35), dist=7, key=560, rim=650); cam_front(scale, res, pitch=4)
    setup(1.2, (128, 128)); ball = mat('steel', (0.85, 0.86, 0.9, 1), 1.0, 0.12); sph(0.5, ball, seg=48); R('sling/ball.png')
    # blocks: 1x1 unit squares rendered 160px; the game stretches them (we render wide/tall variants)
    for kind in ('wood', 'glass', 'stone'):
        for (w, h, nm) in [(1, 1, 'sq'), (2, 0.5, 'h'), (0.5, 2, 'v')]:
            setup(max(w, h) * 1.08, (int(160 * max(w, h) / max(w, h) * (w / max(w, h)) * 1) * 2 // 2 or 80, int(160 * (h / max(w, h)))))
            bpy.context.scene.render.resolution_x = int(160 * w / max(w, h)) if w < h else 160 * int(max(1, w / h)) // int(max(1, w / h)); bpy.context.scene.render.resolution_y = int(160 * h / max(w, h))
            bpy.context.scene.camera.data.ortho_scale = max(w, h) * 1.04
            if kind == 'wood': m = wood_mat('w', (0.62, 0.38, 0.18, 1), (0.42, 0.24, 0.1, 1), 0.55, scale=1.2); node_noise_bump(m, 80, 0.15)
            elif kind == 'glass': m = glass_mat('g', (0.75, 0.93, 1, 1), 0.03, 1.5)
            else: m = mat('s', (0.45, 0.45, 0.47, 1), 0, 0.8); node_color_noise(m, (0.5, 0.5, 0.52, 1), (0.32, 0.32, 0.34, 1), 6); node_noise_bump(m, 18, 0.8)
            b = box(w, 0.8, h, m, bev=0.05 if kind != 'stone' else 0.08)
            if kind == 'stone': disp(b, 0.02, 0.3)
            R(f'sling/{kind}_{nm}.png'); clear()
    # Glitch Bot: little round robot with a screen face
    setup(1.5, (192, 192)); shell = mat('botshell', (0.92, 0.45, 0.08, 1), 0.2, 0.25, coat=0.8); scr = emit_mat('screen', (0.2, 1, 0.75, 1), 3)
    b = sph(0.55, shell, sc=(1, 0.9, 0.95)); face = box(0.62, 0.1, 0.38, mat('glassdark', (0.02, 0.03, 0.04, 1), 0, 0.05, coat=1), (0, -0.48, 0.05), bev=0.08)
    for s in (-1, 1): box(0.12, 0.02, 0.12, scr, (s * 0.15, -0.54, 0.09), bev=0.02)
    box(0.25, 0.02, 0.04, scr, (0, -0.54, -0.07), bev=0.01)
    cyl(0.025, 0.3, mat('ant', (0.7, 0.7, 0.75, 1), 1, 0.2), (0.15, 0, 0.65), v=8); sph(0.06, emit_mat('tip', (1, 0.2, 0.3, 1), 6), (0.15, 0, 0.82))
    for s in (-1, 1): cyl(0.08, 0.15, mat('jt', (0.2, 0.2, 0.22, 1), 1, 0.3), (s * 0.55, 0, 0), rot=(0, math.pi / 2, 0), v=16)
    R('sling/bot.png'); clear()
    # slingshot fork (wood Y), band drawn in-game
    setup(2.2, (176, 256)); bpy.context.scene.camera.data.ortho_scale = 2.6
    wm = wood_mat('fork', (0.5, 0.3, 0.14, 1), (0.3, 0.16, 0.07, 1), 0.5, coat=0.3, scale=2)
    tube([(0, 0, -1.2), (0, 0, -0.2)], 0.11, wm); tube([(0, 0, -0.25), (-0.25, 0, 0.3), (-0.4, 0, 0.95)], 0.09, wm); tube([(0, 0, -0.25), (0.25, 0, 0.3), (0.4, 0, 0.95)], 0.09, wm)
    lea = mat('wrap', (0.12, 0.07, 0.04, 1), 0, 0.7); node_noise_bump(lea, 90, 0.3)
    cyl(0.13, 0.35, lea, (0, 0, -0.6), v=24)
    R('sling/fork.png')

@job
def haze():
    """Haze Defense: top-down turrets and volumetric smoke orbs."""
    ensure('haze')
    def setup(): scene(front=(0, -0.4, 1), dist=6, key=480, rim=600); cam_top(2.2, (224, 224), tilt=18)
    def pad():
        base = mat('base', (0.05, 0.05, 0.06, 1), 0.4, 0.55); node_noise_bump(base, 70, 0.1); o = cyl(0.85, 0.2, base, (0, 0, -0.3), v=48); mod_bevel(o, 0.05, 3); smooth(o); torus(0.83, 0.025, emit_mat('ring', (0.2, 0.9, 1, 1), 2.5), (0, 0, -0.19))
    setup(); pad(); cop = mat('copper', (0.95, 0.5, 0.3, 1), 1, 0.25)
    cyl(0.35, 0.5, mat('dk', (0.15, 0.15, 0.17, 1), 1, 0.3), (0, 0, 0), v=32)
    for k in range(12): torus(0.4, 0.04, cop, (0, 0, -0.05 + k * 0.05))
    cyl(0.1, 0.9, mat('brl', (0.75, 0.77, 0.8, 1), 1, 0.15), (0, 0.45, 0.35), rot=(math.pi / 2, 0, 0), v=24); sph(0.12, emit_mat('cg', (0.3, 1, 1, 1), 6), (0, 0, 0.62))
    R('haze/dart.png'); clear()
    setup(); pad(); fr = mat('fanframe', (0.85, 0.86, 0.9, 1), 1, 0.2)
    torus(0.62, 0.05, fr, (0, 0, 0.2)); blades = mat('blade', (0.2, 0.75, 1.0, 1), 0, 0.2, coat=0.8); blades.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 0.5
    for k in range(5): b = sph(0.3, blades, (math.cos(k * 1.2566) * 0.3, math.sin(k * 1.2566) * 0.3, 0.2), sc=(1.6, 0.6, 0.08)); b.rotation_euler = (0.3, 0, k * 1.2566)
    for k in range(16): a = k / 16 * math.tau; tube([(0, 0, 0.32), (math.cos(a) * 0.62, math.sin(a) * 0.62, 0.22)], 0.012, fr)
    sph(0.12, fr, (0, 0, 0.3))
    R('haze/fan.png'); clear()
    setup(); pad(); cr = glass_mat('crystal', (0.85, 0.6, 1.0, 1), 0.0, 1.8); o = ico(0.45, cr, (0, 0, 0.25), 1); o.scale = (0.7, 0.7, 1.3); bpy.ops.object.shade_flat()
    cyl(0.4, 0.2, mat('ped', (0.8, 0.8, 0.85, 1), 1, 0.15), (0, 0, -0.1), v=6); pl = bpy.data.lights.new('pl', 'POINT'); pl.energy = 40; pl.color = (0.8, 0.4, 1); link(bpy.data.objects.new('pl', pl)).location = (0, 0, 0.3)
    R('haze/prism.png'); clear()
    setup(); pad(); fr = mat('fanframe', (0.85, 0.86, 0.9, 1), 1, 0.2); tank = mat('tank', (0.75, 0.9, 1.0, 1), 0, 0.05); tank.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 0.85
    cyl(0.4, 0.7, tank, (0, 0, 0.1), v=48); cyl(0.42, 0.08, fr, (0, 0, 0.45), v=48); cyl(0.42, 0.08, fr, (0, 0, -0.25), v=48)
    cyl(0.3, 0.55, emit_mat('cool', (0.4, 0.85, 1, 1), 1.5), (0, 0, 0.1), v=32)
    for k in range(4): a = k * math.pi / 2; cyl(0.05, 0.35, fr, (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.45), rot=(0, math.pi / 2, a), v=12)
    R('haze/frost.png'); clear()
    # volumetric smoke orbs (white, violet, green, gold, dark armored)
    for nm, col, dens in [('orb_white', (0.95, 0.95, 1.0), 6), ('orb_violet', (0.7, 0.45, 1.0), 7), ('orb_green', (0.45, 1.0, 0.55), 7), ('orb_gold', (1.0, 0.8, 0.35), 8), ('orb_dark', (0.35, 0.35, 0.42), 10)]:
        scene(front=(0, -0.4, 1), dist=6, key=420, rim=700, samples=96); cam_top(2.2, (192, 192), tilt=0)
        vm = bpy.data.materials.new('smoke'); vm.use_nodes = True; nt = vm.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
        pv = nt.nodes.new('ShaderNodeVolumePrincipled'); pv.inputs['Color'].default_value = (*col, 1); pv.inputs['Emission Color'].default_value = (*col, 1); pv.inputs['Emission Strength'].default_value = 0.35
        tc = nt.nodes.new('ShaderNodeTexCoord'); n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 3.2; n.inputs['Detail'].default_value = 10
        ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; nt.links.new(tc.outputs['Object'], ln.inputs[0]); nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
        fall = nt.nodes.new('ShaderNodeMapRange'); fall.inputs['From Min'].default_value = 0.55; fall.inputs['From Max'].default_value = 1.0; fall.inputs['To Min'].default_value = 1; fall.inputs['To Max'].default_value = 0; nt.links.new(ln.outputs['Value'], fall.inputs['Value'])
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; nt.links.new(n.outputs['Fac'], mul.inputs[0]); nt.links.new(fall.outputs['Result'], mul.inputs[1])
        pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 1.6; nt.links.new(mul.outputs[0], pw.inputs[0])
        dn = nt.nodes.new('ShaderNodeMath'); dn.operation = 'MULTIPLY'; dn.inputs[1].default_value = dens * 2; nt.links.new(pw.outputs[0], dn.inputs[0]); nt.links.new(dn.outputs[0], pv.inputs['Density'])
        nt.links.new(pv.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
        o = sph(1.0, vm, seg=24); o.scale = (0.95, 0.95, 0.95)
        R(f'haze/{nm}.png'); clear()

@job
def wheel():
    """Blazed Roulette: top-down rotor (pockets + numbers, rotates in-game), static wood bowl, chrome turret, ivory ball."""
    ensure('wheel')
    ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
    RED = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}; STEP = math.tau / 37
    scene('studio_small_09.hdr', 0.6, 0.5, key=520, rim=420, front=(0, -0.3, 1), dist=8, samples=96); cam_top(2.2, (1024, 1024), tilt=0)
    red = mat('red', (0.55, 0.02, 0.02, 1), 0, 0.25, coat=0.9); blk = mat('black', (0.015, 0.015, 0.018, 1), 0, 0.25, coat=0.9); grn = mat('green', (0.0, 0.32, 0.12, 1), 0, 0.25, coat=0.9)
    gold = mat('gold', (1.0, 0.72, 0.3, 1), 1.0, 0.18); chrome = mat('chrome', (0.93, 0.94, 0.96, 1), 1.0, 0.05); wood = wood_mat('rotorwood', (0.35, 0.15, 0.06, 1), (0.16, 0.06, 0.02, 1), 0.3, coat=1.0, scale=4)
    # pocket ring (numbers ring + pockets): one wedge per number, canvas angle i*STEP (clockwise) = Blender -i*STEP
    for i, n in enumerate(ORDER):
        a = -i * STEP; m = grn if n == 0 else red if n in RED else blk
        bm = bmesh.new(); ang = [a - STEP / 2 + k * STEP / 6 for k in range(7)]
        outer = [bm.verts.new((math.cos(t) * 1.0, math.sin(t) * 1.0, 0.0)) for t in ang]; inner = [bm.verts.new((math.cos(t) * 0.8, math.sin(t) * 0.8, 0.0)) for t in ang]
        for k in range(6): bm.faces.new((inner[k], outer[k], outer[k + 1], inner[k + 1]))
        me = bpy.data.meshes.new('w'); bm.to_mesh(me); bm.free(); o = link(bpy.data.objects.new('w', me)); o.data.materials.append(m)
        s = o.modifiers.new('so', 'SOLIDIFY'); s.thickness = 0.03
        # pocket (lower ring) + frets
        bm = bmesh.new(); outer = [bm.verts.new((math.cos(t) * 0.8, math.sin(t) * 0.8, -0.06)) for t in ang]; inner = [bm.verts.new((math.cos(t) * 0.66, math.sin(t) * 0.66, -0.04)) for t in ang]
        for k in range(6): bm.faces.new((inner[k], outer[k], outer[k + 1], inner[k + 1]))
        me = bpy.data.meshes.new('p'); bm.to_mesh(me); bm.free(); o = link(bpy.data.objects.new('p', me)); o.data.materials.append(m)
        fa = a - STEP / 2; box(0.15, 0.012, 0.07, chrome, (math.cos(fa) * 0.73, math.sin(fa) * 0.73, -0.02), bev=0.004, rot=(0, 0, fa))
        # number text
        bpy.ops.object.text_add(location=(math.cos(a) * 0.9, math.sin(a) * 0.9, 0.035)); t = bpy.context.object; t.data.body = str(n); t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'; t.data.size = 0.075
        t.data.extrude = 0.002; t.rotation_euler = (0, 0, a - math.pi / 2); t.data.materials.append(gold)
    torus(1.0, 0.012, gold, (0, 0, 0.02)); torus(0.8, 0.01, gold, (0, 0, 0.02))
    cone = cyl(0.66, 0.16, wood, (0, 0, 0.0), v=96, r2=0.25); smooth(cone)
    R('wheel/rotor.png'); clear()
    # turret (spins with the rotor, separate so it can glint)
    cam_top(0.9, (420, 420), tilt=0)
    cyl(0.3, 0.06, chrome, (0, 0, 0.0), v=64); cyl(0.12, 0.25, chrome, (0, 0, 0.12), v=48, r2=0.06); sph(0.07, chrome, (0, 0, 0.27))
    for k in range(4): a = k * math.pi / 2; tube([(0, 0, 0.18), (math.cos(a) * 0.25, math.sin(a) * 0.25, 0.14), (math.cos(a) * 0.36, math.sin(a) * 0.36, 0.16)], 0.018, chrome); sph(0.035, chrome, (math.cos(a) * 0.36, math.sin(a) * 0.36, 0.16))
    R('wheel/turret.png'); clear()
    # static bowl: wood rim + ball track (transparent hole in the middle where the rotor shows)
    cam_top(2.7, (1260, 1260), tilt=0)
    rim = wood_mat('rim', (0.42, 0.19, 0.07, 1), (0.2, 0.08, 0.03, 1), 0.28, coat=1.0, scale=3)
    o = torus(1.16, 0.14, rim, (0, 0, 0.05), seg=128, mseg=24); o.scale = (1, 1, 0.6)
    bm = bmesh.new(); N = 128
    ro = [bm.verts.new((math.cos(k / N * math.tau) * 1.13, math.sin(k / N * math.tau) * 1.13, 0.06)) for k in range(N)]; ri = [bm.verts.new((math.cos(k / N * math.tau) * 1.01, math.sin(k / N * math.tau) * 1.01, -0.01)) for k in range(N)]
    for k in range(N): bm.faces.new((ri[k], ro[k], ro[(k + 1) % N], ri[(k + 1) % N]))
    me = bpy.data.meshes.new('track'); bm.to_mesh(me); bm.free(); tr = link(bpy.data.objects.new('track', me)); trm = mat('track', (0.06, 0.035, 0.02, 1), 0.2, 0.15, coat=1); tr.data.materials.append(trm)
    for k in range(8): a = k / 8 * math.tau + 0.2; o = box(0.07, 0.03, 0.03, chrome, (math.cos(a) * 1.07, math.sin(a) * 1.07, 0.04), bev=0.01, rot=(0, 0, a + math.pi / 2))
    torus(1.3, 0.025, gold, (0, 0, 0.06), seg=128)
    R('wheel/bowl.png'); clear()
    cam_top(0.16, (64, 64)); sph(0.05, mat('ivory', (0.96, 0.94, 0.88, 1), 0, 0.12, coat=1.0), seg=48); R('wheel/ball.png')

@job
def growroom():
    """Blazed Roulette backdrop: a mylar grow tent with rows of plants under LED bars, haze, fans (portrait 1080x1920)."""
    ensure('room')
    sc = reset(); sc.cycles.samples = int(os.environ.get('ROOM_SAMPLES', '96')); sc.render.film_transparent = False
    world('studio_small_09.hdr', 0.05, 0)
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    cam = bpy.data.cameras.new('cam'); cam.lens = 18; cam.dof.use_dof = True; cam.dof.focus_distance = 5.5; cam.dof.aperture_fstop = 2.8
    co = link(bpy.data.objects.new('cam', cam)); co.location = (0, -6.5, 1.85); look(co, (0, 2, 1.15)); sc.camera = co
    mylar = mat('mylar', (0.9, 0.92, 0.95, 1), 1.0, 0.12); node_noise_bump(mylar, 3.5, 0.35, 4)
    floor = mat('floor', (0.06, 0.06, 0.07, 1), 0.0, 0.35, coat=0.6); node_noise_bump(floor, 30, 0.1)
    box(6, 16, 0.1, floor, (0, 2, -0.05), bev=0)
    for s in (-1, 1): box(0.05, 16, 4.2, mylar, (s * 3.0, 2, 2.1), bev=0)
    box(6, 0.05, 4.2, mylar, (0, 10, 2.1), bev=0); box(6, 16, 0.05, mat('ceil', (0.03, 0.03, 0.035, 1), 0.5, 0.4), (0, 2, 4.2), bev=0)
    # LED bars: warm full-spectrum white with a magenta-ish mix
    for k in range(6):
        y = -1 + k * 2.0
        for xx in (-1.6, -0.55, 0.55, 1.6):
            box(0.12, 1.6, 0.04, emit_mat('led%d' % k, (1.0, 0.72, 0.5, 1), 18), (xx, y, 3.55), bev=0)
        box(3.8, 0.06, 0.06, mat('bar', (0.15, 0.15, 0.17, 1), 1, 0.3), (0, y, 3.6), bev=0)
        l = bpy.data.lights.new('a%d' % k, 'AREA'); l.energy = 420; l.size = 3.2; l.color = (1, 0.78, 0.6); lo = link(bpy.data.objects.new('a%d' % k, l)); lo.location = (0, y, 3.5); lo.rotation_euler = (0, 0, 0)
    pk = bpy.data.lights.new('pk', 'AREA'); pk.energy = 300; pk.size = 4; pk.color = (1, 0.3, 0.75); pko = link(bpy.data.objects.new('pk', pk)); pko.location = (-2.5, 6, 3); look(pko, (0, 2, 0.5))
    cy = bpy.data.lights.new('cy', 'AREA'); cy.energy = 220; cy.size = 4; cy.color = (0.3, 0.8, 1); cyo = link(bpy.data.objects.new('cy', cy)); cyo.location = (2.5, -3, 2.5); look(cyo, (0, 2, 0.5))
    # rows of plants (instanced copies of a few unique plants)
    lm = leaf_mat(); stem = mat('stem', (0.2, 0.32, 0.1, 1), 0, 0.6); bud = bud_mat()
    protos = []
    for k in range(3):
        objs_before = set(bpy.data.objects); pot = fabric_pot(0.38, 0.42); p = plant(lm, stem, bud, 1.7 + 0.25 * k, seed=11 + k, nodes=9); p.location = (0, 0, 0.42)
        new = [o for o in bpy.data.objects if o not in objs_before]; col = bpy.data.collections.new('P%d' % k)
        for o in new:
            for c in o.users_collection: c.objects.unlink(o)
            col.objects.link(o)
        protos.append(col)
    for s in (-1, 1):
        for k in range(8):
            y = -2.6 + k * 1.55; inst = link(bpy.data.objects.new('i', None)); inst.instance_type = 'COLLECTION'; inst.instance_collection = protos[(k + (s > 0)) % 3]
            inst.location = (s * (1.9 + random.uniform(-0.15, 0.15)), y + random.uniform(-0.2, 0.2), 0); inst.rotation_euler = (0, 0, random.random() * math.tau); sc_ = random.uniform(0.92, 1.1); inst.scale = (sc_, sc_, sc_)
    # clip fans on the poles
    fm = mat('fan', (0.05, 0.05, 0.06, 1), 0.3, 0.35)
    for (x, y) in [(-2.6, 1.5), (2.6, 4.5)]:
        cyl(0.03, 3.4, mat('pole', (0.6, 0.6, 0.65, 1), 1, 0.3), (x, y, 1.7), v=12)
        f = torus(0.28, 0.025, fm, (x * 0.92, y, 2.6), rot=(0, math.pi / 2, 0)); cyl(0.08, 0.15, fm, (x * 0.92, y, 2.6), rot=(0, math.pi / 2, 0), v=16)
    # haze
    vm = bpy.data.materials.new('haze'); vm.use_nodes = True; nt = vm.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF']); pv = nt.nodes.new('ShaderNodeVolumePrincipled'); pv.inputs['Density'].default_value = 0.018; pv.inputs['Color'].default_value = (1, 0.92, 0.85, 1)
    nt.links.new(pv.outputs[0], nt.nodes['Material Output'].inputs['Volume']); hz = box(5.9, 15.8, 4.1, vm, (0, 2, 2.05), bev=0)
    sc.cycles.volume_step_rate = 4; sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Punchy'
    except Exception: pass
    R('room/growroom.png')
    # foreground parallax layer: two big near plants framing the left/right edges, transparent film, no haze
    keep = set(); before = set(bpy.data.objects)
    for (x, y, h, sd) in [(-1.45, -4.6, 1.5, 31), (1.5, -4.3, 1.7, 32)]:
        pp = plant(lm, stem, bud, h, seed=sd, nodes=9); pp.location = (x, y, -0.6); pp.rotation_euler = (0, 0, sd)
    keep = set(bpy.data.objects) - before
    for o in bpy.data.objects:
        if o.type == 'MESH' or o.type == 'CURVE' or o.type == 'EMPTY' or o.type == 'FONT':
            if o not in keep: o.hide_render = True
    hz.hide_render = True; sc.render.film_transparent = True
    R('room/growfg.png')

@job
def ships():
    """Void Swarm (space shooter): top-down player fighter, three alien drone types, a mothership boss, power-up capsules."""
    ensure('ships')
    def setup(scale, res=(256, 256)): scene('studio_small_09.hdr', 0.5, 1.0, key=520, rim=800, front=(0, -0.3, 1), dist=7); cam_top(scale, res, tilt=12)
    # player fighter: brushed titanium hull, blue glass canopy, swept wings, twin glowing nozzles (nose = +Y = screen up)
    setup(2.6); hull = mat('hull', (0.78, 0.8, 0.84, 1), 1.0, 0.22, coat=0.4); node_noise_bump(hull, 120, 0.05)
    trim = mat('trim', (0.05, 0.25, 0.9, 1), 0.6, 0.25, coat=0.8); can = glass_mat('canopy', (0.4, 0.75, 1, 1), 0.02, 1.5); hot = emit_mat('noz', (0.35, 0.75, 1, 1), 18)
    f = sph(0.32, hull, (0, 0.05, 0), sc=(0.55, 2.4, 0.42)); sph(0.16, can, (0, 0.35, 0.12), sc=(0.8, 1.8, 0.7))
    for sx in (-1, 1):
        bm = bmesh.new(); vs = [bm.verts.new(v) for v in [(sx * 0.12, 0.35, 0), (sx * 1.05, -0.55, -0.02), (sx * 1.0, -0.78, -0.02), (sx * 0.12, -0.55, 0)]]; fc = bm.faces.new(vs if sx > 0 else vs[::-1])
        ex = bmesh.ops.extrude_face_region(bm, geom=[fc]); bmesh.ops.translate(bm, vec=(0, 0, 0.06), verts=[e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)])
        me = bpy.data.meshes.new('wing'); bm.to_mesh(me); bm.free(); w = link(bpy.data.objects.new('wing', me)); w.data.materials.append(hull); mod_bevel(w, 0.015, 2)
        box(0.05, 0.5, 0.05, trim, (sx * 0.62, -0.3, 0.06), bev=0.01, rot=(0, 0, sx * -0.9))
        cyl(0.09, 0.4, hull, (sx * 0.22, -0.65, 0), rot=(math.pi / 2, 0, 0), v=24); cyl(0.065, 0.05, hot, (sx * 0.22, -0.86, 0), rot=(math.pi / 2, 0, 0), v=24)
        cyl(0.025, 0.35, mat('gun', (0.2, 0.2, 0.22, 1), 1, 0.3), (sx * 0.9, -0.45, 0.02), rot=(math.pi / 2, 0, 0), v=8)
    R('ships/player.png'); clear()
    # alien drones: organic-metal insect shells with glowing cores (facing down = -Y)
    for nm, col, glow, sc_ in [('drone_a', (0.95, 0.65, 0.05, 1), (1, 0.85, 0.2, 1), 1.0), ('drone_b', (0.55, 0.1, 0.85, 1), (1, 0.3, 0.9, 1), 1.0), ('drone_c', (0.85, 0.08, 0.06, 1), (1, 0.4, 0.1, 1), 1.15)]:
        setup(2.4 * sc_, (224, 224)); shell = mat('shell', col, 0.5, 0.25, coat=1.0); node_noise_bump(shell, 30, 0.15); core = emit_mat('core', glow, 10); dk = mat('dk', (0.03, 0.03, 0.04, 1), 0.8, 0.3)
        sph(0.4, shell, (0, 0, 0), sc=(1, 1.2, 0.55)); sph(0.22, dk, (0, -0.45, 0.02), sc=(1.2, 0.9, 0.7))
        for sx in (-1, 1):
            sph(0.08, core, (sx * 0.1, -0.55, 0.08))
            wg = glass_mat('wing', (glow[0], glow[1], glow[2], 1), 0.15, 1.3); wg.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 0.7
            w = sph(0.5, wg, (sx * 0.62, 0.1, 0.1), sc=(1.1, 0.55, 0.05)); w.rotation_euler = (0, 0, sx * 0.35)
            for k in range(3): tube([(sx * 0.3, -0.1 + k * 0.25, -0.05), (sx * 0.6, -0.2 + k * 0.25, -0.12), (sx * 0.72, -0.35 + k * 0.25, -0.1)], 0.025, dk)
        sph(0.12, core, (0, 0.1, 0.18), sc=(1, 1.4, 0.6))
        R(f'ships/{nm}.png'); clear()
    # mothership boss: wide armored saucer with a glowing reactor and turret pods
    setup(4.4, (384, 384)); arm = mat('armor', (0.09, 0.08, 0.1, 1), 1, 0.3, coat=0.5); node_noise_bump(arm, 25, 0.25); red = emit_mat('rc', (1, 0.12, 0.2, 1), 12); plate = mat('plate', (0.55, 0.08, 0.12, 1), 0.7, 0.3, coat=0.8)
    sph(0.8, arm, sc=(1.0, 1.25, 0.5)); sph(0.42, plate, (0, 0.15, 0.25), sc=(1, 1.3, 0.6)); sph(0.16, red, (0, -0.55, 0.15), sc=(1.4, 1, 0.6))
    for sx in (-1, 1):
        for k, (L, a) in enumerate([(1.5, 0.35), (1.3, 0.05), (1.0, -0.3)]):
            o = sph(0.5, arm, (sx * (0.55 + L * 0.45), 0.2 - k * 0.45, 0), sc=(L, 0.22, 0.12)); o.rotation_euler = (0, 0, sx * a)
            sph(0.06, red, (sx * (0.55 + L * 0.9), 0.2 - k * 0.45 + sx * a * 0.4 * sx, 0.05))
        cyl(0.12, 0.5, arm, (sx * 0.45, -0.75, 0), rot=(math.pi / 2, 0, 0), v=16); sph(0.07, red, (sx * 0.45, -1.0, 0))
    R('ships/boss.png'); clear()
    # power-up capsules: glass pill with a glowing symbol core
    for nm, col in [('pu_spread', (1, 0.55, 0.1, 1)), ('pu_rapid', (0.2, 1, 0.5, 1)), ('pu_shield', (0.3, 0.7, 1, 1)), ('pu_life', (1, 0.25, 0.45, 1))]:
        setup(1.4, (128, 128)); g = glass_mat('cap', (0.9, 0.95, 1, 1), 0.02, 1.45); o = sph(0.3, g, sc=(1.6, 1, 1)); o.rotation_euler = (0, 0, 0.5)
        sph(0.17, emit_mat('c', col, 8), sc=(1.4, 0.9, 0.9)).rotation_euler = (0, 0, 0.5); torus(0.3, 0.035, mat('band', (0.85, 0.86, 0.9, 1), 1, 0.15), rot=(0, math.pi / 2, 0.5))
        R(f'ships/{nm}.png'); clear()

@job
def brick():
    """Endless Brick Breaker: glass bricks (6 hues), steel brick + cracked steel, chrome paddle with neon strip, chrome ball."""
    ensure('brick')
    def setup(scale, res): scene('studio_small_09.hdr', 0.55, 0.8, key=520, rim=700, front=(0, -0.6, 1), dist=6); cam_top(scale, res, tilt=20)
    for nm, col in [('red', (1, 0.12, 0.2, 1)), ('orange', (1, 0.45, 0.05, 1)), ('yellow', (1, 0.85, 0.1, 1)), ('green', (0.2, 1, 0.35, 1)), ('cyan', (0.1, 0.8, 1, 1)), ('violet', (0.65, 0.25, 1, 1))]:
        setup(2.25, (192, 96)); dc = (col[0] * 0.55, col[1] * 0.55, col[2] * 0.55, 1); g = glass_mat('gb', dc, 0.08, 1.5)
        box(2.0, 0.8, 0.4, g, bev=0.08); box(1.75, 0.6, 0.06, mat('back', dc, 0.0, 0.35, emit=col, estr=0.9), (0, 0, -0.16), bev=0.02)
        R(f'brick/b_{nm}.png'); clear()
    for nm, cracked in [('steel', False), ('steel_cracked', True)]:
        setup(2.25, (192, 96)); st = mat('steel', (0.62, 0.64, 0.68, 1), 1, 0.3); node_noise_bump(st, 60, 0.12)
        b = box(2.0, 0.8, 0.4, st, bev=0.06)
        for sx in (-0.8, 0.8): sph(0.07, mat('rivet', (0.8, 0.8, 0.82, 1), 1, 0.2), (sx, 0, 0.2), sc=(1, 1, 0.5))
        if cracked:
            dk = emit_mat('crack', (1, 0.4, 0.1, 1), 4)
            for (a, b2) in [((-0.5, 0.3), (0.0, -0.05)), ((0.0, -0.05), (0.4, 0.3)), ((0.0, -0.05), (0.1, -0.35))]: tube([(a[0], a[1], 0.205), (b2[0], b2[1], 0.205)], 0.018, dk)
        R(f'brick/b_{nm}.png'); clear()
    setup(3.4, (320, 64)); ch = mat('chrome', (0.93, 0.94, 0.96, 1), 1, 0.06)
    o = cyl(0.2, 3.0, ch, rot=(0, math.pi / 2, 0), v=48); mod_bevel(o, 0.08, 4); box(2.6, 0.08, 0.06, emit_mat('ns', (0.2, 0.9, 1, 1), 10), (0, -0.17, 0.08), bev=0.02)
    for sx in (-1.45, 1.45): sph(0.21, emit_mat('cap', (1, 0.3, 0.8, 1), 6), (sx, 0, 0))
    R('brick/paddle.png'); clear()
    setup(0.6, (64, 64)); sph(0.25, mat('ballc', (0.95, 0.95, 0.97, 1), 1, 0.04), seg=48); R('brick/ball.png')

if __name__ == '__main__':
    for j in (JOBS_ARG or list(JOBS)):
        print('== job', j); JOBS[j]()
