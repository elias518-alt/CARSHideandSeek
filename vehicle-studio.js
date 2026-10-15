/* Generated studio illustrations; magenta is a material channel, never final paint. */
(function(root){
 'use strict';
 const generations=typeof module!=='undefined'&&module.exports?require('./vehicle-generations'):root.vehicleGenerations;
 let serial=0;
 const sheets={
  bmw3:{file:'bmw-3',width:1536,height:1024,cols:3,rows:3,codes:['E21','E30','E36','E46','E90','F30','G20','F87','G87'],bounds:[[0,525,1027,1536],[0,517,1026,1536],[0,520,1029,1536]],top:[80,60,35],bottom:[335,315,285]},
  bmw5:{file:'bmw-5',width:1774,height:887,cols:4,rows:2,codes:['E12','E28','E34','E39','E60','F10','G30','G60'],bounds:[[0,451,890,1332,1774],[0,450,891,1331,1774]],top:[125,90],bottom:[370,340]},
  mercedesc:{file:'mercedes-c',width:1536,height:1024,cols:3,rows:2,codes:['W201','W202','W203','W204','W205','W206'],bounds:[[0,522,1028,1536],[0,528,1029,1536]],top:[170,65],bottom:[455,355]},
  audi:{file:'audi',width:1536,height:1024,cols:4,rows:3,codes:['B4','B5','B6','B7','B8','B9','C4','C5','C6','C7','C8','C9'],bounds:[[0,392,770,1147,1536],[0,389,772,1150,1536],[0,388,770,1151,1536]],top:[95,65,35],bottom:[315,285,255]}
 };
 const palette=[[/schwarz|black/,'#171b20'],[/weiß|weiss|white/,'#eef0ed'],[/silber|silver/,'#a8b2bc'],[/grau|gray|grey|anthrazit/,'#69727a'],[/blau|blue/,'#2257a0'],[/rot|red/,'#b52332'],[/grün|gruen|green/,'#276548'],[/orange/,'#dc7025'],[/gelb|yellow/,'#d5b92c'],[/lila|purple|violett?|violet/,'#7541a0'],[/rosa|pink/,'#d16ba0'],[/braun|brown/,'#725140'],[/beige|cream/,'#c5b89a']];
 function color(value){const s=String(value||'').trim().toLowerCase();return /^#[0-9a-f]{6}$/.test(s)?s:palette.find(([pattern])=>pattern.test(s))?.[1]||'#bfc6cc';}
 function select(car={}){
  const body=String([car.body,car.body_type,car.bodyType,car.model,car.vehicle].filter(Boolean).join(' ')).toLowerCase();
  if(/touring|kombi|estate|wagon|avant|suv|van|cabrio|roadster|compact/.test(body))return null;
  const result=generations?.resolve(car);if(!result)return null;
  if(/coup[eé]/.test(body)&&result.family!=='m2'&&result.code!=='E21')return null;
  return result;
 }
 function render(car={}){
  const selected=select(car);if(!selected)return '';
  const sheet=selected.family==='m2'?sheets.bmw3:selected.family.startsWith('audi')?sheets.audi:selected.family==='mercedes190'?sheets.mercedesc:sheets[selected.family];
  const index=sheet.codes.indexOf(selected.code);if(index<0)return '';
  const row=Math.floor(index/sheet.cols),col=index%sheet.cols,w=sheet.bounds[row][col+1]-sheet.bounds[row][col],h=sheet.height/sheet.rows;
  const id='studio-car-'+(++serial),paint=color(car.color),channels=[1,3,5].map(i=>parseInt(paint.slice(i,i+2),16)/255);
  // R-G and B-G together isolate magenta paint: neutral glass/chrome and
  // red or amber lamps fail at least one channel and retain their source color.
  const matrix=channels.map(v=>`${v.toFixed(5)} ${(1-v).toFixed(5)} 0 0 0`).join(' ')+' 0 0 0 1 0';
  const label=`${selected.brand} ${selected.model} ${selected.code} · ${selected.from}${selected.to?'–'+selected.to:'+'} · Illustration`;
  return `<svg viewBox="0 0 ${w} ${sheet.bottom[row]-sheet.top[row]}" role="img" aria-label="${label}" data-studio-generation="${selected.code}" data-paint="${paint}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${sheet.bottom[row]-sheet.top[row]}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 12 -12 0 0 -.02" result="redMask"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 -12 12 0 -.02" result="blueMask"/><feComposite in="redMask" in2="blueMask" operator="in" result="paintMask"/><feColorMatrix in="SourceGraphic" type="matrix" values="${matrix}" result="recolored"/><feComposite in="recolored" in2="paintMask" operator="in" result="body"/><feComposite in="SourceGraphic" in2="paintMask" operator="out" result="details"/><feMerge><feMergeNode in="details"/><feMergeNode in="body"/></feMerge></filter></defs><image href="assets/vehicles/${sheet.file}.webp" x="${-sheet.bounds[row][col]}" y="${-row*h-sheet.top[row]}" width="${sheet.width}" height="${sheet.height}" filter="url(#${id})"/></svg>`;
 }
 const api={select,render,color,sheets,identify:generations.identify};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleStudio=api;
})(typeof window==='undefined'?{}:window);
