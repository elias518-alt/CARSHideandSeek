import * as THREE from './assets/vendor/three/three.module.js';
import {GLTFLoader} from './assets/vendor/three/GLTFLoader.js';
import {OrbitControls} from './assets/vendor/three/OrbitControls.js';
import {RoomEnvironment} from './assets/vendor/three/RoomEnvironment.js';
let assetPromise;
const poses=new Map();
export async function mount(host,car,look){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,200);
 camera.position.set(-4.8,1.6,6.8);
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','CHS Coupé 96. Zum Drehen ziehen; mit zwei Fingern zoomen.');canvas.tabIndex=0;
 host.replaceChildren(canvas);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,.8,0);controls.enablePan=false;controls.minDistance=3.8;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.3;controls.enableDamping=false;
 if(poses.has(car.id)){const p=poses.get(car.id);camera.position.fromArray(p.position);controls.target.fromArray(p.target);}controls.update();
 const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environment,.04);scene.environment=env.texture;scene.environmentIntensity=.65;environment.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xd9e8ff,0x4f4142,1.0));
 const sun=new THREE.DirectionalLight(0xffecd6,2.2);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.025;scene.add(sun);
 const rim=new THREE.DirectionalLight(0xc5ddff,1.5);rim.position.set(3,3,-4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.ShadowMaterial({color:0x03060a,opacity:.38}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);
 let disposed=false,model;const materials=new Set();let glowTexture;
 const draw=()=>{if(!disposed&&host.isConnected&&host.getBoundingClientRect().width)renderer.render(scene,camera);};
 const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();};
 const observer=new ResizeObserver(resize);observer.observe(host);
 const change=()=>{poses.set(car.id,{position:camera.position.toArray(),target:controls.target.toArray()});draw();};controls.addEventListener('change',change);
 const keys=e=>{if(!['ArrowLeft','ArrowRight','+','-'].includes(e.key))return;e.preventDefault();const offset=camera.position.clone().sub(controls.target);if(e.key.startsWith('Arrow'))offset.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?.15:-.15);else offset.multiplyScalar(e.key==='+'?.9:1.1);offset.clampLength(3.8,9);camera.position.copy(controls.target).add(offset);controls.update();};canvas.addEventListener('keydown',keys);
 const lost=e=>{e.preventDefault();host.dataset.error='true';host.insertAdjacentHTML('beforeend','<p class="vehicle3DError" role="status">3D-Grafik unterbrochen. Ansicht erneut öffnen.</p>');};canvas.addEventListener('webglcontextlost',lost);
 const restored=()=>{delete host.dataset.error;host.querySelector('.vehicle3DError')?.remove();draw();};canvas.addEventListener('webglcontextrestored',restored);
 const dispose=()=>{if(disposed)return;disposed=true;observer.disconnect();controls.dispose();canvas.removeEventListener('keydown',keys);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);materials.forEach(m=>m.dispose());env.dispose();floor.geometry.dispose();floor.material.dispose();glowTexture?.dispose();scene.traverse(o=>{if(o.userData.localGeometry)o.geometry.dispose();});renderer.dispose();renderer.forceContextLoss();};
 host.dispose3D=dispose;host.get3DState=()=>({parts:model?Object.fromEntries(model.children.filter(o=>/^package_/.test(o.name)).map(o=>{let count=0;o.traverseVisible(n=>{if(n.isMesh)count++;});return [o.name,count];})): {},bodyFloor:model?.getObjectByName('coachwork')?new THREE.Box3().setFromObject(model.getObjectByName('coachwork')).min.y:null,ground:model?.getObjectByName('rolling_gear')?new THREE.Box3().setFromObject(model.getObjectByName('rolling_gear')).min.y:null,disposed,visible:model?model.children.filter(o=>o.visible).map(o=>o.name):[],camera:camera.position.toArray(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
 try{
  assetPromise ||= new GLTFLoader().loadAsync(new URL('./assets/vehicles/3d/chs-coupe-96.glb?v=20261029-detail-4',import.meta.url).href).catch(e=>{assetPromise=null;throw e;});
  const asset=await assetPromise;if(disposed)return;
  model=asset.scene.clone(true);
  const drop={stock:0,clean:.02,sport:.04,track:.055}[look.package]||0;
  model.traverse(o=>{
   if(o.name==='coachwork'||/^package_(stock|clean|sport|track)$/.test(o.name))o.position.y-=drop;
   if(/^rims_(stock|silver|graphite|mesh)$/.test(o.name))o.visible=o.name==='rims_'+look.rims;
   if(/^package_(stock|clean|sport|track)$/.test(o.name))o.visible=o.name==='package_'+look.package;
   if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
   const clone=m=>{const c=m.clone();materials.add(c);if(c.name==='paint')c.color.set(window.vehicleStudio.color(car.paintColor||car.color));if(c.name==='glass')c.side=THREE.DoubleSide;return c;};
   o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
  });scene.add(model);
  const colors={cyan:'#36d8ff',amber:'#ffb23c',pink:'#ff51b5',violet:'#a889ff',green:'#8be747',red:'#ff514c',white:'#eaf7ff'};
  if(colors[look.glow]){
   const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,5,64,64,64);g.addColorStop(0,colors[look.glow]);g.addColorStop(.5,colors[look.glow]+'99');g.addColorStop(1,colors[look.glow]+'00');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);glowTexture=new THREE.CanvasTexture(c);
   const material=new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,depthWrite:false,opacity:.8});materials.add(material);
   const light=new THREE.Mesh(new THREE.PlaneGeometry(5.1,2.6),material);light.rotation.x=-Math.PI/2;light.position.y=.003;light.userData.localGeometry=true;scene.add(light);
  }
  host.dataset.ready='true';host.dataset.model='chs-coupe-96';resize();
 }catch(e){dispose();throw e;}
 return dispose;
}
