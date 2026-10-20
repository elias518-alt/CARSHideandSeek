/* Fit the visible vehicle, not transparent image margins, to the parking plane. */
(function(root){
 'use strict';
 const cache=new Map();
 function alphaBounds(data,width,height){
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)return {x:0,y:0,w:1,h:1};
  // One sample of padding preserves antialiased edges, without a floating lower margin.
  left=Math.max(0,left-1);top=Math.max(0,top-1);right=Math.min(width-1,right+1);bottom=Math.min(height-1,bottom+1);
  return {x:left/width,y:top/height,w:(right-left+1)/width,h:(bottom-top+1)/height};
 }
 function composition(width,ratio,profile=false){
  ratio=Number.isFinite(ratio)&&ratio>0?ratio:2;
  const desired=Math.min(width*(profile ? .94 : .86),profile?680:720),limit=profile?Math.min(380,width*.85):Math.min(420,width*.9);
  const carWidth=Math.min(desired,limit*ratio)*(profile?1:.9),carHeight=carWidth/ratio;
  const personHeight=Math.min(carWidth*.9,carHeight*1.08);
  return {carWidth,carHeight,personHeight,center:profile?width/2:width*.45,personLeft:Math.min(width-personHeight*.21,width*.45+carWidth*.46),ground:profile?0:24,personDepth:carHeight*.06};
 }
 function measure(source){
  if(cache.has(source))return cache.get(source);
  const pending=new Promise(resolve=>{
   const img=new Image();let timer;
   const finish=value=>{clearTimeout(timer);img.onload=img.onerror=null;resolve(value);};
   img.crossOrigin='anonymous';img.onload=()=>{
    const width=img.naturalWidth,height=img.naturalHeight;let bounds={x:0,y:0,w:1,h:1};
    try{const factor=Math.min(1,512/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*factor));canvas.height=Math.max(1,Math.round(height*factor));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);bounds=alphaBounds(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);}catch{/* A readable image remains usable when its pixels are not CORS-accessible. */}
    finish({width,height,...bounds});
   };
   img.onerror=()=>{if(img.crossOrigin){img.removeAttribute('crossorigin');img.src=source;}else finish(null);};
   timer=setTimeout(()=>finish(null),10000);img.src=source;
  });
  cache.set(source,pending);if(cache.size>32)cache.delete(cache.keys().next().value);return pending;
 }
 function set(el,key,value){const next=Number(value.toFixed(2))+'px';if(el.style.getPropertyValue(key)!==next)el.style.setProperty(key,next);}
 function fit(host,profile){
  if(!host)return;const figure=host.querySelector('.vehicleIllustration'),svg=figure?.querySelector('svg');if(!svg)return;
  const box=svg.viewBox.baseVal;if(!box.width||!box.height)return;
  const width=host.clientWidth;if(!width)return;
  const layout=composition(width,box.width/box.height,profile);
  if(!profile&&host.querySelector('.wardrobeAvatar'))layout.personLeft=Math.min(layout.personLeft,width-layout.personHeight*.265);
  if(!profile&&!host.querySelector('.wardrobeStudio'))layout.personLeft=Math.min(layout.personLeft,width-layout.personHeight/3);
  for(const [key,value]of Object.entries(layout))set(host,'--showroom-'+key,value);
  if(!profile)set(host.closest('.homeStage'),'--showroom-height',Math.max(width<600?330:400,Math.max(layout.carHeight,layout.personHeight+layout.personDepth)+layout.ground+(width<600?100:112)));
  else set(host,'--showroom-height',layout.carHeight);
  host.dataset.showroomReady='true';
 }
 let scheduled=false;
 function refresh(){
  if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{
   scheduled=false;
   for(const [id,profile] of [['homeOwnScene',false],['profileVehicleStage',true],['garage',null]]){
    const host=document.getElementById(id);if(!host)continue;
    for(const svg of host.querySelectorAll('[data-showroom-photo]')){
     if(svg.dataset.measuring)continue;svg.dataset.measuring='true';const source=svg.querySelector('image').getAttribute('href');
     void measure(source).then(bounds=>{
      if(!svg.isConnected||svg.querySelector('image')?.getAttribute('href')!==source)return;
      if(bounds){const {width,height,x,y,w,h}=bounds;svg.setAttribute('viewBox',[x*width,y*height,w*width,h*height].join(' '));const img=svg.querySelector('image');img.setAttribute('width',width);img.setAttribute('height',height);svg.dataset.photoFit='ready';}else svg.dataset.photoFit='unavailable';
      if(profile!==null)fit(host,profile);
     });
    }
    if(profile!==null)fit(host,profile);
   }
  });
 }
 function setup(){
  const observer=new MutationObserver(refresh),resize=new ResizeObserver(refresh);
  for(const id of ['homeOwnScene','profileVehicleStage','garage']){const el=document.getElementById(id);if(el){observer.observe(el,{childList:true,subtree:true});resize.observe(el);}}
  refresh();
 }
 const api={alphaBounds,composition,refresh};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.showroom=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();}
})(typeof globalThis==='object'?globalThis:this);
