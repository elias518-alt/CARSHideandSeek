"""Original CHS Coupe 96. Blender source generator, metres, front -X, Z up.
Run: blender -b --python scripts/build-coupe.py
No downloaded vehicle geometry or brand marks.
"""
import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 return m
paint=mat('paint',(.22,.07,.12),.65,.24); rubber=mat('rubber',(.018,.022,.027),0,.85); trim=mat('trim',(.028,.035,.045),.25,.38); glass=mat('glass',(.045,.085,.115),.5,.14); chrome=mat('silver',(.63,.68,.73),.85,.23); dark=mat('graphite',(.12,.15,.19),.8,.3); red=mat('tail',(.5,.025,.02),.3,.22); white=mat('lamp',(.75,.82,.85),.2,.2); amber=mat('indicator',(.95,.35,.025),.2,.3)
def finish(o,name,m,bevel=0):
 o.name=name; o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Edge radii','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 mod=o.modifiers.new('Surface normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 return o
def box(name,loc,scale,m,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,bevel)
def mesh(name,verts,faces,m,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,m,bevel)
def hull(name,sections,m):
 # section x, half-width, lower height, shoulder height, crown height
 vs=[]
 for x,w,b,s,t in sections:vs.extend([(x,-w,b),(x,w,b),(x,w,s),(x,w*.9,t),(x,-w*.9,t),(x,-w,s)])
 faces=[tuple(reversed(range(6))),tuple(range(len(vs)-6,len(vs)))]
 for i in range(len(sections)-1):
  for j in range(6):faces.append((i*6+j,i*6+(j+1)%6,(i+1)*6+(j+1)%6,(i+1)*6+j))
 return mesh(name,vs,faces,m,.025)
# Sculpted cross-sections: crowned bonnet, shoulder crease, curved flanks and tucked sill.
sections=[(-2.24,.745,.42,.73,.79),(-2.14,.80,.35,.78,.815),(-1.94,.848,.32,.835,.86),(-1.56,.862,.31,.875,.90),(-1.12,.856,.31,.89,.94),(-.67,.842,.31,.905,.965),(-.30,.836,.31,.91,.96),(.38,.836,.31,.91,.96),(.95,.85,.31,.91,.965),(1.40,.86,.33,.90,.955),(1.88,.828,.37,.87,.915),(2.12,.80,.40,.82,.865),(2.21,.755,.44,.78,.82)]
verts=[]
for x,w,b,z,t in sections:
 # Clockwise cross section with multiple top samples, avoiding a flat slab bonnet.
 ring=[(-w*.93,b),(w*.93,b),(w,b+.12),(w,z-.08),(w*.99,z),(w*.87,t-.018),(w*.50,t+.006),(0,t+.016),(-w*.50,t+.006),(-w*.87,t-.018),(-w*.99,z),(-w,z-.08),(-w,b+.12)]
 verts.extend((x,y,h) for y,h in ring)
n=13;faces=[tuple(reversed(range(n))),tuple(range(len(verts)-n,len(verts)))]
for i in range(len(sections)-1):
 for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
body=mesh('body',verts,faces,paint,.012)
# Cut real arches so wheels are separate geometry, rather than floating over the body.
for x in [-1.35,1.35]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.405,depth=3,location=(x,0,.38),rotation=(math.pi/2,0,0));cut=bpy.context.object
 bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Wheel opening','BOOLEAN');mod.object=cut;mod.operation='DIFFERENCE';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
# Low coupe greenhouse with curved glazing, narrow pillars and a rounded roof.
def patch(name,front,back,m,crown=0):
 vs=[];steps=12
 for u in range(steps+1):
  q=u/steps;x=front[0]*(1-q)+back[0]*q;w=front[1]*(1-q)+back[1]*q;z=front[2]*(1-q)+back[2]*q
  for v in range(steps+1):
   r=-1+2*v/steps;vs.append((x,w*r,z+crown*(1-r*r)))
 fs=[]
 for i in range(steps):
  for j in range(steps):k=i*(steps+1)+j;fs.append((k,k+1,k+steps+2,k+steps+1))
 return mesh(name,vs,fs,m)
patch('windshield',(-.70,.735,.975),(-.12,.627,1.335),glass,.018)
patch('roof',(-.14,.66,1.343),(.77,.66,1.355),paint,.034)
patch('rear_window',(.79,.622,1.34),(1.40,.728,.977),glass,.012)
# Pillars are surfaces bordering the windows rather than a solid painted cabin behind them.
for side in [-1,1]:
 def panel(name,points,m):return mesh(name,[(x,side*y,z) for x,y,z in points],[(0,1,2,3)],m)
 panel('A_pillar',[(-.75,.775,.962),(-.17,.664,1.35),(-.10,.626,1.338),(-.68,.738,.976)],paint)
 panel('C_pillar',[(.76,.659,1.355),(1.46,.778,.957),(1.31,.80,.96),(.70,.665,1.32)],paint)
 panel('side_window',[(-.66,.782,.972),(-.10,.662,1.32),(.49,.662,1.33),(.57,.827,.964)],glass)
 panel('quarter_window',[(.55,.663,1.33),(.71,.663,1.33),(1.25,.786,.975),(.64,.827,.964)],glass)
 panel('B_pillar',[(.49,.664,1.333),(.55,.664,1.333),(.64,.829,.96),(.57,.829,.96)],trim)
 # Beltline and door shutlines run with the shoulder, with no oversized floating strips.
 box('waist_trim',(0,side*.844,.705),(1.87,.018,.035),trim,.006)
 box('door_handle',(.40,side*.846,.855),(.145,.022,.027),trim,.006)
 mirror=box('mirror',(-.61,side*.92,.99),(.22,.15,.095),paint,.035);mirror.rotation_euler[2]=side*.12
 box('door_seam',(.65,side*.845,.68),(.005,.006,.40),trim,.001)
 # Bonnet shutline.
 panel('bonnet_seam',[(-2.06,.64,.833),(-.70,.72,.97),(-.70,.725,.97),(-2.06,.645,.833)],trim)
# Bumpers and actual swappable packages, stable node prefixes.
for variant in ['stock','clean','sport','track']:
 depth={'stock':.18,'clean':.20,'sport':.25,'track':.29}[variant]
 for x in [-2.19,2.10]:
  box('package_'+variant,(x,0,.48),( .23,1.62,depth),paint,.045)
  box('package_'+variant,(x+(-.121 if x<0 else .121),0,.49),(.016,1.45,.065),trim,.008)
 for side in [-1,1]:box('package_'+variant,(0,side*.855,.37),(1.88,.10,depth*.45),paint if variant=='clean' else trim,.015)
 if variant in ['sport','track']:
  box('package_'+variant,(-2.23,0,.335),(.36,1.74,.045),trim,.012)
  box('package_'+variant,(-2.315,0,.43),(.025,.72,.09),rubber,.012)
 if variant=='track':
  for sy in [-.55,.55]:box('package_track',(1.85,sy,1.03),(.10,.055,.25),trim,.01)
  box('package_track',(1.87,0,1.16),(.30,1.62,.055),paint,.02)
# Bumper optics and recesses are attached to the actual front face.
box('lower_intake',(-2.32,0,.435),(.018,.66,.105),trim,.012)
box('front_plate',(-2.325,0,.555),(.018,.34,.078),trim,.006)
for side in [-1,1]:
 box('fog_recess',(-2.32,side*.61,.445),(.018,.20,.10),trim,.012)
 box('fog_lens',(-2.335,side*.61,.447),(.014,.12,.056),white,.008)
# Recessed paired grille, twin optics behind dark headlamp surrounds and slim indicators.
box('front_surround',(-2.24,0,.705),(.028,1.46,.16),paint,.025)
for side in [-1,1]:
 box('grille_rim',(-2.262,side*.145,.705),(.025,.235,.145),chrome,.025)
 box('grille_recess',(-2.279,side*.145,.705),(.017,.205,.123),trim,.020)
 for offset in [-.065,-.032,0,.032,.065]:box('grille_slats',(-2.291,side*.145+offset,.705),(.008,.009,.105),dark,.002)
 box('headlamp_surround',(-2.252,side*.51,.715),(.032,.40,.145),trim,.018)
 for yy in [side*.425,side*.585]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=(-2.28,yy,.72));o=bpy.context.object;o.scale=(.017,.063,.058);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'headlamp_optic',white)
 box('indicator',(-2.256,side*.748,.715),(.035,.07,.135),amber,.012)
 box('taillamp',(2.208,side*.51,.748),(.035,.43,.13),red,.018)
 box('reverse_lamp',(2.23,side*.43,.73),(.015,.15,.035),white,.005)
box('rear_plate',(2.23,0,.66),(.015,.33,.10),trim,.008)
# Road wheels; cylinders along Y. Every style shares the same hub and diameter.
def cyl(name,loc,r,depth,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,m,.003)
for x in [-1.35,1.35]:
 for side in [-1,1]:
  y=side*.79;z=.36
  bpy.ops.mesh.primitive_torus_add(major_radius=.278,minor_radius=.082,major_segments=48,minor_segments=12,location=(x,y,z),rotation=(math.pi/2,0,0));finish(bpy.context.object,'tyre',rubber)
  cyl('brake',(x,side*.825,z),.21,.025,dark)
  for style in ['stock','silver','graphite','mesh']:
   metal=dark if style=='graphite' else chrome;n={'stock':6,'silver':5,'graphite':5,'mesh':12}[style]
   prefix='rims_'+style;oy=side*.879
   bpy.ops.mesh.primitive_torus_add(major_radius=.247,minor_radius=.012,major_segments=48,minor_segments=8,location=(x,oy,z),rotation=(math.pi/2,0,0));finish(bpy.context.object,prefix,metal)
   cyl(prefix,(x,oy,z),.057,.03,metal)
   for j in range(n):
    angle=j*2*math.pi/n
    for delta in ([-.065,.065] if style in ['silver','graphite'] else [0]):
     a=angle+delta;ob=box(prefix,(x+math.sin(a)*.15,oy,z+math.cos(a)*.15),(.018 if n==12 else .027,.026,.19),metal,.006);ob.rotation_euler[1]=a
# Join objects by named variant or material; GLB keeps replacement groups compact.
for prefix in ['rims_stock','rims_silver','rims_graphite','rims_mesh','package_stock','package_clean','package_sport','package_track']:
 objs=[o for o in bpy.context.scene.objects if o.name.startswith(prefix)]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=prefix
# Batch fixed coachwork into shared-material primitives for mobile draw-call cost.
static=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith(('rims_','package_'))]
bpy.ops.object.select_all(action='DESELECT')
for o in static:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='coachwork'
out=os.path.abspath('assets/vehicles/3d');os.makedirs(out,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=out+'/chs-coupe-96.blend')
bpy.ops.export_scene.gltf(filepath=out+'/chs-coupe-96.glb',export_format='GLB',export_apply=True)
