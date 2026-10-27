'use strict';
(function(root){
 let wheelSerial=0;
 const catalog={
  rims:[{id:'stock',label:'Originalfelgen',level:1},{id:'silver',label:'Velocity · Silber',level:2},{id:'graphite',label:'Velocity · Graphit',level:8},{id:'mesh',label:'Crossline · Schmiedelook',level:12}],
  package:[{id:'stock',label:'Serienpaket',level:1},{id:'sport',label:'Street Sport · Schweller',level:5},{id:'clean',label:'Clean · dezente Schweller',level:10},{id:'track',label:'Track · markante Schweller',level:15}],
  glow:[{id:'off',label:'Aus',level:1},{id:'cyan',label:'Ice Blue',level:3},{id:'amber',label:'Amber',level:3},{id:'pink',label:'Neon Pink',level:3},{id:'violet',label:'Violett',level:3},{id:'green',label:'Lime Green',level:3},{id:'red',label:'Rot',level:3},{id:'white',label:'Ice White',level:3}]
 };
 const defaults={rims:'stock',package:'stock',glow:'off'};
 function normalize(input={}){return Object.fromEntries(Object.entries(catalog).map(([key,items])=>[key,items.some(item=>item.id===input?.[key])?input[key]:defaults[key]]));}
 function restrict(input,level=1){const result=normalize(input);for(const key of Object.keys(catalog))if(catalog[key].find(item=>item.id===result[key]).level>level)result[key]=defaults[key];return result;}
 // Measured wheel centres and radii in the original BMW 3/M2 atlas.
 // Other generations keep their original geometry until calibrated assets exist.
 // [centre x, centre y, face radius x, face radius y, angle] in atlas pixels.
 // Measure the complete metal face, excluding the tyre. Angle belongs to the car, not the style.
 const mounts={
  E36_COUPE:[[787,693,77,119,4],[1389,624,44,98,4]],
  E21:[[285,288,21,36,6],[471,265,13,29,5]],E30:[[785,288,20,35,5],[974,269,13,31,4]],E36:[[1297,291,21,39,6],[1486,271,14,32,4]],
  E46:[[285,595,21,40,7],[476,573,15,33,5]],E90:[[790,598,21,40,7],[986,572,15,32,5]],F30:[[1304,595,21,40,5],[1494,573,14,34,4]],
  G20:[[300,901,21,43,6],[484,880,15,36,5]],F87:[[807,904,22,43,6],[996,882,16,35,5]],G87:[[1331,904,22,43,6],[1502,880,15,39,4]],
  F22:[[198,570,18,29,6],[355,553,12,25,5]],G42:[[589,567,18,30,5],[736,551,12,24,4]]
 };
 // Ground just under each front bumper; independent of the visible side's wheel line.
 const frontLights={E36_COUPE:[350,786,340,27,2],E21:[134,315,124,10,4],E30:[643,317,115,9,4],E36:[1148,321,120,10,2.5],E46:[135,634,120,10,3],E90:[645,636,117,10,2.5],F30:[1157,638,122,10,2.5],G20:[143,943,128,11,2],F87:[654,944,125,11,2.5],G87:[1168,946,130,11,2],F22:[90,594,82,8,2],G42:[480,597,88,8,2]};
 const partDescriptions={stock:'Originaler Seitenschweller',clean:'Schmale, dezente Abschlusskante',sport:'Breite Kante mit Metallakzent',track:'Tiefer Ansatz mit seitlichen Finnen'};
 function rimFace(value,id){
  const dark=value==='graphite',mesh=value==='mesh';
  const stops=dark?['#b7bec6','#59636e','#242c36','#8f99a5']:['#f2f4f5','#a6afb8','#535e68','#dce1e4'];
  const spoke=mesh?'M-7 -18L-22 -88L-15 -91L2 -33L17 -91L24 -87L8 -18Z':'M-13 -19L-24 -86L-14 -93L-2 -36L5 -92L16 -88L12 -19Z';
  const count=mesh?10:5;
  return `<defs><linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1">${stops.map((c,i)=>`<stop offset="${i/3}" stop-color="${c}"/>`).join('')}</linearGradient><radialGradient id="${id}-dish"><stop stop-color="#333d47"/><stop offset=".68" stop-color="#151d25"/><stop offset="1" stop-color="#060a0e"/></radialGradient><radialGradient id="${id}-disc"><stop offset=".2" stop-color="#30363d"/><stop offset=".5" stop-color="#656b70"/><stop offset="1" stop-color="#343a40"/></radialGradient></defs><circle r="100" fill="#171d23"/><circle r="97" fill="url(#${id}-metal)"/><circle r="90" fill="url(#${id}-dish)"/><circle r="72" fill="url(#${id}-disc)"/><circle r="63" fill="none" stroke="#a2a6a9" stroke-opacity=".22" stroke-width="1.5"/>${Array.from({length:18},(_,i)=>`<circle cx="0" cy="-60" r="2" fill="#20272d" transform="rotate(${i*20})"/>`).join('')}<path d="M51 -43Q78 -30 76 -5L64 20L49 16Z" fill="#3c4248" stroke="#737c84" stroke-width="2"/>${Array.from({length:count},(_,i)=>`<g transform="rotate(${i*360/count})"><path d="${spoke}" fill="#090e14" transform="translate(2 3)"/><path d="${spoke}" fill="url(#${id}-metal)" stroke="${dark?'#939da8':'#d9dfe3'}" stroke-width=".8"/><path d="M-12 -23L-20 -84" stroke="#fff" stroke-opacity=".25" stroke-width="1.4"/></g>`).join('')}<circle r="23" fill="url(#${id}-metal)" stroke="#3a444e" stroke-width="2"/>${Array.from({length:5},(_,i)=>`<circle cx="0" cy="-16" r="3.3" fill="#141d26" stroke="#8c969f" stroke-width="1" transform="rotate(${i*72})"/>`).join('')}<circle r="10" fill="#333e49" stroke="#b0bac3" stroke-width="2"/><circle r="94" fill="none" stroke="#eef4f7" stroke-opacity="${dark?'.2':'.5'}" stroke-width="1.5"/><path d="M-83 -40A92 92 0 0 1 40 -83" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="2"/>`;
 }
 function supports(car){const studio=typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio;const selected=studio?.select(car);return !!selected&&['bmw3','m2','bmw2'].includes(selected.family)&&!!mounts[selected.wheelKey||selected.code];}
 function supported(input,car){const v=normalize(input);if(!supports(car)){v.rims='stock';v.package='stock';}return v;}
 function sill(wheels,value){
  const [front,rear]=wheels,depth=Math.min(front[3],rear[3])*(value==='clean'?.06:value==='track'?.18:.12);
  const ax=front[0]+front[2]*1.05,ay=front[1]+front[3]*.55,bx=rear[0]-rear[2]*1.05,by=rear[1]+rear[3]*.52;
  const fill=value==='clean'?'#343b44':value==='track'?'#141a21':'#3e4854';
  return `<g data-fitted-package="${value}"><path d="M${ax} ${ay}L${bx} ${by}L${bx+depth*.7} ${by+depth*.65}L${ax-depth*.5} ${ay+depth}Z" fill="${fill}" stroke="#10171e" stroke-width=".6"/><path d="M${ax} ${ay}L${bx} ${by}" stroke="${value==='sport'?'#a4b0bc':'#697682'}" stroke-width="${Math.max(.6,depth*.22)}"/>${value==='track'?`<path d="M${ax} ${ay}l${depth*1.8} ${-depth*.7}v${depth*1.5}l${-depth*2.3} ${depth*.2}ZM${bx} ${by}l${-depth*1.8} ${-depth*.7}v${depth*1.3}l${depth*2.5} 0Z" fill="#242e3a"/>`:''}</g>`;
 }
 function overlay(code,crop,input){
  const v=normalize(input),points=mounts[code];if(!points)return '';
  const [x,y]=crop,wheels=points.map(([cx,cy,rx,ry,angle])=>[cx-x,cy-y,rx,ry,angle]);
  let html=v.package==='stock'?'':sill(wheels,v.package);
  if(v.rims!=='stock')html+=wheels.map(([cx,cy,rx,ry,angle])=>{
   const id='fitted-rim-'+(++wheelSerial);
   return `<g data-fitted-rim="${v.rims}" transform="translate(${cx} ${cy}) rotate(${angle})"><g transform="scale(${rx/100} ${ry/100})">${rimFace(v.rims,id)}</g></g>`;
  }).join('');
  return html;
 }
 const glowColors={cyan:'#36d8ff',amber:'#ffb23c',pink:'#ff51b5',violet:'#a889ff',green:'#8be747',red:'#ff514c',white:'#eaf7ff'};
 function groundLight(code,crop,input,id){
  const color=glowColors[normalize(input).glow];if(!color)return '';
  const [x,y,w,h]=crop,points=mounts[code];
  const a=points?[points[0][0]-x,points[0][1]-y+points[0][3]*1.12]:[w*.24,h*.92];
  const b=points?[points[1][0]-x,points[1][1]-y+points[1][3]*1.12]:[w*.79,h*.88];
  const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.hypot(b[0]-a[0],b[1]-a[1])*.62,angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
  const front=frontLights[code]||[x+w*.25,y+h*.94,w*.24,h*.04,2];
  const [fx,fy,frx,fry,fa]=front;
  return `<defs><radialGradient id="${id}-ground"><stop stop-color="${color}" stop-opacity=".68"/><stop offset=".45" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><ellipse data-ground-light="true" cx="${cx}" cy="${cy}" rx="${rx}" ry="${Math.max(3,h*.048)}" transform="rotate(${angle} ${cx} ${cy})" fill="url(#${id}-ground)"/><ellipse data-front-ground-light="true" cx="${fx-x}" cy="${fy-y}" rx="${frx}" ry="${fry}" transform="rotate(${fa} ${fx-x} ${fy-y})" fill="url(#${id}-ground)"/>`;
 }
 function preview(key,value,car){
  const studio=typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio;
  const selected=car&&studio?.select(car),points=selected&&mounts[selected.wheelKey||selected.code];
  if(key==='package'&&points){
   // Use the actual selected vehicle and the same fitted part as the main scene, enlarged at its sill.
   const html=studio.render({...car,cosmetics:{...car.cosmetics,package:value,glow:'off'}});
   const firstImage=html.match(/<image[^>]+x="([^"]+)" y="([^"]+)"/);
   if(firstImage){const x=Number(firstImage[1]),y=Number(firstImage[2]),[a,b]=points;
    const left=a[0]+a[2]*.8+x,right=b[0]-b[2]*.8+x,top=b[1]+y-10,height=Math.max(a[3]*1.5,a[1]+a[3]-b[1]+20);
    return html.replace(/viewBox="[^"]+"/,`viewBox="${left} ${top} ${right-left} ${height}"`).replace('role="img"','data-part-detail="sill" role="img"');
   }
  }
  if(key==='rims'){
   if(value==='stock'&&!points&&car)return studio?.render({...car,cosmetics:defaults})||'';
   if(value==='stock'&&points){
    const html=studio.render({...car,cosmetics:defaults}),image=html.match(/<image[^>]+x="([^"]+)" y="([^"]+)"/);
    if(image){const [cx,cy,rx,ry]=points[0],x=Number(image[1]),y=Number(image[2]);return html.replace(/viewBox="[^"]+"/,`viewBox="${cx+x-rx*1.2} ${cy+y-ry*1.2} ${rx*2.4} ${ry*2.4}"`);}
   }
   const id='rim-preview-'+(++wheelSerial);
   return `<svg viewBox="-115 -110 230 230" aria-hidden="true"><ellipse cy="109" rx="87" ry="7" fill="#0005"/>${rimFace(value,id)}</svg>`;
  }
  const glow=glowColors[value];
  return `<svg viewBox="0 0 120 72" aria-hidden="true">${glow?`<ellipse cx="60" cy="55" rx="45" ry="7" fill="${glow}" opacity=".15"/><ellipse cx="60" cy="52" rx="32" ry="3" fill="${glow}" opacity=".65"/>`:''}<path d="M12 40L21 34L37 32L48 21H75L90 32L105 35L109 46H12Z" fill="#7791a7" stroke="#b9cedf"/><path d="M42 32L51 24H72L84 32Z" fill="#132536"/><circle cx="30" cy="46" r="9" fill="#0b121c" stroke="#899bad"/><circle cx="91" cy="46" r="9" fill="#0b121c" stroke="#899bad"/></svg>`;
 }
 function anchors(car){const selected=(typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio)?.select(car);return supports(car)?mounts[selected.wheelKey||selected.code].map(([x,y,rx,ry,rotation],index)=>({axle:index?'rear':'front',x,y,width:rx*2,height:ry*2,rotation,perspective:rx/ry,mask:'ellipse'})):null;}
 const api={anchors,mounts,catalog,normalize,restrict,supports,supported,overlay,defaults,groundLight,preview,partDescriptions};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleRewards=api;
})(typeof window==='undefined'?globalThis:window);
