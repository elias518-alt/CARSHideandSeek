// Render existing CC0 geometry, no generated artwork and no browser runtime.
// Usage: node scripts/render-characters.mjs /path/to/FreeModels /output/path
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
globalThis.ProgressEvent=class {constructor(type,options){Object.assign(this,{type},options);}};
class Element {
  constructor(name){this.name=name;this.attributes={};this.childNodes=[];this.style={};}
  setAttribute(key,value){this.attributes[key]=String(value);}
  appendChild(child){this.childNodes.push(child);}
  removeChild(child){this.childNodes.splice(this.childNodes.indexOf(child),1);}
  serialize(){return `<${this.name} ${Object.entries(this.attributes).map(([k,v])=>`${k}="${v.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`).join(' ')}>${this.childNodes.map(c=>c.serialize()).join('')}</${this.name}>`;}
}
globalThis.document={createElementNS:(_,name)=>new Element(name)};
const source=process.argv[2],out=process.argv[3];
if(!source||!out)throw new Error('Specify downloaded CC0 model source and output folder');
await fs.mkdir(out,{recursive:true});
const models=[['men-casual','Ultimate Modular Men- Feb 2022','Casual_2'],['men-hoodie','Ultimate Modular Men- Feb 2022','Casual_Hoodie'],['men-punk','Ultimate Modular Men- Feb 2022','Punk'],['women-casual','Ultimate Modular Women - April 2022','Casual'],['women-formal','Ultimate Modular Women - April 2022','Formal'],['women-punk','Ultimate Modular Women - April 2022','Punk']];
const manifest=[];
for(const [id,pack,file]of models){
  const raw=await fs.readFile(path.join(source,pack,'Individual Characters/glTF',file+'.gltf'),'utf8');
  const loaded=await new GLTFLoader().parseAsync(raw,'');
  const idle=loaded.animations.find(a=>a.name==='Idle');
  if(!idle)throw new Error('Missing stock Idle animation');
  const mixer=new THREE.AnimationMixer(loaded.scene);mixer.clipAction(idle).play();mixer.update(0.25);
  loaded.scene.updateMatrixWorld(true);
  const meshes=[];
  loaded.scene.traverse(obj=>{
    if(!obj.isSkinnedMesh)return;
    obj.skeleton.update();
    const geo=obj.geometry.clone(),positions=geo.attributes.position;
    const point=new THREE.Vector3();
    for(let i=0;i<positions.count;i++){
      obj.getVertexPosition(i,point);point.applyMatrix4(obj.matrixWorld);positions.setXYZ(i,point.x,point.y,point.z);
    }
    geo.computeVertexNormals();
    const materials=(Array.isArray(obj.material)?obj.material:[obj.material]).map(m=>new THREE.MeshLambertMaterial({color:m.color,side:THREE.DoubleSide,vertexColors:!!geo.attributes.color}));
    const baked=new THREE.Mesh(geo,materials.length===1?materials[0]:materials);baked.userData.sourceMaterial=(Array.isArray(obj.material)?obj.material[0]:obj.material).name;baked.name=/_Head$|_Body$|_Legs$|_Feet$/i.test(obj.name)?obj.name:obj.parent.name;meshes.push(baked);
  });
  if(new Set(meshes.map(m=>m.name)).size!==4)throw new Error('Expected 4 interchangeable body groups');
  const scene=new THREE.Scene();meshes.forEach(m=>scene.add(m));
  const box=new THREE.Box3().setFromObject(scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  // Shared cameras within each pack preserve seams across different outfits.
  console.log(id,JSON.stringify({center:center.toArray(),size:size.toArray()}));
  const height=2.25;
  const camera=new THREE.OrthographicCamera(-height*.36,height*.36,height*.5,-height*.5,.01,100);
  camera.position.set(.4,1.05,6);camera.lookAt(0,1.05,0);camera.updateProjectionMatrix();
  scene.add(new THREE.AmbientLight(0xffffff,.55));const light=new THREE.DirectionalLight(0xffffff,.75);light.position.set(-3,5,6);scene.add(light);
  const renderer=new SVGRenderer();renderer.setSize(384,540);renderer.setPrecision(2);
  const record={id,parts:{}};
  const headMeshes=meshes.filter(m=>/_Head$/i.test(m.name));
  const hairMeshes=headMeshes.filter(m=>{
    const bounds=new THREE.Box3().setFromObject(m),name=m.userData.sourceMaterial;
    return !/^Skin|Eye|Earrings/i.test(name)&&bounds.max.y>1.75&&bounds.max.y-bounds.min.y>.07;
  });
  if(!hairMeshes.length)throw new Error('No identifiable stock hair mesh in '+id);
  const renderParts=['head','hair','top','pants','shoes'];
  // Stock exposed legs provide the ankles when long boots are exchanged for
  // low shoes. They sit behind clothing and use the original pack's geometry.
  if(id==='men-hoodie'||id==='women-formal')renderParts.unshift('legskin');
  for(const part of renderParts){
    const group=part==='legskin'?meshes.filter(m=>/_Legs$/i.test(m.name)&&/^Skin/i.test(m.userData.sourceMaterial)):part==='hair'?headMeshes:part==='head'?headMeshes.filter(m=>!hairMeshes.includes(m)&&!/^Earrings/i.test(m.userData.sourceMaterial)):meshes.filter(m=>({top:/_Body$/i,pants:/_Legs$/i,shoes:/_Feet$/i}[part]).test(m.name));
    meshes.forEach(m=>m.visible=group.includes(m));
    renderer.render(scene,camera);renderer.domElement.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const filename=id+'-'+part+'.svg';await fs.writeFile(path.join(out,filename),renderer.domElement.serialize());record.parts[part]=filename;
    if(part==='hair'){
      const originals=headMeshes.map(m=>m.material);
      headMeshes.forEach(m=>m.material=new THREE.MeshBasicMaterial({color:hairMeshes.includes(m)?0xffffff:0x000000,side:THREE.DoubleSide}));
      renderer.render(scene,camera);
      await fs.writeFile(path.join(out,id+'-hair-mask.svg'),renderer.domElement.serialize());
      headMeshes.forEach((m,i)=>{m.material.dispose();m.material=originals[i];});
    }
  }
  manifest.push(record);
  meshes.forEach(m=>{m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>mat.dispose());});mixer.uncacheRoot(loaded.scene);
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
