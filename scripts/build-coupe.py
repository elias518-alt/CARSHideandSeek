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
body=hull('body',[(-2.2,.78,.42,.77,.83),(-1.92,.86,.38,.85,.91),(-.78,.88,.38,.91,.98),(.85,.87,.38,.92,.97),(1.92,.82,.42,.87,.91),(2.18,.77,.47,.8,.84)],paint)
# Cut real arches so wheels are separate geometry, rather than floating over the body.
for x in [-1.35,1.35]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.405,depth=3,location=(x,0,.38),rotation=(math.pi/2,0,0));cut=bpy.context.object
 bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Wheel opening','BOOLEAN');mod.object=cut;mod.operation='DIFFERENCE';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
# Coupe cabin, inset windows and roof.
hull('cabin',[(-.82,.79,.87,.91,.96),(-.22,.68,.9,1.35,1.42),(.65,.68,.9,1.36,1.43),(1.27,.78,.9,.95,1.0)],paint)
mesh('windshield',[(-.79,-.71,1.005),(-.79,.71,1.005),(-.23,.60,1.445),(-.23,-.60,1.445)],[(0,1,2,3)],glass)
mesh('rear_window',[(.69,-.6,1.445),(.69,.6,1.445),(1.22,.70,1.025),(1.22,-.70,1.025)],[(0,1,2,3)],glass)
for side in [-1,1]:
 mesh('side_window',[(-.69,side*.793,1.00),(-.18,side*.687,1.36),(.39,side*.687,1.36),(.48,side*.795,1.00)],[(0,1,2,3)],glass)
 mesh('quarter_window',[(.46,side*.687,1.36),(.64,side*.687,1.36),(1.13,side*.785,1.0),(.55,side*.795,1.0)],[(0,1,2,3)],glass)
 box('waist_trim',(0,side*.878,.75),(1.85,.025,.055),trim,.008)
 box('door_handle',(.48,side*.872,.87),(.16,.025,.035),trim,.008)
 box('mirror',(-.65,side*.96,1.01),(.23,.19,.115),paint,.04)
 # door shutline, vertical aft edge
 box('door_seam',(.66,side*.878,.63),(.008,.009,.40),trim,.002)
# Bumpers and actual swappable packages, stable node prefixes.
for variant in ['stock','clean','sport','track']:
 depth={'stock':.18,'clean':.20,'sport':.25,'track':.29}[variant]
 for x in [-2.08,2.08]:
  box('package_'+variant,(x,0,.48),( .23,1.62,depth),paint,.045)
  box('package_'+variant,(x+(-.121 if x<0 else .121),0,.49),(.016,1.45,.065),trim,.008)
 for side in [-1,1]:box('package_'+variant,(0,side*.855,.37),(1.88,.10,depth*.45),paint if variant=='clean' else trim,.015)
 if variant in ['sport','track']:
  box('package_'+variant,(-2.13,0,.335),(.36,1.74,.045),trim,.012)
  box('package_'+variant,(-2.205,0,.43),(.025,.72,.09),rubber,.012)
 if variant=='track':
  for sy in [-.55,.55]:box('package_track',(1.85,sy,1.03),(.10,.055,.25),trim,.01)
  box('package_track',(1.87,0,1.16),(.30,1.62,.055),paint,.02)
# Front face, lights, grille, rear lamps and plate.
box('front_grille',(-2.207,0,.69),(.025,.62,.17),trim,.012)
for sy in [-.24,-.16,-.08,0,.08,.16,.24]:box('grille_slats',(-2.225,sy,.69),(.015,.012,.14),chrome,.002)
for side in [-1,1]:
 box('headlamp',(-2.20,side*.55,.73),(.045,.40,.155),white,.025)
 box('indicator',(-2.21,side*.77,.72),(.045,.07,.14),amber,.015)
 box('taillamp',(2.17,side*.52,.74),(.055,.42,.15),red,.025)
box('rear_plate',(2.19,0,.68),(.025,.33,.10),trim,.008)
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
out=os.path.abspath('assets/vehicles/3d');os.makedirs(out,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=out+'/chs-coupe-96.blend')
bpy.ops.export_scene.gltf(filepath=out+'/chs-coupe-96.glb',export_format='GLB',export_apply=True)
