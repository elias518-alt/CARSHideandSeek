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
 const mounts={
  E36_COUPE:[[783,690,76,116],[1390,622,40,94]],
  E21:[[283,286,19,32],[470,264,12,25]],E30:[[782,288,18,30],[973,266,12,25]],E36:[[1295,291,17,31],[1482,265,11,25]],
  E46:[[284,588,18,33],[473,572,13,28]],E90:[[789,590,19,34],[984,571,13,27]],F30:[[1301,593,17,32],[1491,572,12,27]],
  G20:[[297,900,18,34],[481,880,12,29]],F87:[[803,903,19,35],[994,879,13,28]],G87:[[1322,907,18,34],[1499,885,11,28]],
  F22:[[196,566,17,29],[353,552,11,23]],G42:[[588,565,17,30],[735,550,11,23]]
 };
 function supports(car){const studio=typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio;const selected=studio?.select(car);return !!selected&&['bmw3','m2','bmw2'].includes(selected.family)&&!!mounts[selected.wheelKey||selected.code];}
 function supported(input,car){const v=normalize(input);if(!supports(car)){v.rims='stock';v.package='stock';}return v;}
 function overlay(code,crop,input){
  const v=normalize(input),points=mounts[code];if(!points)return '';
  const [x,y]=crop,wheels=points.map(([cx,cy,rx,ry])=>[cx-x,cy-y,rx,ry]);
  let html='';
  if(v.package!=='stock'){
   const [front,rear]=wheels,thickness=Math.min(front[3],rear[3])*(v.package==='clean'?.065:v.package==='track'?.13:.10);
   const ax=front[0]+front[2]*.9,ay=front[1]+front[3]*.55,bx=rear[0]-rear[2]*.9,by=rear[1]+rear[3]*.65;
   html+='<path d="M'+ax+' '+ay+' L'+bx+' '+by+' L'+bx+' '+(by+thickness*.65)+' L'+ax+' '+(ay+thickness)+'Z" fill="#303640" stroke="#151b23" stroke-width=".6"/><path d="M'+ax+' '+ay+' L'+bx+' '+by+'" fill="none" stroke="#858b93" stroke-opacity=".55" stroke-width=".65"/>';
  }
  if(v.rims!=='stock')html+=wheels.map(([cx,cy,rx,ry],index)=>{
   const id='fitted-rim-'+(++wheelSerial),source=v.rims==='mesh'?[283,287,18,32]:[783,690,76,116];
   const file=v.rims==='mesh'?'bmw-3':'bmw-e36-coupe';
   const [sx,sy,sw,sh]=source,shade=v.rims==='graphite'?.52:1;
   // Use photographed metal/spokes, fitted to the complete rim face; tyre and body stay untouched.
   return `<g data-fitted-rim="${v.rims}" transform="translate(${cx} ${cy}) rotate(${v.rims==='mesh'?(index?5:8):0})"><g transform="scale(${rx} ${ry})"><defs><clipPath id="${id}-face"><circle r="1"/></clipPath><filter id="${id}-finish" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${shade} 0 0 0 0 0 ${shade} 0 0 0 0 0 ${shade} 0 0 0 0 0 1 0"/></filter><radialGradient id="${id}-shade" cx=".35" cy=".25" r=".95"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient></defs><g clip-path="url(#${id}-face)"><svg x="-1" y="-1" width="2" height="2" viewBox="${sx-sw} ${sy-sh} ${sw*2} ${sh*2}" preserveAspectRatio="none"><image href="assets/vehicles/${file}.webp" width="1536" height="1024" filter="url(#${id}-finish)"/></svg><circle r="1" fill="url(#${id}-shade)"/></g></g></g>`;
  }).join('');
  return html;
 }
 const glowColors={cyan:'#36d8ff',amber:'#ffb23c',pink:'#ff51b5',violet:'#a889ff',green:'#8be747',red:'#ff514c',white:'#eaf7ff'};
 function groundLight(code,crop,input,id){
  const color=glowColors[normalize(input).glow];if(!color)return '';
  const [x,y,w,h]=crop,points=mounts[code];
  const a=points?[points[0][0]-x,points[0][1]-y+points[0][3]*.94]:[w*.24,h*.92];
  const b=points?[points[1][0]-x,points[1][1]-y+points[1][3]*.94]:[w*.79,h*.88];
  const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.hypot(b[0]-a[0],b[1]-a[1])*.62,angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
  return `<defs><radialGradient id="${id}-ground"><stop stop-color="${color}" stop-opacity=".68"/><stop offset=".45" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><ellipse data-ground-light="true" cx="${cx}" cy="${cy}" rx="${rx}" ry="${Math.max(3,h*.048)}" transform="rotate(${angle} ${cx} ${cy})" fill="url(#${id}-ground)"/>`;
 }
 function preview(key,value){
  if(key==='rims'){
   const id='rim-preview-'+(++wheelSerial),mesh=value==='mesh',source=mesh?[265,255,36,64]:[707,574,152,232];
   const shade=value==='graphite'?.52:1;
   return `<svg viewBox="0 0 100 72" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="34" r="28"/></clipPath><filter id="${id}-finish" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="${shade}"/><feFuncG type="linear" slope="${shade}"/><feFuncB type="linear" slope="${shade}"/></feComponentTransfer></filter></defs><ellipse cx="50" cy="66" rx="28" ry="3" fill="#0005"/><circle cx="50" cy="34" r="30" fill="#111923" stroke="#607184"/><g clip-path="url(#${id})"><svg x="22" y="6" width="56" height="56" viewBox="${source.join(' ')}" preserveAspectRatio="none"><image href="assets/vehicles/${mesh?'bmw-3':'bmw-e36-coupe'}.webp" width="1536" height="1024" filter="url(#${id}-finish)"/></svg></g></svg>`;

  }
  const glow=glowColors[value],depth=value==='track'?5:value==='sport'?3:1;
  return `<svg viewBox="0 0 120 72" aria-hidden="true">${key==='glow'&&glow?`<ellipse cx="60" cy="55" rx="45" ry="7" fill="${glow}" opacity=".15"/><ellipse cx="60" cy="52" rx="32" ry="3" fill="${glow}" opacity=".65"/>`:''}<path d="M12 40L21 34L37 32L48 21H75L90 32L105 35L109 46H12Z" fill="#7791a7" stroke="#b9cedf"/><path d="M42 32L51 24H72L84 32Z" fill="#132536"/><circle cx="30" cy="46" r="9" fill="#0b121c" stroke="#899bad"/><circle cx="91" cy="46" r="9" fill="#0b121c" stroke="#899bad"/>${key==='package'&&value!=='stock'?`<path d="M40 44H80L78 ${46+depth}H42Z" fill="#d1dfeb" stroke="#40566b"/>`:''}</svg>`;
 }
 function anchors(car){const selected=(typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio)?.select(car);return supports(car)?mounts[selected.wheelKey||selected.code].map(([x,y,rx,ry],index)=>({axle:index?'rear':'front',x,y,width:rx*2,height:ry*2,rotation:0,perspective:rx/ry,mask:'ellipse'})):null;}
 const api={anchors,mounts,catalog,normalize,restrict,supports,supported,overlay,defaults,groundLight,preview};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleRewards=api;
})(typeof window==='undefined'?globalThis:window);
