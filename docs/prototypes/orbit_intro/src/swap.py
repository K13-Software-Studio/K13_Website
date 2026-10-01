import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='fig_mesh2.glb')
o=[x for x in bpy.context.scene.objects if x.type=='MESH'][0]
n=[n for n in o.active_material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image][0]
n.image=bpy.data.images.load('/private/tmp/claude-501/-Users-k13-Desktop-PROJECTS-K13-Website/e169f0d3-9cfc-4e9b-815f-89adaa908edc/scratchpad/intro/tex_fix.png')
bpy.ops.export_scene.gltf(filepath='fig_final.glb',export_format='GLB',export_image_format='JPEG')
