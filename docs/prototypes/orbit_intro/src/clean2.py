import bpy,bmesh,numpy as np
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='fig_clean.glb')
o=[x for x in bpy.context.scene.objects if x.type=='MESH'][0]
bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5);bm.faces.ensure_lookup_table()
seen=set();islands=[]
for f in bm.faces:
    if f.index in seen: continue
    st=[f];comp=[];seen.add(f.index)
    while st:
        g=st.pop();comp.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen: seen.add(h.index);st.append(h)
    islands.append(comp)
islands.sort(key=len,reverse=True);print('islands',[len(i) for i in islands[:6]],len(islands))
kill=[f for comp in islands if len(comp)<3000 for f in comp]
bmesh.ops.delete(bm,geom=kill,context='FACES');bm.to_mesh(o.data);bm.free()
img=[n.image for n in o.active_material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image][0]
img.save(filepath=bpy.path.abspath('//')+'tex_in.png') if False else None
img.filepath_raw='/private/tmp/claude-501/-Users-k13-Desktop-PROJECTS-K13-Website/e169f0d3-9cfc-4e9b-815f-89adaa908edc/scratchpad/intro/tex_in.png';img.file_format='PNG';img.save()
bpy.ops.export_scene.gltf(filepath='fig_mesh2.glb',export_format='GLB',export_image_format='JPEG')
