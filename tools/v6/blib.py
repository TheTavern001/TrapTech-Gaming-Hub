# v6 shared Blender helpers (original code). Neon-night studio look used for every sprite in the hub.
import bpy, math, mathutils, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'v6')

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = os.environ.get('VT', 'Standard')
    if sc.view_settings.view_transform == 'AgX':
        try: sc.view_settings.look = 'AgX - Punchy'
        except Exception: pass
    sc.cycles.max_bounces = 6; sc.cycles.use_adaptive_sampling = True
    return sc

def world(hdr='studio_small_09.hdr', strength=0.35, rot=0.0):
    w = bpy.data.worlds.new('W'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes['Background']
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(SRC, hdr))
    mp = nt.nodes.new('ShaderNodeMapping'); tc = nt.nodes.new('ShaderNodeTexCoord')
    mp.inputs['Rotation'].default_value[2] = rot
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength

def area(name, loc, target, energy, color, size=2.0):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.color = color; d.size = size
    o = bpy.data.objects.new(name, d); bpy.context.scene.collection.objects.link(o); o.location = loc
    look(o, target); return o

def look(o, target):
    d = mathutils.Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def neon_rig(target=(0, 0, 0), dist=6.0, key=600, rim=900, front=(0, -1, 0)):
    """Warm key from the front-top-left, magenta rim back-left, cyan rim back-right (the hub's neon-night look)."""
    t = mathutils.Vector(target); f = mathutils.Vector(front).normalized(); up = mathutils.Vector((0, 0, 1)); side = f.cross(up)
    area('key', t + f * dist + up * dist * 0.7 - side * dist * 0.5, t, key, (1.0, 0.86, 0.72), 3)
    area('rimM', t - f * dist + up * dist * 0.3 - side * dist * 0.8, t, rim, (1.0, 0.25, 0.85), 2)
    area('rimC', t - f * dist + up * dist * 0.3 + side * dist * 0.8, t, rim, (0.2, 0.85, 1.0), 2)
    area('fill', t + f * dist - up * dist * 0.4 + side * dist, t, key * 0.25, (0.55, 0.6, 1.0), 4)

def ortho_cam(loc, target, scale, res=(256, 256)):
    c = bpy.data.cameras.new('cam'); c.type = 'ORTHO'; c.ortho_scale = scale
    o = bpy.data.objects.new('cam', c); bpy.context.scene.collection.objects.link(o); o.location = loc; look(o, target)
    sc = bpy.context.scene; sc.camera = o; sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    return o

def mat(name, base=(0.8, 0.8, 0.8, 1), metal=0.0, rough=0.4, emit=None, estr=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = base; p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if coat: p.inputs['Coat Weight'].default_value = coat
    if emit: p.inputs['Emission Color'].default_value = emit; p.inputs['Emission Strength'].default_value = estr
    return m

def render(path):
    sc = bpy.context.scene; sc.render.filepath = path; bpy.ops.render.render(write_still=True)

def imp(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
