'use strict';
(function(root){
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
  const paint=v.rims==='graphite'?'#687482':'#c7d2de';
  let html='';
  if(v.package!=='stock'){
   const [front,rear]=wheels,thickness=Math.min(front[3],rear[3])*(v.package==='clean'?.065:v.package==='track'?.13:.10);
   const ax=front[0]+front[2]*.9,ay=front[1]+front[3]*.55,bx=rear[0]-rear[2]*.9,by=rear[1]+rear[3]*.65;
   html+='<path d="M'+ax+' '+ay+' L'+bx+' '+by+' L'+bx+' '+(by+thickness*.65)+' L'+ax+' '+(ay+thickness)+'Z" fill="#303640" stroke="#151b23" stroke-width=".6"/><path d="M'+ax+' '+ay+' L'+bx+' '+by+'" fill="none" stroke="#858b93" stroke-opacity=".55" stroke-width=".65"/>';
  }
  if(v.rims!=='stock')html+=wheels.map(([cx,cy,rx,ry])=>'<g transform="translate('+cx+' '+cy+') scale('+rx+' '+ry+')"><g transform="scale(.78)"><ellipse rx="1" ry="1" fill="#20262d" stroke="#12161b" stroke-width=".10"/><circle r=".87" fill="#535b65"/><circle r=".77" fill="#101820"/><circle r=".63" fill="#58616a"/><circle r=".53" fill="none" stroke="#242d36" stroke-width=".035" stroke-dasharray=".045 .09"/><path d="M.41-.4Q.68-.3.66.12L.46.23Z" fill="#353f48" stroke="#86919a" stroke-width=".025"/><ellipse rx=".94" ry=".94" fill="none" stroke="'+paint+'" stroke-width=".045"/>'+Array.from({length:v.rims==='mesh'?16:10},(_,i)=>'<path d="M-.07-.86 L.07-.86 L.045-.17 L-.045-.17Z" fill="'+paint+'" transform="rotate('+i*(v.rims==='mesh'?22.5:36)+')"/>').join('')+'<path d="M-.7-.55A.89.89 0 0 1 .5-.74" fill="none" stroke="#ffffff" stroke-opacity=".65" stroke-width=".035"/><circle r=".19" fill="'+paint+'"/><circle r=".07" fill="#1d242d"/></g></g>').join('');
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
   const paint=value==='graphite'?'#8995a5':'#dce7f0',count=value==='mesh'?16:value==='stock'?5:10;
   return `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="67" rx="27" ry="3" fill="#0006"/><g transform="translate(50 34)"><circle r="30" fill="#0a1018" stroke="#44505e" stroke-width="2"/><circle r="25" fill="#24313f" stroke="${paint}" stroke-width="2"/><circle r="20" fill="#121c28"/>${Array.from({length:count},(_,i)=>`<path d="M-2-23L3-23L2-6L-2-6Z" fill="${paint}" transform="rotate(${i*360/count})"/>`).join('')}<circle r="7" fill="${paint}"/><circle r="3" fill="#283848"/></g></svg>`;
  }
  const glow=glowColors[value],depth=value==='track'?5:value==='sport'?3:1;
  return `<svg viewBox="0 0 120 72" aria-hidden="true">${key==='glow'&&glow?`<ellipse cx="60" cy="55" rx="45" ry="7" fill="${glow}" opacity=".15"/><ellipse cx="60" cy="52" rx="32" ry="3" fill="${glow}" opacity=".65"/>`:''}<path d="M12 40L21 34L37 32L48 21H75L90 32L105 35L109 46H12Z" fill="#7791a7" stroke="#b9cedf"/><path d="M42 32L51 24H72L84 32Z" fill="#132536"/><circle cx="30" cy="46" r="9" fill="#0b121c" stroke="#899bad"/><circle cx="91" cy="46" r="9" fill="#0b121c" stroke="#899bad"/>${key==='package'&&value!=='stock'?`<path d="M40 44H80L78 ${46+depth}H42Z" fill="#d1dfeb" stroke="#40566b"/>`:''}</svg>`;
 }
 function anchors(car){const selected=(typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio)?.select(car);return supports(car)?mounts[selected.wheelKey||selected.code].map(([x,y,rx,ry],index)=>({axle:index?'rear':'front',x,y,width:rx*2,height:ry*2,rotation:0,perspective:rx/ry,mask:'ellipse'})):null;}
 const api={anchors,mounts,catalog,normalize,restrict,supports,supported,overlay,defaults,groundLight,preview};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleRewards=api;
})(typeof window==='undefined'?globalThis:window);
