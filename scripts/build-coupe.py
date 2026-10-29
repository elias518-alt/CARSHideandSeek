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
def line(name,points,m,radius=.004):
 # Small physical seals and panel gaps follow the coachwork instead of floating rectangular decals.
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=radius;d.bevel_resolution=2
 p=d.splines.new('POLY');p.points.add(len(points)-1)
 for v,co in zip(p.points,points):v.co=(*co,1)
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 return bpy.context.object
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
sections=smooth_rows([(-2.20,.750,.625,.785,.845),(-2.12,.803,.625,.815,.860),(-1.95,.845,.61,.84,.880),(-1.72,.854,.235,.85,.895),(-1.35,.858,.225,.86,.903),(-.77,.843,.225,.874,.918),(-.25,.835,.225,.875,.912),(.58,.836,.225,.88,.914),(1.20,.853,.235,.885,.925),(1.62,.851,.27,.89,.929),(1.99,.811,.32,.865,.905),(2.20,.755,.39,.80,.855)])
verts=[]
for x,w,b,z,t in sections:
 ring=[(-w*.93,b),(w*.93,b),(w*.965,b+.025),(w*.99,max(b+.03,.42)),(w,max(b+.04,.56)),(w*.997,max(b+.05,.62)),(w*.988,z-.035),(w*.96,z),(w*.87,t-.012),(w*.55,t+.006),(0,t+.016),(-w*.55,t+.006),(-w*.87,t-.012),(-w*.96,z),(-w*.988,z-.035),(-w*.997,max(b+.05,.62)),(-w,max(b+.04,.56)),(-w*.99,max(b+.03,.42)),(-w*.965,b+.025)]
 # Swept nose corners keep the lamps within the wing, not on a flat vertical wall.
 sweep=max(0,1-(x+2.20)/.22)*.085 if x< -1.98 else 0
 verts.extend((x+sweep*(abs(y)/w)**3,y,h) for y,h in ring)
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
 o=mesh(name,vs,[tuple(range(len(vs)))],glass)
 line('window_seal',vs+[vs[0]],trim,.007)
 return o
for side in [-1,1]:
 sidepanel('A_pillar',side,[(-.815,.774,.918),(-.18,.669,1.333),(-.10,.625,1.323),(-.755,.741,.937)],paint)
 sidepanel('C_pillar',side,[(.82,.654,1.335),(1.55,.775,.93),(1.35,.79,.93),(.76,.669,1.30)],paint)
 sidepanel('roof_rail',side,[(-.18,.669,1.333),(.87,.646,1.327),(.79,.674,1.302),(-.09,.674,1.303)],paint)
 window('side_window',side,[(-.71,.934),(-.09,1.306),(.57,1.313),(.64,.924)])
 window('quarter_window',side,[(.64,.925),(.62,1.313),(.79,1.305),(1.34,.954),(1.23,.924)])
 sidepanel('B_pillar',side,[(.57,.669,1.318),(.61,.669,1.318),(.68,.802,.92),(.64,.802,.92)],trim)
 for x,length,y in [(-1.945,.32,.835),(0,1.94,.843),(1.95,.30,.826)]:box('side_moulding',(x,side*y,.565),(length,.022,.045),trim,.009)
 box('door_handle',(.50,side*.841,.818),(.14,.022,.035),trim,.01)
 line('door_seam',[(-.75,side*.841,.91),(-.78,side*.847,.77),(-.78,side*.85,.43),(-.70,side*.838,.32),(.61,side*.838,.32),(.72,side*.845,.39),(.78,side*.845,.78),(.78,side*.81,.92)],trim,.0025)
 box('sill_crease',(0,side*.824,.335),(1.9,.012,.009),paint,.003)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(-.64,side*.916,.96));o=bpy.context.object;o.scale=(.17,.108,.065);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'mirror',paint)
 line('bonnet_seam',[(-2.16,side*.596,.859),(-1.95,side*.66,.882),(-1.72,side*.69,.894),(-1.35,side*.71,.90),(-.78,side*.72,.912)],trim,.002)
# Rounded wraparound bumpers, with openings cut through the actual mesh.
def bumper(name,front,low):
 if front:rows=[(-2.255,.745,low,.59,.635),(-2.21,.805,low-.004,.60,.64),(-2.08,.843,low,.61,.645),(-1.90,.849,low+.01,.61,.64),(-1.71,.850,low+.04,.60,.625)]
 else:rows=[(1.78,.837,low+.035,.60,.65),(1.96,.845,low+.015,.60,.65),(2.12,.812,low,.59,.64),(2.24,.75,low+.025,.57,.625)]
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
 hull(name,[(-.985,.839,low+.012,low+.075,low+.105),(-.85,.844,low,low+.065,low+.09),(.85,.844,low,low+.065,low+.09),(.985,.839,low+.012,low+.075,low+.105)],paint)
 # Follow the front/rear corners instead of fitting a straight full-width bar.
 line(name,[(-1.74,-.852,.565),(-2.07,-.846,.565),(-2.22,-.805,.565),(-2.267,-.69,.565),(-2.267,.69,.565),(-2.22,.805,.565),(-2.07,.846,.565),(-1.74,.852,.565)],trim,.020)
 line(name,[(1.81,-.849,.565),(2.1,-.833,.565),(2.257,-.72,.565),(2.257,.72,.565),(2.1,.833,.565),(1.81,.849,.565)],trim,.021)
 box(name,(-2.274,0,.511),(.018,.48,.102),white,.004)
 if variant in ['sport','track']:
  box(name,(-2.20,0,low+.008),(.23,1.53,.025),trim,.010)
 if variant=='track':
  for sy in [-.56,.56]:box(name,(1.87,sy,1.03),(.11,.052,.18),paint,.014)
  box(name,(1.87,0,1.13),(.24,1.53,.045),paint,.022)
# Continuous nose panel: lights and grille follow its swept face.
# The optics are set into shallow chrome reflectors, with a thin outer glazing.
reflector=mat('reflector',(.47,.50,.53),.85,.18)
lens=mat('headlight_glass',(.48,.55,.59),.38,.16)
for side in [-1,1]:
 cut_box(body,(-2.18,side*.516,.724),(.28,.434,.160),.013)
 box('grille_rim',(-2.215,side*.142,.722),(.022,.235,.147),chrome,.026)
 box('grille_recess',(-2.231,side*.142,.722),(.014,.208,.122),trim,.023)
 for offset in [-.066,-.033,0,.033,.066]:box('grille_slats',(-2.240,side*.142+offset,.722),(.008,.007,.102),dark,.002)
 # Sweep outward with the front of the bonnet; no floating full-width faceplate.
 housing=box('headlamp_surround',(-2.169,side*.509,.723),(.040,.411,.147),trim,.014);housing.rotation_euler[2]=side*-.12
 for yy in [side*.423,side*.585]:
  xx=-2.197+(abs(yy)-.423)*.12
  bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16,radius=1,location=(xx,yy,.724));o=bpy.context.object;o.scale=(.014,.066,.061);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'optic_reflector',reflector)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(xx-.013,yy,.724));o=bpy.context.object;o.scale=(.007,.043,.042);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'optic_lens',lens)
  box('optic_bulb',(xx-.021,yy,.724),(.005,.012,.012),white,.004)
 # Small ribs in the indicator lens, inset and swept around the wing corner.
 indicator=box('indicator',(-2.121,side*.741,.721),(.044,.069,.129),lens,.013);indicator.rotation_euler[2]=-side*.22
 for dz in [-.035,0,.035]:line('indicator_rib',[(-2.148,side*.713,.721+dz),(-2.129,side*.771,.721+dz)],chrome,.0015)
 box('taillamp',(2.206,side*.51,.755),(.035,.43,.135),red,.022)
 box('reverse_lamp',(2.227,side*.43,.75),(.014,.15,.035),white,.005)
 line('windscreen_seal',[(-.78,side*.736,.934),(-.46,side*.698,1.142),(-.12,side*.622,1.322)],trim,.009)
 line('rear_glass_seal',[(.88,side*.604,1.319),(1.16,side*.665,1.157),(1.50,side*.728,.947)],trim,.008)
# A curved cowl and glass seals close the gap at the foot of the windscreen.
for x,w,z in [(-.78,.736,.934),(-.12,.622,1.322),(.88,.604,1.319),(1.5,.728,.947)]:
 line('glass_cross_seal',[(x,w*u,z+.014*(1-u*u)) for u in [i/16 for i in range(-16,17)]],trim,.007)
for side in [-1,1]:
 line('wiper',[(-.77,side*.59,.951),(-.69,side*.38,.999),(-.64,side*.10,1.038)],trim,.005)
box('rear_plate',(2.228,0,.69),(.012,.33,.10),trim,.008)
# All four styles use the same 17-inch-scale mounting geometry.
def cyl(name,loc,r,depth,m):
 # Small bolt sockets do not need the tessellation/bevel of a visible wheel barrel.
 bpy.ops.mesh.primitive_cylinder_add(vertices=12 if r<.015 else 24 if r<.07 else 40,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,m,0 if r<.015 else .003)
for x in [-1.35,1.35]:
 for side in [-1,1]:
  y=side*.775;z=.315
  # Revolved radial tyre profile: flat tread, rounded shoulders, proper sidewalls.
  profile=[(-.103,.232),(-.108,.270),(-.100,.296),(-.083,.311),(-.060,.315),(.060,.315),(.083,.311),(.100,.296),(.108,.270),(.103,.232)]
  vs=[];segments=64
  for offset,radius in profile:
   for j in range(segments):
    a=2*math.pi*j/segments;vs.append((x+math.sin(a)*radius,y+offset,z+math.cos(a)*radius))
  fs=[]
  for k in range(len(profile)-1):
   for j in range(segments):a=k*segments+j;b=k*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
  mesh('tyre',vs,fs,rubber)
  for offset in [-.05,0,.05]:
   bpy.ops.mesh.primitive_torus_add(major_radius=.3126,minor_radius=.0018,major_segments=64,minor_segments=6,location=(x,y+offset,z),rotation=(math.pi/2,0,0));finish(bpy.context.object,'tyre_groove',trim)
  cyl('brake',(x,side*.845,z),.195,.025,dark)
  for style in ['stock','silver','graphite','mesh']:
   metal=dark if style=='graphite' else chrome;n={'stock':5,'silver':5,'graphite':5,'mesh':12}[style]
   prefix='rims_'+style;oy=side*.883
   bpy.ops.mesh.primitive_torus_add(major_radius=.225,minor_radius=.010,major_segments=48,minor_segments=8,location=(x,oy,z),rotation=(math.pi/2,0,0));finish(bpy.context.object,prefix,metal)
   cyl(prefix,(x,oy,z),.060,.03,metal)
   # Broad, tapered spokes with concave roots; sockets and bolt heads sit in the hub.
   for j in range(5):
    a=j*2*math.pi/5;cyl(prefix,(x+math.sin(a)*.039,oy+side*.018,z+math.cos(a)*.039),.008,.009,dark)
    cyl(prefix,(x+math.sin(a)*.039,oy+side*.024,z+math.cos(a)*.039),.0045,.01,chrome)
   cyl(prefix,(x,oy+side*.018,z),.023,.014,dark)
   for j in range(n):
    angle=j*2*math.pi/n
    for delta in ([-.065,.065] if style in ['silver','graphite'] else [0]):
     a=angle+delta;vs=[]
     width=.069 if style=='stock' else .018 if style=='mesh' else .028
     for r,w,depth in [(.048,width*.65,-.016),(.095,width*.94,-.012),(.16,width,.002),(.217,width*.63,.004)]:
      for sign in [-1,1]:vs.append((x+math.sin(a)*r+math.cos(a)*w*sign/2,oy+side*depth,z+math.cos(a)*r-math.sin(a)*w*sign/2))
     o=mesh(prefix,vs,[(0,1,3,2),(2,3,5,4),(4,5,7,6)],metal)
     mod=o.modifiers.new('Spoke thickness','SOLIDIFY');mod.thickness=.018
     bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
     mod=o.modifiers.new('Spoke edges','BEVEL');mod.width=.004;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
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
