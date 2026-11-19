import bpy
import math
from mathutils import Vector
from math import sin, cos, pi

# ============================================================
# TURBOFAN ENGINE - reusable procedural Blender asset
# Blender 5.3 | Eevee | 24 fps | 12-second preview
# Axis: X (air enters from left, exhaust exits to right)
# ============================================================

OUT_DIR = r"C:\PROJETOS\meucanaldark\engine\blender\renders"
VIDEO_PATH = OUT_DIR + r"\turbofan-preview.mp4"
STILL_PATH = OUT_DIR + r"\turbofan-preview.png"

FPS = 24
DURATION_SECONDS = 12
FRAME_END = FPS * DURATION_SECONDS
RES_X, RES_Y = 1280, 720

# ---------- reset ----------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.curves, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
    pass

scene = bpy.context.scene
scene.render.engine = "CYCLES" if False else "BLENDER_EEVEE"
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAME_END
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.filepath = STILL_PATH
scene.world.color = (0.012, 0.018, 0.03)
scene.view_settings.view_transform = "AgX"

# Eevee quality settings
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_percentage = 100
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 32

# ---------- collections ----------
def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

COL_BODY = collection("01 | ENGINE STRUCTURE")
COL_COMP = collection("02 | COMPRESSOR")
COL_COMB = collection("03 | COMBUSTION")
COL_TURB = collection("04 | TURBINE")
COL_FLOW = collection("05 | AIRFLOW")
COL_STAGE = collection("06 | STUDIO")

def move_to(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    return obj

# ---------- materials ----------
def mat(name, color, metallic=0.0, rough=0.4, emission=None, emission_strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, alpha)
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = rough
    if emission:
        bs.inputs["Emission Color"].default_value = (*emission, 1)
        bs.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1:
        m.surface_render_method = "DITHERED"
        bs.inputs["Alpha"].default_value = alpha
    return m

titanium = mat("Titanium | brushed alloy", (0.22, 0.29, 0.36), 0.82, 0.27)
dark_metal = mat("Graphite | structural metal", (0.035, 0.055, 0.075), 0.72, 0.32)
steel = mat("Blade steel", (0.48, 0.58, 0.66), 0.88, 0.2)
gold = mat("Hot section | bronze alloy", (0.42, 0.19, 0.065), 0.78, 0.28)
blue = mat("Cold airflow | cyan", (0.015, 0.28, 0.65), 0.1, 0.25, (0.01, 0.42, 1.0), 3.0)
orange = mat("Combustion | amber", (0.8, 0.13, 0.015), 0.05, 0.3, (1.0, 0.12, 0.008), 5.0)
yellow = mat("Core gas | hot yellow", (1.0, 0.42, 0.025), 0.05, 0.25, (1.0, 0.25, 0.01), 4.0)
white = mat("Studio white", (0.75, 0.84, 0.95), 0.1, 0.25)
floor_mat = mat("Studio floor", (0.012, 0.02, 0.035), 0.25, 0.42)

# ---------- geometry helpers ----------
def cylinder_x(name, x, radius, depth, material, vertices=96, col=COL_BODY):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=(x, 0, 0), rotation=(0, pi/2, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    move_to(o, col)
    bevel = o.modifiers.new("Machined edge highlights", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 3
    o.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return o

def torus_x(name, x, major, minor, material, col=COL_BODY):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                    major_segments=96, minor_segments=12,
                                    location=(x, 0, 0), rotation=(0, pi/2, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    move_to(o, col)
    return o

def uv_sphere(name, loc, scale, material, col):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    o.data.materials.append(material)
    move_to(o, col)
    return o

def blade_mesh(name, x, angle, r_inner, r_outer, width, sweep, material, col, twist=0.22):
    # A swept, tapered airfoil-like blade. Local span runs radially outward from the X axis.
    verts = []
    faces = []
    radial = Vector((0, cos(angle), sin(angle)))
    tangent = Vector((0, -sin(angle), cos(angle)))
    for j, (r, w, sw) in enumerate([
        (r_inner, width*0.55, 0.0),
        (r_inner + (r_outer-r_inner)*0.48, width*0.82, sweep*0.45),
        (r_outer, width*0.32, sweep)
    ]):
        center = Vector((x + sw, 0, 0)) + radial*r
        # slight airfoil twist across span
        for side in (-1, 1):
            p = center + tangent*(side*w*0.5)
            p.x += side * twist * (j/2)
            verts.append(tuple(p))
    faces = [(0,1,3,2), (2,3,5,4), (0,2,4), (1,5,3), (0,4,5,1)]
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    bevel = obj.modifiers.new("Soft airfoil edges", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    obj.modifiers.new("Blade normals", "WEIGHTED_NORMAL")
    return obj

def add_rotor_stage(label, x, hub_r, tip_r, count, material, col, width, sweep, speed):
    hub = cylinder_x(label + " | rotor hub", x, hub_r, 0.34, dark_metal, col=col)
    ring = torus_x(label + " | hub collar", x-0.19, hub_r*1.05, 0.055, titanium, col)
    blades = []
    for i in range(count):
        a = 2*pi*i/count
        b = blade_mesh(label + f" | blade {i+1:02d}", x, a, hub_r, tip_r,
                       width, sweep, material, col, 0.16)
        blades.append(b)
    # Parent all stage elements to a rotating empty, preserving their assembled positions.
    pivot = bpy.data.objects.new(label + " | ROTATING ASSEMBLY", None)
    col.objects.link(pivot)
    pivot.location = (x, 0, 0)
    for obj in [hub, ring] + blades:
        world = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_world = world
    pivot.rotation_mode = "XYZ"
    pivot.rotation_euler[0] = 0
    pivot.keyframe_insert(data_path="rotation_euler", frame=1)
    pivot.rotation_euler[0] = speed * 2*pi * (FRAME_END-1) / FPS
    pivot.keyframe_insert(data_path="rotation_euler", frame=FRAME_END)
    # Blender 5.3: keyframes preservados; sem manipulacao da API antiga.
    return pivot

# ---------- main engine body ----------
# Outer casing is deliberately open on the camera-facing upper side: a technical cutaway.
for x, r, d in [(-3.65, 2.02, 0.22), (-2.55, 1.95, 0.16), (-0.95, 1.62, 0.18),
                (0.75, 1.48, 0.18), (2.55, 1.34, 0.2), (3.95, 1.28, 0.2)]:
    torus_x("Casing flange", x, r, 0.075, titanium)
# Nacelle partial lower shell - broad lower arc, leaving internals visible.
def shell_arc(name, x1, x2, radius, material, start_angle=pi*0.12, end_angle=pi*0.88):
    verts, faces = [], []
    steps = 72
    for x in (x1, x2):
        for i in range(steps+1):
            a = start_angle + (end_angle-start_angle)*i/steps
            verts.append((x, radius*cos(a), radius*sin(a)))
    for i in range(steps):
        faces.append((i, i+1, steps+2+i, steps+1+i))
    me = bpy.data.meshes.new(name+" mesh")
    me.from_pydata(verts, [], faces)
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    COL_BODY.objects.link(ob)
    solid = ob.modifiers.new("Casing thickness", "SOLIDIFY")
    solid.thickness = 0.12
    bevel = ob.modifiers.new("Casing edge bevel", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return ob

shell_arc("Lower nacelle cutaway shell", -3.8, 4.1, 2.02, dark_metal, pi+0.10, 2*pi-0.10)
# Inner structural spine and shaft
cylinder_x("Main drive shaft", 0.1, 0.22, 8.0, steel, col=COL_BODY)
for x in (-2.8, -1.0, 0.8, 2.5):
    torus_x("Shaft bearing", x, 0.32, 0.07, gold)

# Front fan and compressor stages
add_rotor_stage("FAN | 24 wide blades", -3.15, 0.42, 1.82, 24, steel, COL_COMP, 0.46, 0.16, 2.4)
add_rotor_stage("COMPRESSOR 1 | 20 blades", -2.05, 0.31, 1.55, 20, titanium, COL_COMP, 0.27, 0.12, 3.2)
add_rotor_stage("COMPRESSOR 2 | 18 blades", -1.35, 0.28, 1.42, 18, steel, COL_COMP, 0.23, 0.10, 3.6)
add_rotor_stage("COMPRESSOR 3 | 16 blades", -0.72, 0.27, 1.30, 16, titanium, COL_COMP, 0.20, 0.09, 4.0)

# Diffuser and combustion chamber
cylinder_x("Combustor outer case", 0.35, 1.22, 1.55, gold, col=COL_COMB)
torus_x("Combustor forward ring", -0.42, 1.18, 0.10, titanium, COL_COMB)
torus_x("Combustor rear ring", 1.12, 1.08, 0.10, titanium, COL_COMB)
# Inner flame tube and glowing annular core
cylinder_x("Combustion liner", 0.35, 0.88, 1.28, dark_metal, col=COL_COMB)
torus_x("Combustion flame front", 0.35, 0.72, 0.20, orange, COL_COMB)
# Fuel injectors around the combustor
for i in range(12):
    a = 2*pi*i/12
    r = 1.12
    loc = (0.05, r*cos(a), r*sin(a))
    uv_sphere("Fuel injector %02d" % (i+1), loc, (0.16, 0.09, 0.09), gold, COL_COMB)
# stylized flame tongues inside the core
for i in range(18):
    a = 2*pi*i/18
    r = 0.45
    loc = (0.45 + (i%3)*0.12, r*cos(a), r*sin(a))
    flame = uv_sphere("Combustion plume %02d" % (i+1), loc, (0.42, 0.12, 0.12), yellow if i%3 else orange, COL_COMB)
    flame.scale = (0.12, 0.045, 0.045)
    flame.keyframe_insert(data_path="scale", frame=1)
    flame.scale = (0.42, 0.12, 0.12)
    flame.keyframe_insert(data_path="scale", frame=12 + (i%6)*3)
    flame.scale = (0.18, 0.06, 0.06)
    flame.keyframe_insert(data_path="scale", frame=24 + (i%6)*3)
    flame.scale = (0.12, 0.045, 0.045)
    flame.keyframe_insert(data_path="scale", frame=36 + (i%6)*3)

# Turbine stages
add_rotor_stage("HIGH PRESSURE TURBINE | 14 blades", 1.72, 0.28, 1.03, 14, gold, COL_TURB, 0.24, 0.10, -4.2)
add_rotor_stage("LOW PRESSURE TURBINE | 16 blades", 2.55, 0.30, 1.14, 16, steel, COL_TURB, 0.25, 0.12, -3.4)
# Exhaust cone and nozzle
cylinder_x("Exhaust nozzle", 3.75, 1.10, 1.35, dark_metal)
torus_x("Exhaust nozzle lip", 4.42, 1.02, 0.09, titanium)
# Central exhaust cone (scaled cone along X)
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.72, radius2=0.12, depth=1.6,
                                location=(3.25, 0, 0), rotation=(0, pi/2, 0))
cone = bpy.context.object
cone.name = "Exhaust centerbody"
cone.data.materials.append(titanium)
move_to(cone, COL_TURB)

# ---------- airflow paths ----------
def curve_tube(name, points, radius, material, col=COL_FLOW):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 24
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points)-1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, cu)
    col.objects.link(ob)
    ob.data.materials.append(material)
    return ob

# Blue bypass airflow: two visible paths above and below the core
for side in (-1, 1):
    for offset in (0.0, 0.22):
        pts = [
            (-4.35, side*(1.55+offset), 0.12),
            (-2.9, side*(1.72+offset), 0.18),
            (-1.2, side*(1.48+offset), 0.12),
            (0.7, side*(1.35+offset), 0.05),
            (2.5, side*(1.24+offset), 0.0),
            (4.55, side*(1.18+offset), 0.0),
        ]
        curve_tube("Bypass airflow | cold", pts, 0.025, blue)
# Core flow inside the engine
curve_tube("Core airflow | compressed", [(-3.9,0,0),(-2.5,0,0),(-1.2,0,0),(-0.45,0,0)], 0.035, blue)
curve_tube("Hot gas path | combustion to turbine", [(-0.4,0,0),(0.3,0,0),(1.2,0,0),(2.0,0,0),(3.1,0,0),(4.6,0,0)], 0.055, yellow)

# Moving flow markers with animated position, in bypass and core
for j in range(14):
    y = (-1 if j%2 else 1) * (1.45 + (j%3)*0.12)
    z = (j%4-1.5)*0.12
    p = uv_sphere("Cold airflow tracer %02d" % j, (-4.0, y, z), (0.10,0.045,0.045), blue, COL_FLOW)
    p.location.x = -4.0
    p.keyframe_insert(data_path="location", frame=1)
    p.location.x = 4.6
    p.keyframe_insert(data_path="location", frame=FRAME_END)

# ---------- studio, camera and lighting ----------
# Ground
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-2.45))
floor = bpy.context.object
floor.name = "Infinite studio floor"
floor.data.materials.append(floor_mat)
move_to(floor, COL_STAGE)

def area_light(name, loc, power, color, size, target=(0,0,0)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.energy = power
    l.data.color = color
    l.data.shape = "DISK"
    l.data.size = size
    l.rotation_euler = (Vector(target)-l.location).to_track_quat("-Z","Y").to_euler()
    move_to(l, COL_STAGE)
    return l

area_light("Key | cool softbox", (0,-7,8), 1800, (0.55,0.72,1.0), 8)
area_light("Rim | warm industrial", (1,5,5), 2200, (1.0,0.42,0.16), 6)
area_light("Front fill", (-6,-2,2), 1100, (0.35,0.65,1.0), 5)
area_light("Rear edge", (5,2,1), 1500, (0.25,0.55,1.0), 4)

bpy.ops.object.camera_add(location=(7.8,-13.8,7.0))
camera = bpy.context.object
camera.name = "CAMERA | cinematic engine reveal"
camera.data.lens = 52
camera.rotation_euler = (Vector((0.0,0,0.0))-camera.location).to_track_quat("-Z","Y").to_euler()
scene.camera = camera
move_to(camera, COL_STAGE)

# Camera animation: start wider, push in, then move to a more frontal 3/4 angle.
camera.location = (8.2,-15.5,7.2)
camera.rotation_euler = (Vector((0,0,0))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.keyframe_insert(data_path="location", frame=1)
camera.keyframe_insert(data_path="rotation_euler", frame=1)
camera.location = (5.6,-11.8,5.3)
camera.rotation_euler = (Vector((0.1,0,0))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.keyframe_insert(data_path="location", frame=FRAME_END)
camera.keyframe_insert(data_path="rotation_euler", frame=FRAME_END)

# Camera depth of field off for technical clarity
camera.data.dof.use_dof = False

# ---------- render / output ----------
scene.frame_set(1)
scene.render.filepath = STILL_PATH
print("TURBOFAN_SCENE_READY")
print("Objects:", len(scene.objects))
print("Frames:", scene.frame_start, "-", scene.frame_end)
print("Still:", STILL_PATH)
bpy.ops.render.render(write_still=True)

# Render animation as PNG sequence; encode with Remotion FFmpeg externally.
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = r"C:\PROJETOS\meucanaldark\engine\blender\renders\turbofan-frame-"
scene.frame_set(1)

print("STARTING TURBOFAN PNG SEQUENCE")
bpy.ops.render.render(animation=True)
print("TURBOFAN_PNG_SEQUENCE_COMPLETE")




