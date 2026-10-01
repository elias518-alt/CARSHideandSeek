"""Export NoEdge USDZ bind meshes privately for Blender (requires usd-core).
The package stores skinned points in bind space already. Parent joint transforms
must not be applied again to hair/eyes/teeth. This exports a static bind pose,
not an animated skeleton. Original model files never belong in the repository.
"""
from pxr import Usd, UsdGeom, UsdShade
from pathlib import Path
import argparse, json, zipfile
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('output');a=p.parse_args()
out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.source) as archive:
 for info in archive.infolist():
  target=(out/info.filename).resolve()
  if not target.is_relative_to(out):raise ValueError('Unsafe archive path')
 archive.extractall(out)
files=list(out.glob('*.usdc'))+list(out.glob('*.usda'))
if len(files)!=1:raise ValueError('Expected one USD stage')
stage=Usd.Stage.Open(str(files[0]));items=[]
for prim in stage.Traverse():
 if not prim.IsA(UsdGeom.Mesh):continue
 mesh=UsdGeom.Mesh(prim);material=UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
 skinned=prim.GetAttribute('primvars:skel:jointIndices').HasAuthoredValueOpinion()
 transform=UsdGeom.XformCache().GetLocalToWorldTransform(prim)
 points=mesh.GetPointsAttr().Get()
 item={'name':prim.GetName(),'points':[list(v if skinned else transform.Transform(v)) for v in points],
 'counts':list(mesh.GetFaceVertexCountsAttr().Get()),'indices':list(mesh.GetFaceVertexIndicesAttr().Get()),'uv':[],'uvIndices':[],'texture':None}
 for uv in UsdGeom.PrimvarsAPI(prim).GetPrimvars():
  if uv.GetPrimvarName() in ('st','st0'):
   item.update(uv=[list(v) for v in uv.Get()],uvIndices=list(uv.GetIndices() or []),uvInterpolation=uv.GetInterpolation())
 if material:
  for node in Usd.PrimRange(material.GetPrim()):
   attr=node.GetAttribute('inputs:file');value=attr.Get()
   if value and 'baseColor' in value.path:item['texture']=value.path
 if not item['uv'] or not item['texture']:raise ValueError('Missing UVs or color texture: '+item['name'])
 items.append(item)
(out/'mesh.json').write_text(json.dumps({'up':str(UsdGeom.GetStageUpAxis(stage)),'meters':UsdGeom.GetStageMetersPerUnit(stage),'meshes':items}))
print('EXPORTED',len(items),'bind meshes')
