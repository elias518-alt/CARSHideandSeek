"""Render cosmetic layers from privately supplied NoEdge figures.
Run separately for male and female; input is never overwritten.
"""
import bpy, math, argparse, sys
from pathlib import Path
from mathutils import Vector, Matrix
p=argparse.ArgumentParser();p.add_argument('--gender',choices=['male','female'],required=True);p.add_argument('--output',required=True);p.add_argument('--samples',type=int,default=48);p.add_argument('--only',nargs='*');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
female=a.gender=='female';scene=bpy.context.scene
# Pose the supplied Rigify character using FK controls before evaluating geometry.
if female:
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE' and 'Rigify' in o.name)
 for side,angle in [('L',.80),('R',-.80)]:
  rig.pose.bones['upper_arm_parent.'+side]['IK_FK']=1.0
 bpy.context.view_layer.update()
 for side,angle in [('L',.80),('R',-.80)]:
  bone=rig.pose.bones['upper_arm_fk.'+side];head=bone.head.copy()
  bone.matrix=Matrix.Translation(head)@Matrix.Rotation(angle,4,'Y')@Matrix.Translation(-head)@bone.matrix
 bpy.context.view_layer.update()
for o in list(bpy.data.objects):
 if o.type in {'LIGHT','CAMERA'} or o.name.startswith('WGT-') or 'Collider' in o.name:bpy.data.objects.remove(o,do_unlink=True)
body=next(o for o in bpy.data.objects if o.type=='MESH' and (o.name=='Body' if female else o.name.startswith('Body_')))
# Freeze evaluated pose for consistent fitted clothes and occlusion.
for o in list(bpy.data.objects):
 if o.type=='MESH':
  evaluated=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=bpy.data.meshes.new_from_object(evaluated)
  o.modifiers.clear();o.data=mesh;o.matrix_world=evaluated.matrix_world.copy()
  o.hide_render=False
 elif o.type=='ARMATURE':o.hide_render=True
hair=[o for o in bpy.data.objects if o.type=='MESH' and ('LongCurly' in o.name if female else 'curtains' in o.name)]
base=[o for o in bpy.data.objects if o.type=='MESH' and o not in hair]
center=0 if female else -.074
height=1.70 if female else 1.85
# Render view: consistent floor, front three-quarter lighting, transparent canvas.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=a.samples;scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.resolution_x=384;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Wardrobe studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.18,.23,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
camera=bpy.data.objects.new('Wardrobe camera',bpy.data.cameras.new('Wardrobe camera'));scene.collection.objects.link(camera)
camera.location=(center+.25,-4.5,height*.52);camera.rotation_euler=(Vector((center,0,height*.51))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=height*1.15;scene.camera=camera
for name,loc,power,size in [('Key',(-2,-3,3),350,3),('Fill',(2,-2,2),220,3),('Rim',(1,2,3),450,2)]:
 light=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(light);light.location=loc;light.data.energy=power;light.data.size=size;light.rotation_euler=(Vector((center,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX'
def material(name,color,metal=0,rough=.7):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 if not metal:
  noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=180; bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.002;m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],b.inputs['Normal'])
 return m
fabric=material('Neutral fabric',(.52,.52,.52));denim=material('Denim',(.30,.30,.30));gold=material('Gold',(.7,.44,.12),.85,.23);dark=material('Frames',(.012,.016,.022),.35,.22);lens=material('Lenses',(.02,.035,.046),.2,.13)
def mesh_object(name,vertices,faces,mat):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.data.materials.append(mat)
 for face in mesh.polygons:face.use_smooth=True
 return o
def rings(name,rows,mat=fabric,n=48):
 verts=[]
 for x,y,z,rx,ry in rows:
  for i in range(n):
   t=2*math.pi*i/n;verts.append((x+rx*math.cos(t),y+ry*math.sin(t),z))
 faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)]
 o=mesh_object(name,verts,faces,mat);solid=o.modifiers.new('Hem thickness','SOLIDIFY');solid.thickness=.004
 return o
def tube(name,points,radius,mat):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=3
 spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
 for p,v in zip(spline.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o);o.data.materials.append(mat);return o
def sphere(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
 for face in o.data.polygons:face.use_smooth=True
 return o
# Clothing shells follow the supplied body's evaluated surface, retaining sleeve anatomy.
verts=[body.matrix_world@v.co for v in body.data.vertices]
normals=[(body.matrix_world.to_3x3().inverted().transposed()@v.normal).normalized() for v in body.data.vertices]
print('BODY MATRIX',body.matrix_world,'Z bounds',min(v.z for v in verts),max(v.z for v in verts),flush=True)
def fitted(name,predicate,inflate,mat):
 selected=[poly for poly in body.data.polygons if predicate(sum((verts[i] for i in poly.vertices),Vector())/len(poly.vertices))]
 ids=sorted({i for poly in selected for i in poly.vertices});mapping={i:j for j,i in enumerate(ids)}
 points=[]
 for i in ids:
  v=verts[i]+normals[i]*inflate
  # Smooth torso fabric across chest instead of copying every skin detail.
  if abs(v.x-center)<(.17 if female else .23) and v.z>(.98 if female else 1.08):
   v.y=min(v.y,-(.14 if female else .15)-inflate) if v.y<0 else max(v.y,.09+inflate)
  points.append(v)
 o=mesh_object(name,points,[tuple(mapping[i] for i in poly.vertices) for poly in selected],mat)
 solid=o.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.005
 smooth=o.modifiers.new('Fabric relaxation','SMOOTH');smooth.factor=.7;smooth.iterations=2
 return o
waist=.98 if female else 1.05;shoulder=1.40 if female else 1.57;neck=1.46 if female else 1.63
# Surface selection uses shoulder-to-arm spatial bounds in the evaluated relaxed pose.
def top_region(v,long=False,crop=False):
 low=waist+.13 if crop else waist-.035
 if abs(v.x-center)<(.19 if female else .25):return low<v.z<shoulder+.015
 return (((.84 if female else .92) if long else shoulder-.19)<v.z<shoulder+.015) and abs(v.x-center)<(.43 if female else .40)
tops=[]
for index,name in enumerate(['tshirt','hoodie','crop' if female else 'halfzip']):
 start=set(bpy.data.objects)
 fitted(name,lambda v:top_region(v,index==1 or (index==2 and not female),index==2 and female) and abs(v.x-center)>(.14 if female else .20),.027 if index!=1 else .04,fabric)
 hem=waist+.13 if index==2 and female else waist-.04
 loose=.028 if index==1 else .01
 rows=[]
 for row in range(21):
  t=row/20;z=hem+(shoulder-.005-hem)*t
  rx=(.17+.035*t if female else .215+.027*t)+loose
  ry=(.112+.038*t if female else .143+.012*t)+loose
  fold=.0006*math.sin(row*1.7)
  rows.append((center,-.018,z,rx+fold,ry+fold))
 rows.extend([(center,.006,shoulder+.016,.15 if female else .19,.123+loose),(center,.015,neck-.02,.079,.079)])
 torso=rings(name+'-torso',rows,fabric)
 sub=torso.modifiers.new('Soft tailored fabric','SUBSURF');sub.levels=2;sub.render_levels=2
 if index==1:
  # Hood resting behind neck; open front, visible curved rim.
  sphere('hood',(center,.075,neck-.02),(.125,.095,.13),fabric)
  for dx in [-.055,.055]:tube('drawstring',[(center+dx,-.14,shoulder),(center+dx,-.17,shoulder-.18)],.0025,dark)
 if index==2 and not female:
  tube('halfzip',[(center,-.193,neck-.035),(center,-.195,shoulder-.18)],.003,dark)
  rings('undershirt',[(center,-.006,neck-.055,.072,.077),(center,-.006,neck-.022,.072,.077)],material('White undershirt',(.85,.85,.85)))
 tops.append(list(set(bpy.data.objects)-start))
pants=[]
for index,name in enumerate(['shorts','jeans','joggers']):
 start=set(bpy.data.objects);bottom=.57 if index==0 else .09
 # Exclude hands by requiring vertices to remain within leg/pelvis width.
 fitted(name,lambda v:bottom<v.z<waist+.035 and abs(v.x-center)<((.255 if female else .32) if v.z<.70 else (.21 if female else .23)),.028 if index!=2 else .045,denim if index==1 else fabric)
 if True:
  source=next(o for o in base if ('Underwear_Bottoms' in o.name if female else 'Boxers' in o.name))
  cover=source.copy();cover.data=source.data.copy();scene.collection.objects.link(cover);cover.name=name+'-pelvis';cover.data.materials.clear();cover.data.materials.append(denim if index==1 else fabric)
  for vertex in cover.data.vertices:vertex.co+=vertex.normal*(.025 if index!=2 else .04)
 rings(name+'-waist',[(center,0,waist-.018,.17 if female else .235,.125 if female else .17),(center,0,waist+.012,.17 if female else .235,.125 if female else .17)],denim if index==1 else fabric)
 if index==1:
  for sign in [-1,1]:
   tube('pocket seam',[(center+sign*.06,-.163,waist-.015),(center+sign*.11,-.165,waist-.08),(center+sign*.15,-.14,waist-.12)],.001,material('Denim thread',(.48,.48,.48)))
  tube('fly seam',[(center,-.18,waist),(center,-.18,waist-.15)],.0015,dark)
 if index==2:
  for dx in [-.018,.018]:tube('jogger-drawstring',[(center+dx,-.16,waist),(center+dx,-.164,waist-.09)],.002,dark)
 pants.append(list(set(bpy.data.objects)-start))
shoes=[]
for sign in [-1,1]:
 foot=[v for v in verts if v.z<.115 and (v.x-center)*sign>0]
 xmin,xmax=min(v.x for v in foot),max(v.x for v in foot);ymin,ymax=min(v.y for v in foot),max(v.y for v in foot)
 for name,z,thickness,mat in [('Sneaker upper',.075,.145,material('Sneaker fabric',(.06,.065,.075))),('Sneaker sole',.018,.028,material('Rubber sole',(.52,.52,.52)))]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=((xmin+xmax)/2,(ymin+ymax)/2,z));o=bpy.context.object;o.name=name;o.scale=(xmax-xmin+.026,ymax-ymin+.03,thickness);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  bevel=o.modifiers.new('Rounded shoe construction','BEVEL');bevel.width=.035 if name.endswith('upper') else .008;bevel.segments=5;o.data.materials.append(mat)
  for face in o.data.polygons:face.use_smooth=True
  shoes.append(o)
# Keep the selected model's original hair as option 1; additional salon styles use strand geometry.
styles=[hair]
hairmat=material('Neutral hair',(.20,.20,.20),0,.38)
for obj in hair:
 for mat in obj.data.materials:
  if not mat or not mat.use_nodes:continue
  for node in mat.node_tree.nodes:
   if node.type=='BSDF_PRINCIPLED':
    socket=node.inputs['Base Color']
    for link in list(socket.links):mat.node_tree.links.remove(link)
    socket.default_value=(.20,.20,.20,1)
headz=1.59 if female else 1.74
for style in [1,2]:
 copies=[]
 for source in hair:
  new=source.copy();new.data=source.data.copy();scene.collection.objects.link(new);new.name='Salon style '+str(style)
  for vertex in new.data.vertices:vertex.co=source.matrix_world@vertex.co
  new.matrix_world=Matrix.Identity(4)
  if style==1:
   import bmesh
   bm=bmesh.new();bm.from_mesh(new.data)
   cutoff=headz-.11 if female else headz+.04
   bmesh.ops.delete(bm,geom=[face for face in bm.faces if face.calc_center_median().z<cutoff],context='FACES');bm.to_mesh(new.data);bm.free()
  else:
   for vertex in new.data.vertices:
    v=vertex.co
    if female and v.z<headz+.025:
     factor=min(1,max(0,(headz+.025-v.z)/.08))
     v.x=center+(v.x-center)*(1-.65*factor)+.19*factor;v.y=v.y*(1-factor)+(-.10+.035*math.sin(v.z*12))*factor
    elif not female:
     factor=min(1,max(0,(headz+.105-v.z)/.16))
     v.y=v.y*(1-factor)+.11*factor;v.z+=factor*.05
  copies.append(new)
 styles.append(copies)
# Jewelry and glasses have actual geometry, rendered with matching camera and occlusion.
start=set(bpy.data.objects)
for i in range(72):
 t=2*math.pi*i/72;x=center+.105*math.cos(t);y=.005+.18*math.sin(t);z=neck-.09-.10*max(0,-math.sin(t))
 bpy.ops.mesh.primitive_torus_add(major_radius=.006 if female else .009,minor_radius=.0015 if female else .002,major_segments=12,minor_segments=6,location=(x,y,z));o=bpy.context.object;o.name='Chain link';o.rotation_euler=(math.pi/2,0,t+(i%2)*math.pi/2);o.data.materials.append(gold)
chain=list(set(bpy.data.objects)-start)
start=set(bpy.data.objects)
for sign in [-1,1]:
 x=center+sign*.046;y=-.10;z=headz+.005
 sphere('Sunglass lens',(x,y,z),(.037,.009,.022),lens)
 tube('Frame',[(x+.039*math.cos(t),y-.006,z+.025*math.sin(t)) for t in [i*2*math.pi/48 for i in range(49)]],.003,dark)
 tube('Temple',[(x+sign*.037,y,z),(center+sign*.095,.005,z)],.0025,dark)
tube('Bridge',[(center-.015,-.105,headz+.008),(center+.015,-.105,headz+.008)],.0025,dark)
glasses=list(set(bpy.data.objects)-start)
start=set(bpy.data.objects)
if female:
 for sign in [-1,1]:tube('Hoop earring',[(center+sign*.097+.014*math.cos(t),-.007,headz-.065+.021*math.sin(t)) for t in [i*2*math.pi/48 for i in range(49)]],.002,gold)
earrings=list(set(bpy.data.objects)-start)
cosmetics=tops+pants+styles+[shoes,chain,glasses,earrings]
all_objects=set(o for group in cosmetics for o in group)
# Hide underwear/torso areas permanently behind tops/pants in the base layer.
# Base stays private to prevent publishing a standalone undressed character.
holdout=bpy.data.materials.new('Body occlusion');holdout.use_nodes=True;nodes=holdout.node_tree.nodes;nodes.clear();output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeHoldout');holdout.node_tree.links.new(shader.outputs[0],output.inputs['Surface'])
occluder=body.copy();occluder.data=body.data.copy();scene.collection.objects.link(occluder);occluder.name='Private body occluder';occluder.data.materials.clear();occluder.data.materials.append(holdout)
for face in occluder.data.polygons:face.material_index=0
def render(name,visible,occlusion=False):
 if a.only and name not in a.only:return
 if occlusion:visible=list(visible)+[occluder]
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o not in visible
 scene.render.filepath=str((out/(name+'.png')).resolve());bpy.ops.render.render(write_still=True)
# A dressed full-body reference is for visual QA only, not a selector asset.
render('proof',base+tops[0]+pants[1]+styles[0]+shoes)
# Isolated skin base: remove torso/pelvis pixels at mesh level so no unclothed fallback is shipped.
# Retain only exposed head, hands and lower legs for the shorts option.
base_visible=[]
for o in base:
 if o==body:
  fitted_body=fitted('exposed-skin',lambda v:v.z>neck-.01 or (abs(v.x-center)>(.205 if female else .25) and v.z<shoulder-.20) or .14<v.z<.58 or (waist+.018<v.z<waist+.145 and abs(v.x-center)<.20),0,body.data.materials[0])
  # Preserve original material assignment and UVs by copying polygons directly below.
  bpy.data.objects.remove(fitted_body,do_unlink=True)
  import bmesh
  new=o.copy();new.data=o.data.copy();scene.collection.objects.link(new);new.name='Exposed skin'
  bm=bmesh.new();bm.from_mesh(new.data)
  delete=[]
  for face in bm.faces:
   v=new.matrix_world@face.calc_center_median()
   exposed=v.z>neck-.01 or (abs(v.x-center)>(.205 if female else .25) and v.z<shoulder-.20) or .14<v.z<.58 or (waist+.018<v.z<waist+.145 and abs(v.x-center)<.20)
   if not exposed:delete.append(face)
  bmesh.ops.delete(bm,geom=delete,context='FACES');bm.to_mesh(new.data);bm.free();base_visible.append(new)
 elif not any(word in o.name.lower() for word in ['bra','boxer','underwear']):base_visible.append(o)
render('base',base_visible)
for prefix,groups in [('top',tops),('pants',pants),('hair',styles)]:
 for i,objects in enumerate(groups):render(prefix+'-'+str(i),objects,True)
for name,objects in [('shoes',shoes),('chain',chain),('glasses',glasses)]+([('earrings',earrings)] if female else []):render(name,objects,name!='shoes')
print('WARDROBE_RENDER_OK',a.gender)
