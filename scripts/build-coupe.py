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
paint=mat('paint',(.42,.015,.025),.25,.22); rubber=mat('rubber',(.018,.022,.027),0,.85); trim=mat('trim',(.028,.035,.045),.25,.38); glass=mat('glass',(.023,.038,.045),.2,.16); chrome=mat('silver',(.63,.68,.73),.85,.23); dark=mat('graphite',(.12,.15,.19),.8,.3); red=mat('tail',(.5,.025,.02),.3,.22); white=mat('lamp',(.75,.82,.85),.2,.2); amber=mat('indicator',(.95,.35,.025),.2,.3)
paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.4
paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value=.16
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
 for x,w,b,s,t in sections:vs.extend([(x,-w,b),(x,w,b),(x,w,s),(x,w*.99,t),(x,-w*.99,t),(x,-w,s)])
 faces=[tuple(reversed(range(6))),tuple(range(len(vs)-6,len(vs)))]
 for i in range(len(sections)-1):
  for j in range(6):faces.append((i*6+j,i*6+(j+1)%6,(i+1)*6+(j+1)%6,(i+1)*6+j))
 return mesh(name,vs,faces,m,.025)
# Reference proportions: 4.43m coupe, 2.70m wheelbase, ~0.63m tyre diameter.
# Body and rolling gear are separate, allowing a lower stance without sinking the tyres.
def smooth_rows(rows,steps=5):
 out=[]
 for i in range(len(rows)-1):
  a,b=rows[i],rows[i+1];prev=rows[max(0,i-1)];nxt=rows[min(len(rows)-1,i+2)]
  for j in range(steps):
   t=j/steps;v=[a[0]+(b[0]-a[0])*t]
   for k in range(1,len(a)):
    ma=(b[k]-prev[k])/(b[0]-prev[0])*(b[0]-a[0]);mb=(nxt[k]-a[k])/(nxt[0]-a[0])*(b[0]-a[0])
    v.append((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*ma+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*mb)
   out.append(v)
 out.append(rows[-1]);return out
sections=smooth_rows([(-2.20,.750,.625,.735,.790),(-2.12,.803,.625,.77,.815),(-1.95,.845,.61,.81,.842),(-1.72,.854,.235,.84,.865),(-1.35,.858,.225,.855,.88),(-.77,.843,.225,.874,.918),(-.25,.835,.225,.875,.912),(.58,.836,.225,.88,.914),(1.20,.853,.235,.885,.925),(1.62,.851,.27,.89,.929),(1.99,.811,.32,.865,.905),(2.20,.755,.39,.80,.855)])
verts=[]
for x,w,b,z,t in sections:
 ring=[(-w*.93,b),(w*.93,b),(w*.965,b+.025),(w*.99,max(b+.03,.42)),(w,max(b+.04,.56)),(w*.997,max(b+.05,.62)),(w*.988,z-.035),(w*.96,z),(w*.87,t-.012),(w*.55,t+.006),(0,t+.016),(-w*.55,t+.006),(-w*.87,t-.012),(-w*.96,z),(-w*.988,z-.035),(-w*.997,max(b+.05,.62)),(-w,max(b+.04,.56)),(-w*.99,max(b+.03,.42)),(-w*.965,b+.025)]
 verts.extend((x,y,h) for y,h in ring)
n=19;faces=[tuple(reversed(range(n))),tuple(range(len(verts)-n,len(verts)))]
for i in range(len(sections)-1):
 for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
body=mesh('body',verts,faces,paint,.008)
for x in [-1.35,1.35]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=80,radius=.354,depth=3,location=(x,0,.325),rotation=(math.pi/2,0,0));cut=bpy.context.object
 bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Wheel opening','BOOLEAN');mod.object=cut;mod.operation='DIFFERENCE';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
 # Narrow rolled wheelarch lip follows the opening and blends into the wing.
 for side in [-1,1]:
  vs=[]
  for j in range(49):
   a=math.pi*j/48
   for r in [.355,.373]:vs.append((x+math.cos(a)*r,side*(.858+(.373-r)*.5),.325+math.sin(a)*r))
  mesh('arch_lip',vs,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(48)],paint)
def patch(name,rows,m,crown=0):
 vs=[];rs=smooth_rows(rows,8);steps=16
 for x,w,z in rs:
  for j in range(steps+1):
   u=-1+2*j/steps;vs.append((x,w*u,z+crown*(1-u*u)))
 fs=[]
 for i in range(len(rs)-1):
  for j in range(steps):k=i*(steps+1)+j;fs.append((k,k+1,k+steps+2,k+steps+1))
 return mesh(name,vs,fs,m)
patch('windshield',[(-.78,.736,.932),(-.46,.698,1.14),(-.12,.622,1.32)],glass,.014)
patch('roof',[(-.15,.653,1.317),(.05,.668,1.35),(.53,.668,1.354),(.86,.639,1.322)],paint,.018)
patch('rear_window',[(.88,.604,1.317),(1.16,.665,1.155),(1.50,.728,.945)],glass,.012)
def sidepanel(name,side,points,m):
 vs=[(x,side*y,z) for x,y,z in points];return mesh(name,vs,[tuple(range(len(vs)))],m)
def window(name,side,points):
 # Rounded corners and a common inclined glass plane avoid broad painted window borders.
 vs=[]
 for i,(x,z) in enumerate(points):
  prev=points[i-1];nxt=points[(i+1)%len(points)];a=(x*.92+prev[0]*.08,z*.92+prev[1]*.08);b=(x*.92+nxt[0]*.08,z*.92+nxt[1]*.08)
  for j in range(5):
   t=j/4;xx=(1-t)**2*a[0]+2*(1-t)*t*x+t*t*b[0];zz=(1-t)**2*a[1]+2*(1-t)*t*z+t*t*b[1];vs.append((xx,side*(.805-(zz-.91)*.34),zz))
 return mesh(name,vs,[tuple(range(len(vs)))],glass)
for side in [-1,1]:
 sidepanel('A_pillar',side,[(-.815,.774,.918),(-.18,.669,1.333),(-.10,.625,1.323),(-.755,.741,.937)],paint)
 sidepanel('C_pillar',side,[(.82,.654,1.335),(1.55,.775,.93),(1.35,.79,.93),(.76,.669,1.30)],paint)
 sidepanel('roof_rail',side,[(-.18,.669,1.333),(.87,.646,1.327),(.79,.674,1.302),(-.09,.674,1.303)],paint)
 window('side_window',side,[(-.71,.934),(-.09,1.306),(.57,1.313),(.64,.924)])
 window('quarter_window',side,[(.64,.925),(.62,1.313),(.79,1.305),(1.34,.954),(1.23,.924)])
 sidepanel('B_pillar',side,[(.57,.669,1.318),(.61,.669,1.318),(.68,.802,.92),(.64,.802,.92)],trim)
 for x,length,y in [(-1.945,.32,.835),(0,1.94,.843),(1.95,.30,.826)]:box('side_moulding',(x,side*y,.565),(length,.022,.045),trim,.009)
 box('door_handle',(.50,side*.841,.818),(.14,.022,.035),trim,.01)
 box('door_seam',(.78,side*.841,.60),(.006,.006,.52),trim,.001)
 box('sill_crease',(0,side*.824,.335),(1.9,.012,.009),paint,.003)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(-.64,side*.916,.96));o=bpy.context.object;o.scale=(.17,.108,.065);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'mirror',paint)
 sidepanel('bonnet_seam',side,[(-2.06,.63,.834),(-.78,.72,.938),(-.78,.725,.938),(-2.06,.635,.834)],trim)
# Rounded wraparound bumpers, with openings cut through the actual mesh.
def bumper(name,front,low):
 if front:rows=[(-2.255,.745,low,.59,.635),(-2.21,.805,low-.004,.60,.64),(-2.08,.843,low,.61,.645),(-1.90,.849,low+.01,.61,.64),(-1.71,.850,low+.04,.60,.625)]
 else:rows=[(1.91,.85,low+.02,.60,.65),(2.09,.835,low,.59,.64),(2.245,.763,low,.57,.625)]
 return hull(name,smooth_rows(rows,4),paint)
def cut_box(obj,loc,size,radius):
 cut=box('temporary_cut',loc,size,trim,radius);bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Recess','BOOLEAN');mod.object=cut;mod.operation='DIFFERENCE';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
for variant in ['stock','clean','sport','track']:
 name='package_'+variant;low={'stock':.28,'clean':.26,'sport':.205,'track':.195}[variant]
 front=bumper(name,True,low);bumper(name,False,low+.045)
 intake_height=.18 if variant in ['sport','track'] else .11; intake_z=low+.12
 cut_box(front,(-2.20,0,intake_z),(.45,.78,intake_height),.025)
 box(name,(-2.232,0,intake_z),(.012,.78,intake_height),rubber,.015)
 for dz in [-.03,.03]:box(name,(-2.243,0,intake_z+dz),(.008,.73,.005),dark,.001)
 for side in [-1,1]:
  cut_box(front,(-2.20,side*.59,low+.115),(.45,.22,.13),.018)
  box(name,(-2.225,side*.59,low+.115),(.025,.17,.084),white,.012)
  box(name,(0,side*.833,low+.048),(1.98,.045,.095),paint,.025)
 box(name,(-2.268,0,.565),(.028,1.49,.055),trim,.010)
 box(name,(-2.292,0,.49),(.018,.48,.10),white,.004)
 if variant in ['sport','track']:
  box(name,(-2.20,0,low+.008),(.23,1.53,.025),trim,.010)
 if variant=='track':
  for sy in [-.56,.56]:box(name,(1.87,sy,1.03),(.11,.052,.18),paint,.014)
  box(name,(1.87,0,1.13),(.24,1.53,.045),paint,.022)
# Lamp recesses sit within the face rather than on top of a solid square nose.

for side in [-1,1]:
 box('grille_rim',(-2.24,side*.145,.72),(.025,.235,.158),chrome,.025)
 box('grille_recess',(-2.257,side*.145,.72),(.017,.207,.135),trim,.020)
 for offset in [-.066,-.033,0,.033,.066]:box('grille_slats',(-2.266,side*.145+offset,.72),(.010,.008,.116),dark,.002)
 box('headlamp_surround',(-2.207,side*.515,.728),(.032,.405,.156),trim,.012)
 for yy in [side*.425,side*.587]:
  # Reflector rings and dark glass centres preserve twin-round optics inside rectangular housings.
  bpy.ops.mesh.primitive_torus_add(major_radius=.052,minor_radius=.005,major_segments=32,minor_segments=8,location=(-2.229,yy,.73),rotation=(0,math.pi/2,0));finish(bpy.context.object,'optic_ring',chrome)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=(-2.229,yy,.73));o=bpy.context.object;o.scale=(.009,.047,.049);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'optic_lens',glass)
 box('indicator',(-2.177,side*.744,.725),(.035,.064,.14),white,.015)
 box('taillamp',(2.206,side*.51,.755),(.035,.43,.135),red,.022)
 box('reverse_lamp',(2.227,side*.43,.75),(.014,.15,.035),white,.005)
box('rear_plate',(2.228,0,.69),(.012,.33,.10),trim,.008)
# All four styles use the same 17-inch-scale mounting geometry.
def cyl(name,loc,r,depth,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,m,.003)
for x in [-1.35,1.35]:
 for side in [-1,1]:
  y=side*.775;z=.315
  bpy.ops.mesh.primitive_torus_add(major_radius=.255,minor_radius=.060,major_segments=56,minor_segments=12,location=(x,y,z),rotation=(math.pi/2,0,0));o=bpy.context.object;o.scale.z=1.7;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'tyre',rubber)
  cyl('brake',(x,side*.845,z),.195,.025,dark)
  for style in ['stock','silver','graphite','mesh']:
   metal=dark if style=='graphite' else chrome;n={'stock':5,'silver':5,'graphite':5,'mesh':12}[style]
   prefix='rims_'+style;oy=side*.883
   bpy.ops.mesh.primitive_torus_add(major_radius=.225,minor_radius=.010,major_segments=48,minor_segments=8,location=(x,oy,z),rotation=(math.pi/2,0,0));finish(bpy.context.object,prefix,metal)
   cyl(prefix,(x,oy,z),.060,.03,metal)
   for j in range(n):
    angle=j*2*math.pi/n
    for delta in ([-.065,.065] if style in ['silver','graphite'] else [0]):
     a=angle+delta;ob=box(prefix,(x+math.sin(a)*.14,oy,z+math.cos(a)*.14),(.019 if n==12 else .045 if style=='stock' else .025,.026,.18),metal,.007);ob.rotation_euler[1]=a
# Join objects by named variant or material; GLB keeps replacement groups compact.
for prefix in ['rims_stock','rims_silver','rims_graphite','rims_mesh','package_stock','package_clean','package_sport','package_track']:
 objs=[o for o in bpy.context.scene.objects if o.name.startswith(prefix)]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=prefix
# Rolling gear stays on the ground when a package lowers the body.
rolling=[o for o in bpy.context.scene.objects if o.name.startswith(('tyre','brake'))]
bpy.ops.object.select_all(action='DESELECT')
for o in rolling:o.select_set(True)
bpy.context.view_layer.objects.active=rolling[0];bpy.ops.object.join();rolling[0].name='rolling_gear'
# Batch fixed coachwork into shared-material primitives for mobile draw-call cost.
static=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith(('rims_','package_','rolling_gear'))]
bpy.ops.object.select_all(action='DESELECT')
for o in static:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='coachwork'
out=os.path.abspath('assets/vehicles/3d');os.makedirs(out,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=out+'/chs-coupe-96.blend')
bpy.ops.export_scene.gltf(filepath=out+'/chs-coupe-96.glb',export_format='GLB',export_apply=True)
