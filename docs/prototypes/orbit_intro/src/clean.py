import bpy,bmesh,numpy as np
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='fig_trellis.glb')
o=[x for x in bpy.context.scene.objects if x.type=='MESH'][0]
me=o.data
img=None
for n in o.active_material.node_tree.nodes:
    if n.type=='TEX_IMAGE' and n.image: img=n.image;break
W,H=img.size;px=np.array(img.pixels[:]).reshape(H,W,4)
bm=bmesh.new();bm.from_mesh(me);uv=bm.loops.layers.uv.active
zs=[ (o.matrix_world@v.co).z for v in bm.verts];z0=min(zs);h=max(zs)-z0
kill=[]
for f in bm.faces:
    zc=sum((o.matrix_world@v.co).z for v in f.verts)/len(f.verts)
    if zc>z0+0.09*h: continue
    u=sum(l[uv].uv.x for l in f.loops)/3;v=sum(l[uv].uv.y for l in f.loops)/3
    c=px[min(H-1,int(v*H))%H,min(W-1,int(u*W))%W,:3];lum=0.3*c[0]+0.59*c[1]+0.11*c[2]
    if lum<0.12: kill.append(f)
print('kill',len(kill),'of',len(bm.faces))
bmesh.ops.delete(bm,geom=kill,context='FACES')
# drop tiny islands left behind
bm.to_mesh(me);bm.free()
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.mesh.select_loose();bpy.ops.mesh.delete(type='VERT');bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.export_scene.gltf(filepath='fig_clean.glb',export_format='GLB',export_image_format='JPEG')
