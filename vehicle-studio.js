/* Generated studio illustrations; magenta is a material channel, never final paint. */
(function(root){
 'use strict';
 const rewards=typeof module!=='undefined'&&module.exports?require('./vehicle-rewards'):root.vehicleRewards;
 const generations=typeof module!=='undefined'&&module.exports?require('./vehicle-generations'):root.vehicleGenerations;
 let serial=0;
 const sheets={
  bmw3:{file:'bmw-3',width:1536,height:1024,cols:3,rows:3,codes:['E21','E30','E36','E46','E90','F30','G20','F87','G87'],bounds:[[0,525,1027,1536],[0,517,1026,1536],[0,520,1029,1536]],top:[80,60,35],bottom:[335,315,285]},
  bmw5:{file:'bmw-5',width:1774,height:887,cols:4,rows:2,codes:['E12','E28','E34','E39','E60','F10','G30','G60'],bounds:[[0,451,890,1332,1774],[0,450,891,1331,1774]],top:[125,90],bottom:[370,340]},
  mercedesc:{file:'mercedes-c',width:1536,height:1024,cols:3,rows:2,codes:['W201','W202','W203','W204','W205','W206'],bounds:[[0,522,1028,1536],[0,528,1029,1536]],top:[170,65],bottom:[455,355]},
  audi:{file:'audi',width:1536,height:1024,cols:4,rows:3,codes:['B4','B5','B6','B7','B8','B9','C4','C5','C6','C7','C8','C9'],bounds:[[0,392,770,1147,1536],[0,389,772,1150,1536],[0,388,770,1151,1536]],top:[95,65,35],bottom:[315,285,255]}
 };
 // Expanded atlas crops measured from transparent alpha, including each vehicle fully.
 Object.assign(sheets,{
  "bmw-compact":{"file":"bmw-compact","width":1536,"height":1024,"crops":[[11,122,373,188],[395,119,370,188],[771,117,376,192],[1154,115,368,194],[5,430,379,186],[387,427,380,188],[769,429,383,188],[1153,427,377,191],[4,712,380,206],[387,712,380,207],[768,712,384,209],[1152,724,381,188]]},
  "bmw-grand":{"file":"bmw-grand","width":1536,"height":1024,"crops":[[14,144,374,185],[396,144,372,186],[768,139,376,189],[1152,140,373,186],[10,459,382,185],[397,459,371,187],[773,456,379,184],[1152,459,376,188],[9,765,375,180],[388,765,380,180],[768,759,382,189],[1151,771,376,176]]},
  "bmw-luxury":{"file":"bmw-luxury","width":1536,"height":1024,"crops":[[7,158,378,180],[388,160,380,177],[772,160,380,178],[1152,161,381,180],[3,451,381,182],[386,452,382,181],[770,451,382,187],[1152,462,380,176],[4,743,382,185],[387,740,381,186],[770,744,383,185],[1154,745,378,181]]},
  "bmw-x-compact":{"file":"bmw-x-compact","width":1536,"height":1024,"crops":[[33,159,331,179],[425,159,317,179],[804,158,324,181],[1187,164,317,171],[33,448,340,180],[419,439,334,192],[805,437,327,190],[1186,441,325,187],[31,735,336,184],[423,737,333,181],[804,737,334,182],[1190,748,318,171]]},
  "bmw-x-grand":{"file":"bmw-x-grand","width":1774,"height":887,"crops":[[14,56,429,226],[457,55,425,224],[889,58,440,224],[1340,54,424,226],[7,345,437,228],[448,344,436,227],[887,345,443,230],[1336,331,432,245],[9,613,443,236],[464,618,429,229],[904,636,418,218],[1338,636,426,219]]},
  "bmw-one-cabrio":{"file":"bmw-one-cabrio","width":1536,"height":1024,"crops":[[23,198,1495,651]]},
  "mini-hatch":{"file":"mini-hatch","width":1536,"height":1024,"crops":[[18,107,374,234],[396,106,372,235],[768,103,380,238],[1152,108,373,233],[14,381,382,253],[396,383,377,252],[773,381,379,255],[1152,382,379,254],[12,679,385,249],[397,680,376,246],[773,679,379,247],[1152,694,377,234]]},
  "mini-range":{"file":"mini-range","width":1536,"height":1024,"crops":[[9,129,376,207],[386,126,381,211],[768,126,377,214],[1145,128,385,205],[2,424,392,205],[396,406,372,226],[768,403,380,230],[1151,395,381,238],[4,728,381,210],[388,740,373,200],[763,715,384,225],[1149,718,383,227]]},
  "audi-small":{"file":"audi-small","width":1536,"height":1024,"crops":[[13,147,374,194],[396,146,374,195],[772,122,360,219],[1143,147,382,194],[8,420,377,208],[387,424,381,204],[768,426,383,202],[1151,432,378,192],[3,711,383,193],[386,712,385,196],[771,713,383,194],[1154,716,379,191]]},
  "audi-suv":{"file":"audi-suv","width":1536,"height":1024,"crops":[[12,133,372,204],[384,121,383,211],[767,124,385,213],[1155,129,371,210],[8,434,384,210],[395,427,373,210],[768,431,392,212],[1163,432,366,211],[8,741,380,210],[388,728,379,220],[767,734,388,214],[1156,747,374,196]]},
  "audi-grand":{"file":"audi-grand","width":1536,"height":1024,"crops":[[3,87,381,200],[385,84,380,202],[768,86,380,201],[1152,88,378,199],[3,405,381,214],[385,405,383,216],[768,425,378,199],[1151,425,377,199],[3,745,381,200],[384,754,384,187],[768,753,381,187],[1150,747,382,192]]},
  "audi-classic":{"file":"audi-classic","width":1774,"height":887,"crops":[[9,83,426,213],[446,82,441,214],[887,84,443,212],[1331,85,441,211],[1,349,443,215],[444,349,443,215],[887,346,446,221],[1335,348,439,214],[2,605,444,217],[446,606,441,217],[890,605,443,220],[1333,606,441,219]]},
  "audi-more":{"file":"audi-more","width":1774,"height":887,"crops":[[9,92,453,205],[463,96,433,201],[899,92,423,205],[1330,93,431,204],[6,355,447,212],[459,354,432,211],[893,354,425,211],[1323,351,444,216],[4,598,440,227],[450,594,441,226],[893,623,434,201],[1330,616,436,205]]},
  "audi-grand-detail":{"file":"audi-grand-detail","width":1536,"height":1024,"crops":[[4,87,380,200],[386,85,380,202],[768,86,380,202],[1152,88,378,200],[4,405,380,215],[386,405,382,217],[768,421,383,204],[1151,425,378,199],[4,746,380,199],[384,755,384,187],[768,754,382,188],[1151,747,381,193]]},
  "audi-small-detail":{"file":"audi-small-detail","width":1536,"height":1024,"crops":[[13,138,375,204],[396,144,374,198],[773,122,361,220],[1144,142,382,200],[7,416,379,213],[388,422,380,207],[768,422,384,207],[1152,431,381,193],[3,710,384,196],[387,712,384,197],[771,713,383,195],[1154,716,380,192]]},
  "audi-more-detail":{"file":"audi-more-detail","width":1774,"height":887,"crops":[[9,91,454,206],[463,94,434,203],[899,91,425,206],[1330,92,433,205],[4,354,458,212],[462,353,431,212],[893,353,427,212],[1325,351,444,215],[4,598,440,228],[449,594,444,227],[893,622,436,203],[1330,614,438,209]]},
  "mini-cooper-s":{"file":"mini-cooper-s","width":1536,"height":1024,"crops":[[11,124,373,217],[399,124,367,217],[777,124,374,217],[1162,122,366,218],[9,415,377,218],[400,422,368,212],[780,415,372,220],[1163,424,363,207],[5,724,380,203],[398,729,370,207],[771,708,381,219],[1154,708,382,216]]}
 });
 const namedPaints={'madeira violett':'#51364f','madeira-violett':'#51364f','madeira violet':'#51364f'};
 const palette=[[/schwarz|black/,'#171b20'],[/weiß|weiss|white/,'#eef0ed'],[/silber|silver/,'#a8b2bc'],[/grau|gray|grey|anthrazit/,'#69727a'],[/blau|blue/,'#2257a0'],[/rot|red/,'#b52332'],[/grün|gruen|green/,'#276548'],[/orange/,'#dc7025'],[/gelb|yellow/,'#d5b92c'],[/lila|purple|violett?|violet/,'#7541a0'],[/rosa|pink/,'#d16ba0'],[/braun|brown/,'#725140'],[/beige|cream/,'#c5b89a']];
 function color(value){const s=String(value||'').trim().toLowerCase();return namedPaints[s]||(/^#[0-9a-f]{6}$/.test(s)?s:palette.find(([pattern])=>pattern.test(s))?.[1]||'#bfc6cc');}
 sheets.bmwe36coupe={file:'bmw-e36-coupe',width:1536,height:1024,cols:1,rows:1,codes:['E36'],crops:[[12,180,1515,670]]};
 function select(car={}){
  const result=generations?.resolve(car);if(!result)return null;
  const expected=generations.bodyType(result.body);
  const explicit=generations.bodyType(car.body||car.body_type||car.bodyType);
  const named=generations.bodyType(car.model||car.vehicle);
  if(result.family==='bmw3'&&result.code==='E36'&&(explicit||named)==='coupe')return {...result,body:'Coupé',asset:['bmwe36coupe',0],wheelKey:'E36_COUPE'};
  if(explicit&&explicit!==expected||named&&named!==expected)return null;
  return result;
 }

 function render(car={}){
  const selected=select(car);if(!selected)return '';
  const sheet=selected.asset?sheets[selected.asset[0]]:selected.family==='m2'?sheets.bmw3:selected.family.startsWith('audi')?sheets.audi:selected.family==='mercedes190'?sheets.mercedesc:sheets[selected.family];
  if(!sheet)return '';
  const index=selected.asset?selected.asset[1]:sheet.codes.indexOf(selected.code);if(index<0)return '';
  const row=Math.floor(index/sheet.cols),col=index%sheet.cols;
  const crop=sheet.crops?.[index]||[sheet.bounds[row][col],row*sheet.height/sheet.rows+sheet.top[row],sheet.bounds[row][col+1]-sheet.bounds[row][col],sheet.bottom[row]-sheet.top[row]];
  const [x,y,w,h]=crop;
  const id='studio-car-'+(++serial),paint=color(car.paintColor||car.color),channels=[1,3,5].map(i=>parseInt(paint.slice(i,i+2),16)/255);
  // R-G and B-G together isolate magenta paint: neutral glass/chrome and
  // red or amber lamps fail at least one channel and retain their source color.
  const matrix=channels.map(v=>`${v.toFixed(5)} ${(1-v).toFixed(5)} 0 0 0`).join(' ')+' 0 0 0 1 0';
  const label=`${selected.brand} ${selected.model} ${selected.code} · ${selected.from}${selected.to?'–'+selected.to:'+'} · Illustration`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" data-studio-generation="${selected.code}" data-paint="${paint}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 12 -12 0 0 -.02" result="redMask"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 -12 12 0 -.02" result="blueMask"/><feComposite in="redMask" in2="blueMask" operator="in" result="paintMask"/><feColorMatrix in="SourceGraphic" type="matrix" values="${matrix}" result="recolored"/><feComposite in="recolored" in2="paintMask" operator="in" result="body"/><feComposite in="SourceGraphic" in2="paintMask" operator="out" result="details"/><feMerge><feMergeNode in="details"/><feMergeNode in="body"/></feMerge></filter></defs><image href="assets/vehicles/${sheet.file}.webp" x="${-x}" y="${-y}" width="${sheet.width}" height="${sheet.height}" filter="url(#${id})"/>${rewards?.overlay(selected.wheelKey||selected.code,crop,car.cosmetics)||''}</svg>`;
 }
 const api={select,render,color,sheets,identify:generations.identify};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleStudio=api;
})(typeof window==='undefined'?{}:window);
