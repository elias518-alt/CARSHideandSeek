/* Self-hosted face landmarks. No descriptors, identity matching or image uploads. */
(function(root){
 'use strict';let engine;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function proportions(points){
  if(!Array.isArray(points)||points.length!==68||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Gesichtsmerkmale konnten nicht gelesen werden.');
  const dist=(a,b)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y),width=dist(0,16);if(width<10)throw Error('Bitte ein größeres frontales Gesichtsfoto verwenden.');
  const brow=(points[19].y+points[24].y)/2,faceHeight=(points[8].y-brow)*1.35,aspect=faceHeight/width,jaw=dist(4,12)/width;
  return {shape:aspect>1.48?3:aspect<1.16?1:jaw>.72?2:0,eyeSpacing:clamp(dist(39,42)/width/.23,.85,1.15),eyeSize:clamp((dist(36,39)+dist(42,45))/2/width/.19,.8,1.2),nose:clamp(dist(31,35)/width/.24,.8,1.2),mouth:clamp(dist(48,54)/width/.4,.8,1.2)};
 }
 function nearest(rgb,palette){let best=0,score=Infinity;palette.forEach((hex,i)=>{const distance=[1,3,5].reduce((sum,pos,j)=>sum+(parseInt(hex.slice(pos,pos+2),16)-rgb[j])**2,0);if(distance<score){score=distance;best=i;}});return best;}
 function sample(ctx,x,y,radius=4){const c=ctx.canvas,l=Math.max(0,Math.round(x-radius)),t=Math.max(0,Math.round(y-radius)),w=Math.min(radius*2+1,c.width-l),h=Math.min(radius*2+1,c.height-t);if(w<1||h<1)return null;const data=ctx.getImageData(l,t,w,h).data,channels=[[],[],[]];for(let i=0;i<data.length;i+=4)if(data[i+3]>200)for(let k=0;k<3;k++)channels[k].push(data[i+k]);return channels[0].length?channels.map(values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]):null;}
 async function loadEngine(){
  if(!engine)engine=(async()=>{
   if(!root.faceapi)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/vendor/face-api/face-api-1.7.15.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Die lokale Gesichtserkennung konnte nicht geladen werden. Bitte erneut versuchen oder den Avatar manuell gestalten.'));};document.head.append(script);});
   const api=root.faceapi;await api.tf.setBackend('cpu');await api.tf.ready();
   await Promise.all([api.nets.tinyFaceDetector.loadFromUri('assets/vendor/face-api/models'),api.nets.faceLandmark68TinyNet.loadFromUri('assets/vendor/face-api/models')]);return api;
  })().catch(error=>{engine=null;throw error;});return engine;
 }
 async function analyze(canvas,current,gender){
  const api=await loadEngine(),results=await api.detectAllFaces(canvas,new api.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.45})).withFaceLandmarks(true);
  if(results.length!==1)throw Error(results.length?'Bitte ein Foto wählen, auf dem nur dein Gesicht zu sehen ist.':'Kein klares Gesicht gefunden. Bitte ein helles, frontales Foto ohne Sonnenbrille wählen.');
  const result=results[0],p=result.landmarks.positions,ctx=canvas.getContext('2d',{willReadFrequently:true}),b=result.detection.box;
  const color=sample(ctx,(p[2].x+p[31].x)/2,(p[2].y+p[31].y)/2,5),hair=sample(ctx,b.x+b.width*.5,b.y-b.height*.08,5);
  const traits={...root.characterAvatar.traits(current,gender),...proportions(p)};
  if(color)traits.skin=nearest(color,root.characterAvatar.palettes.skin);
  if(hair&&color&&Math.hypot(...hair.map((v,i)=>v-color[i]))>45)traits.hairColor=nearest(hair,root.characterAvatar.palettes.hair);
  return root.characterAvatar.traits(traits,gender);
 }
 const api={proportions,nearest,analyze};if(typeof module==='object'&&module.exports)module.exports=api;else root.selfieAvatar=api;
})(typeof globalThis==='object'?globalThis:this);
