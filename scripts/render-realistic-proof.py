import bpy,math,json,sys,argparse
from mathutils import Vector
from pathlib import Path
parser=argparse.ArgumentParser(description='Render an isolated face/material proof; never modifies the input blend file.')
parser.add_argument('--output',required=True)
parser.add_argument('--samples',type=int,default=128)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if not 1<=args.samples<=1024:raise ValueError('Samples must be 1..1024')
scene=bpy.context.scene
for o in list(bpy.data.objects):
 if o.type in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
 elif o.name.startswith('WGT-') or 'Collider' in o.name:o.hide_render=True
 elif o.type=='MESH':o.hide_render=False
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=args.samples
scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=480;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world=bpy.data.worlds.new('CHS proof world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.045,.065,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
camera=bpy.data.objects.new('CHS Camera',bpy.data.cameras.new('CHS Camera'));scene.collection.objects.link(camera);camera.location=(.12,-3,1.57)
camera.rotation_euler=(Vector((0,0,1.52))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=.60;scene.camera=camera
for name,loc,power,size in [('Key',(-1.3,-1.5,2.3),180,1.5),('Fill',(1.5,-.8,1.6),100,1.8),('Rim',(.5,1.2,2),220,1.3)]:
 o=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(Path(args.output).resolve())
Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.render.render(write_still=True)
print('PROOF_RENDER_OK')
