'use strict';
(function(root){
 const catalog={
  rims:[{id:'stock',label:'Originalfelgen',level:1},{id:'silver',label:'Velocity · Silber',level:2},{id:'graphite',label:'Velocity · Graphit',level:8}],
  package:[{id:'stock',label:'Serienpaket',level:1},{id:'sport',label:'Street Sport',level:5}],
  glow:[{id:'off',label:'Aus',level:1},{id:'cyan',label:'Ice Blue',level:3},{id:'amber',label:'Amber',level:3}]
 };
 const defaults={rims:'stock',package:'stock',glow:'off'};
 function normalize(input={}){return Object.fromEntries(Object.entries(catalog).map(([key,items])=>[key,items.some(item=>item.id===input?.[key])?input[key]:defaults[key]]));}
 function restrict(input,level=1){const result=normalize(input);for(const key of Object.keys(catalog))if(catalog[key].find(item=>item.id===result[key]).level>level)result[key]=defaults[key];return result;}
 // Measured wheel centres and radii in the original BMW 3/M2 atlas.
 // Other generations keep their original geometry until calibrated assets exist.
 const mounts={
  E21:[[283,286,19,32],[470,264,12,25]],E30:[[782,288,18,30],[973,266,12,25]],E36:[[1295,291,17,31],[1482,265,11,25]],
  E46:[[284,588,18,33],[473,572,13,28]],E90:[[789,590,19,34],[984,571,13,27]],F30:[[1301,593,17,32],[1491,572,12,27]],
  G20:[[297,900,18,34],[481,880,12,29]],F87:[[803,903,19,35],[994,879,13,28]],G87:[[1322,907,18,34],[1499,885,11,28]]
 };
 function supports(car){const studio=typeof module!=='undefined'&&module.exports?require('./vehicle-studio'):root.vehicleStudio;const selected=studio?.select(car);return !!selected&&['bmw3','m2'].includes(selected.family)&&!!mounts[selected.code];}
 function supported(input,car){const v=normalize(input);if(!supports(car)){v.rims='stock';v.package='stock';}return v;}
 function overlay(code,crop,input){
  const v=normalize(input),points=mounts[code];if(!points)return '';
  const [x,y]=crop,wheels=points.map(([cx,cy,rx,ry])=>[cx-x,cy-y,rx,ry]);
  const paint=v.rims==='graphite'?'#687482':'#c7d2de';
  let html='';
  if(v.package==='sport'){
   const [front,rear]=wheels;
   html+='<path d="M'+(front[0]+front[2]+8)+' '+(front[1]+front[3]*.55)+' L'+(rear[0]-rear[2]-5)+' '+(rear[1]+rear[3]*.65)+'" fill="none" stroke="#1b2027" stroke-width="7" stroke-linecap="round"/>';
  }
  if(v.rims!=='stock')html+=wheels.map(([cx,cy,rx,ry])=>'<g transform="translate('+cx+' '+cy+') scale('+rx+' '+ry+')"><ellipse rx="1" ry="1" fill="#11171e" stroke="'+paint+'" stroke-width=".11"/>'+Array.from({length:10},(_,i)=>'<path d="M-.07-.86 L.07-.86 L.045-.17 L-.045-.17Z" fill="'+paint+'" transform="rotate('+i*36+')"/>').join('')+'<circle r=".19" fill="'+paint+'"/><circle r=".07" fill="#1d242d"/></g>').join('');
  return html;
 }
 const api={catalog,normalize,restrict,supports,supported,overlay,defaults};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleRewards=api;
})(typeof window==='undefined'?globalThis:window);
