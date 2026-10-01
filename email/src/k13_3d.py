import bpy, math, sys, os
D=os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else os.getcwd()
D='/private/tmp/claude-501/-Users-k13-Desktop-PROJECTS-K13-Website/e169f0d3-9cfc-4e9b-815f-89adaa908edc/scratchpad/sig'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
YAW=float(args[0]) if args else -16; OUT=args[1] if len(args)>1 else 'k13_3d.png'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
try: sc.render.engine='CYCLES'
except TypeError: pass
sc.cycles.samples=160; sc.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices: d.use=True
    sc.cycles.device='GPU'
except Exception as e: print('gpu',e)
sc.render.film_transparent=True; sc.render.resolution_x=1800; sc.render.resolution_y=900
sc.view_settings.view_transform='Standard'
def srgb(h):
    h=h.lstrip('#');c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [(x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4) for x in c]+[1]
def mat(name,hexc,rough,coat):
    m=bpy.data.materials.new(name);m.use_nodes=True
    b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value=srgb(hexc);b.inputs['Roughness'].default_value=rough
    for k in ('Coat Weight','Clearcoat'):
        if k in b.inputs: b.inputs[k].default_value=coat
    return m
fnt=bpy.data.fonts.load(D+'/Fraunces-600.ttf')
cu=bpy.data.curves.new('k13','FONT');cu.body='K13';cu.font=fnt;cu.size=1;cu.align_x='CENTER';cu.align_y='CENTER'
cu.extrude=0.06;cu.bevel_depth=0.007;cu.space_character=1.07;cu.bevel_resolution=4;cu.resolution_u=24
ob=bpy.data.objects.new('k13',cu);sc.collection.objects.link(ob)
ob.data.materials.append(mat('ink','#141D35',0.42,0.25));ob.data.materials.append(mat('orange','#B94612',0.4,0.2))
for i in (1,2): cu.body_format[i].material_index=1
ob.rotation_euler=(math.radians(90),0,math.radians(YAW))
# camera
cam=bpy.data.cameras.new('cam');cam.lens=85;co=bpy.data.objects.new('cam',cam);sc.collection.objects.link(co);sc.camera=co
co.location=(0,-9.0,0.9);co.rotation_euler=(math.radians(84.5),0,0)
# lights: warm key upper left, cool fill, a rim from behind that outlines the ink K on dark grounds
def area(name,loc,rot,energy,size,color):
    l=bpy.data.lights.new(name,'AREA');l.energy=energy;l.size=size;l.color=color
    o=bpy.data.objects.new(name,l);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=[math.radians(r) for r in rot];return o
area('key',(-3,-4,3),(55,0,-35),420,3,(1,.96,.9))
area('fill',(4,-3,0.5),(80,0,40),120,4,(.85,.9,1))
area('rim',(1.5,4,2.5),(-60,0,160),1700,2.0,(1,.9,.8));area('rim2',(-2.5,3,1.5),(-70,0,-150),900,2.0,(.85,.9,1))
area('top',(0,0,5),(0,0,0),110,5,(1,1,1))
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True
bg=next(n for n in w.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.75,.78,.85,1);bg.inputs['Strength'].default_value=.18
sc.render.filepath=D+'/'+OUT;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA'
bpy.ops.render.render(write_still=True);print('RENDERED',OUT)
