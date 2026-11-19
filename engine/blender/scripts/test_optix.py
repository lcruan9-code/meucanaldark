import bpy

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# Cena simples para testar o render pela GPU
bpy.ops.mesh.primitive_monkey_add(location=(0, 0, 0))
obj = bpy.context.object

mat = bpy.data.materials.new("Test Material")
mat.diffuse_color = (0.05, 0.45, 0.8, 1)
obj.data.materials.append(mat)

bpy.ops.object.camera_add(location=(4, -6, 3))
camera = bpy.context.object
camera.rotation_euler = (1.15, 0, 0.58)
bpy.context.scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(1, -4, 5))
light = bpy.context.object
light.data.energy = 900
light.data.shape = "DISK"
light.data.size = 5

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.get_devices()
prefs.compute_device_type = "OPTIX"

for device in prefs.devices:
    device.use = device.type == "OPTIX"

scene.cycles.device = "GPU"
scene.render.resolution_x = 640
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = r"C:\PROJETOS\meucanaldark\engine\blender\renders\optix-test.png"

print("INICIANDO RENDER OPTIX")
bpy.ops.render.render(write_still=True)
print("OPTIX_RENDER_CONCLUIDO")

