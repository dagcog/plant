"""Build the editable material samples and export the game's models and thumbnails."""
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

SOURCE = Path(__file__).resolve().parent
OUTPUT = SOURCE.parents[1] / "frontend" / "assets" / "potting"
OUTPUT.mkdir(parents=True, exist_ok=True)

# count, typical radius, thickness, subdivisions, roughness, palette (sRGB)
SAMPLES = {
    "coir": (46, .009, .26, 1, .93, ("9a6847", "735039", "ae7b51", "5b3a28")),
    "compost": (43, .010, .64, 1, .94, ("514039", "3b2a23", "6e5040", "855f48")),
    "perlite": (39, .009, .72, 1, .89, ("e8e5d8", "f6f3e8", "bdbeb0", "dbd7c8")),
    "pumice": (32, .011, .63, 1, .91, ("b7ac95", "939486", "d6c9ae", "aaa18e")),
    "river_stone": (15, .018, .55, 2, .35, ("635b64", "8f7062", "b1a087", "777c73")),
    "gold_grit": (26, .013, .68, 1, .73, ("bb8a49", "e8c082", "caa665", "9a6b43")),
    "clay_pebbles": (20, .015, .87, 2, .78, ("b7724f", "985638", "c58560", "84503c")),
}


def linear(channel):
    return channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4


def color(hex_code):
    return tuple(linear(int(hex_code[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1,)


def sample(key, config, seed):
    count, radius, thickness, subdivisions, roughness, palette = config
    rng = random.Random(seed)
    vertices, faces, colors = [], [], []
    for index in range(count):
        angle = index * 2.399963 + rng.uniform(-.16, .16)
        distance = .089 * math.sqrt((index + .3) / count)
        size = radius * rng.uniform(.75, 1.31)
        stretch = rng.uniform(.72, 1.35)
        if key == "coir":
            stretch *= 1.55
        spin = rng.uniform(0, math.tau)
        bump = 1 - distance / .105
        blob = bmesh.new()
        bmesh.ops.create_icosphere(blob, subdivisions=subdivisions, radius=1)
        blob.verts.index_update()
        start = len(vertices)
        for vertex in blob.verts:
            x, y, z = vertex.co
            uneven = rng.uniform(.91, 1.09) if subdivisions == 2 else rng.uniform(.74, 1.24)
            if key == "river_stone":
                # Layered bands across polished pebbles.
                stripe = math.sin((x * .55 + z + index * .25) * 10)
                shade = .77 if stripe > .62 else 1.10
            else:
                shade = rng.uniform(.67, 1.13)
            x, y = x * size * stretch * uneven, y * size * uneven
            height = size * thickness * uneven
            vertices.append((
                distance * math.cos(angle) + x * math.cos(spin) - y * math.sin(spin),
                distance * math.sin(angle) + x * math.sin(spin) + y * math.cos(spin),
                max(0, (z + 1) * height + bump * .016),
            ))
            base = color(palette[index % len(palette)])
            colors.append(tuple(min(1, value * shade) for value in base[:3]) + (1,))
        faces.extend(tuple(start + vertex.index for vertex in face.verts) for face in blob.faces)
        blob.free()

    mesh = bpy.data.meshes.new(key)
    mesh.from_pydata(vertices, [], faces)
    tint = mesh.color_attributes.new(name="Tint", type="BYTE_COLOR", domain="POINT")
    for entry, rgba in zip(tint.data, colors):
        entry.color = rgba
    mesh.color_attributes.active_color = tint
    for face in mesh.polygons:
        face.use_smooth = subdivisions == 2
    mesh.update()
    obj = bpy.data.objects.new(key, mesh)
    bpy.context.collection.objects.link(obj)
    surface = bpy.data.materials.new(key)
    surface.use_nodes = True
    shader = surface.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    attribute = surface.node_tree.nodes.new("ShaderNodeVertexColor")
    attribute.layer_name = tint.name
    surface.node_tree.links.new(attribute.outputs["Color"], shader.inputs["Base Color"])
    mesh.materials.append(surface)
    return obj


def aim(obj, position, target):
    obj.location = position
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 18
scene.render.resolution_x = scene.render.resolution_y = 192
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.world = bpy.data.worlds.new("Studio ambient")
scene.world.color = (.26, .26, .26)
camera_data = bpy.data.cameras.new("Sample camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = .245
scene.camera = bpy.data.objects.new("Sample camera", camera_data)
scene.collection.objects.link(scene.camera)
lights = []
for name, position, power, size in (
    ("Key", (-.35, -.38, .6), 22, .38),
    ("Fill", (.36, -.12, .34), 9, .46),
    ("Rim", (.03, .5, .43), 14, .32),
):
    light = bpy.data.lights.new(name, "AREA")
    light.energy, light.shape, light.size = power, "DISK", size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    lights.append((obj, Vector(position)))

for index, (key, config) in enumerate(SAMPLES.items()):
    specimen = sample(key, config, 73 + index)
    bpy.ops.object.select_all(action="DESELECT")
    specimen.select_set(True)
    bpy.context.view_layer.objects.active = specimen
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f"{key}.glb"), export_format="GLB",
                              use_selection=True, export_yup=True, export_texcoords=False)
    center = Vector(((index % 4) * .32, (index // 4) * .32, 0))
    specimen.location = center
    aim(scene.camera, center + Vector((.31, -.43, .48)), center)
    for light, offset in lights:
        aim(light, center + offset, center)
    scene.render.filepath = str(OUTPUT / f"{key}.png")
    bpy.ops.render.render(write_still=True)

aim(scene.camera, (.47, -.68, 1.46), (.47, .14, 0))
camera_data.ortho_scale = 1.4
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "potting-materials.blend"), compress=True)
