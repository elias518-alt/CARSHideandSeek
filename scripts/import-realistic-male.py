import bpy,json,math
from pathlib import Path
import argparse,sys
p=argparse.ArgumentParser();p.add_argument("--source",required=True);p.add_argument("--output",required=True)
a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root=Path(a.source).resolve();data=json.loads((root/'mesh.json').read_text())
for item in data['meshes']:
 scale=data['meters']
 if data['up']!='Y':raise ValueError('Expected Y-up source')
 points=[(p[0]*scale,-p[2]*scale,p[1]*scale) for p in item['points']]
 faces=[];at=0
 for count in item['counts']:faces.append(item['indices'][at:at+count]);at+=count
 mesh=bpy.data.meshes.new(item['name']);mesh.from_pydata(points,[],faces);mesh.update()
 o=bpy.data.objects.new(item['name'],mesh);bpy.context.collection.objects.link(o)
 uv=mesh.uv_layers.new(name='UVMap')
 for loop in mesh.loops:
  index=loop.vertex_index if item.get('uvInterpolation')=='vertex' else loop.index
  if item['uvIndices']:index=item['uvIndices'][index]
  uv.data[loop.index].uv=item['uv'][index]
 for poly in mesh.polygons:poly.use_smooth=True
 mat=bpy.data.materials.new(item['name']);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.55
 texture=bpy.data.images.load(str(root/item['texture']),check_existing=True);image=mat.node_tree.nodes.new('ShaderNodeTexImage');image.image=texture
 mat.node_tree.links.new(image.outputs['Color'],bs.inputs['Base Color'])
 if 'Hair' in item['texture'] or 'Scalp' in item['texture']:
  mat.node_tree.links.new(image.outputs['Alpha'],bs.inputs['Alpha']);mat.blend_method='HASHED'
 else:
  normal_path=root/'0/hhhf_meshes_Merge1_normal_norm.jpg'
  if normal_path.exists():
   nm=mat.node_tree.nodes.new('ShaderNodeTexImage');nm.image=bpy.data.images.load(str(normal_path),check_existing=True);nm.image.colorspace_settings.name='Non-Color';n=mat.node_tree.nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(nm.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Normal'],bs.inputs['Normal'])
 mesh.materials.append(mat)
 print('MALE',o.name,'bounds',tuple(min(v.co[i]for v in mesh.vertices)for i in range(3)),tuple(max(v.co[i]for v in mesh.vertices)for i in range(3)))
bpy.ops.wm.save_as_mainfile(filepath=str(Path(a.output).resolve()))
