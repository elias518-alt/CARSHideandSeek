/* Original vector illustrations. No badges or manufacturer artwork. */
(function(root){
 'use strict';
 let serial=0;
 const styles={
  f87:{label:'Kompaktes Sportcoupé · Generation 2016–2021',roof:'M103 127 Q129 89 174 87 L217 90 Q244 99 269 127',rear:70,front:299,angular:false},
  g87:{label:'Kompaktes Sportcoupé · Generation ab 2023',roof:'M98 126 L139 85 L215 85 L267 123',rear:66,front:303,angular:true},
  golf7:{label:'Kompaktwagen · Generation 2012–2019',roof:'M86 125 L106 80 Q160 73 209 85 L264 127',rear:72,front:293,angular:false,hatch:true},
  golf8:{label:'Kompaktwagen · Generation ab 2019',roof:'M87 125 L110 78 Q172 72 213 87 L269 127',rear:73,front:297,angular:true,hatch:true},
  e46:{label:'Klassische Sportlimousine · Generation 1997–2006',roof:'M99 128 L136 91 L212 91 L257 128',rear:69,front:300,angular:false,sedan:true},
  g20:{label:'Sportlimousine · Generation ab 2019',roof:'M93 125 Q131 82 167 82 L217 87 L266 125',rear:66,front:304,angular:true,sedan:true},
  focus3:{label:'Kompaktwagen · Generation 2011–2018',roof:'M85 128 L111 82 Q163 73 213 91 L267 128',rear:72,front:296,angular:false,hatch:true},
  focus4:{label:'Kompaktwagen · Generation ab 2018',roof:'M83 127 L114 83 Q161 72 215 86 L275 126',rear:72,front:301,angular:true,hatch:true}
 };
 function select(car={}){
  const body=String(car.body||car.body_type||car.bodyType||'').toLowerCase();
  if(/touring|kombi|wagon|suv|van|cabrio|roadster/.test(body))return null;
  const name=[car.brand,car.model,car.vehicle].filter(Boolean).join(' ').toLowerCase(),series=String(car.series||'').toLowerCase(),year=Number(car.year||car.model_year);
  if(/bmw.*\bm2\b/.test(name))return /g87/.test(series)?'g87':/f87/.test(series)?'f87':year>=2023?'g87':year>=2016&&year<=2021?'f87':null;
  if(/(?:volkswagen|vw).*golf/.test(name))return /viii/.test(series)?'golf8':/vii\b/.test(series)?'golf7':year>=2019?'golf8':year>=2012?'golf7':null;
  if(/bmw.*(?:3er|e46|g20)/.test(name))return /g20/.test(name+' '+series)||year>=2019?'g20':/e46/.test(name+' '+series)||year>=1997&&year<=2006?'e46':null;
  if(/ford.*focus/.test(name))return /iv/.test(series)||year>=2018?'focus4':/iii/.test(series)||year>=2011?'focus3':null;
  return null;
 }
 function color(value){const s=String(value||'').toLowerCase();if(/^#[\da-f]{6}$/.test(s))return s;const colors=[[/schwarz|black/,'#333a46'],[/weiß|weiss|white/,'#e2e8ee'],[/blau|blue/,'#458edc'],[/rot|red/,'#df454f'],[/grün|gruen|green/,'#3ea783'],[/orange/,'#f18d3f'],[/gelb|yellow/,'#ead45d'],[/lila|purple|violet/,'#9d73de'],[/rosa|pink/,'#e986b8'],[/braun|brown/,'#9b7867']];return colors.find(([r])=>r.test(s))?.[1]||'#a2afc0';}
 function render(car){const key=select(car);if(!key)return '';const t=styles[key],id='original-car-'+(++serial),paint=color(car.color);
  const wheels=[t.rear,t.front].map(x=>`<g transform="translate(${x} 174)"><circle r="30" fill="#0a0d13"/><circle r="23" fill="#202935" stroke="#657387" stroke-width="2"/><circle r="17" fill="#0c121c"/>${Array.from({length:5},(_,i)=>`<path d="M-3-17 L3-17 L2-5 L-2-5Z" fill="#c0cbd8" transform="rotate(${i*72})"/>`).join('')}<circle r="6" fill="#8f9cab"/><circle r="3" fill="#26313c"/></g>`).join('');
  return `<svg viewBox="0 0 384 240" role="img" aria-label="${t.label}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x2="0.15" y2="1"><stop stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient><linearGradient id="${id}-glass" x2=".6" y2="1"><stop stop-color="#aac7d4"/><stop offset=".5" stop-color="#2e4557"/><stop offset="1" stop-color="#131d2b"/></linearGradient></defs><ellipse cx="192" cy="205" rx="168" ry="10" fill="#000" opacity=".23"/><g fill="${paint}" stroke="#121b28" stroke-width="2" stroke-linejoin="round"><path d="${t.roof} L275 139 L90 139Z"/><path d="${t.angular?'M24 135 L86 126 L275 124 L350 136 L363 151 L358 181 L336 186 Q335 140 304 141 Q272 141 271 186 L102 186 Q101 140 71 141 Q39 141 39 185 L22 181 L19 151Z':'M22 146 Q28 134 85 128 L264 127 Q323 125 351 144 L361 157 L357 181 L331 186 Q330 142 299 142 Q268 142 267 186 L104 186 Q103 142 72 142 Q40 142 40 185 L22 180Z'}"/><path d="${t.roof} L275 139 L90 139Z" fill="url(#${id})" stroke="none"/><path d="M${t.hatch?'101 119 L118 88 L167 85 L167 120 L101 119 M176 86 L205 94 L249 121 L177 120':'119 121 L145 94 L175 93 L175 121 L119 121 M183 93 L211 96 L249 122 L183 121'}" fill="url(#${id}-glass)"/><path d="M28 145 Q177 127 351 146 L350 163 Q189 152 29 164Z" fill="url(#${id})" stroke="none"/><path d="M110 133 L${t.sedan?174:220} 132 L${t.sedan?179:222} 174 L109 175Z" fill="none" stroke="#152334" stroke-opacity=".45"/>${t.sedan?'<path d="M183 133 L257 134 L265 174 L184 174Z" fill="none" stroke-opacity=".45"/>':''}<path d="M${t.sedan?151:194} 137h14" stroke="#dce6ee" stroke-width="3"/><path d="M113 179H263" stroke="#0b121b" stroke-width="5"/><path d="M323 143 L352 147 L348 ${t.angular?152:157} L325 153Z" fill="#d9f5ff" stroke="#476779"/><path d="M24 141 L46 137 L44 149 L23 152Z" fill="#ef6265"/><path d="M344 167h14" stroke="#111925" stroke-width="8"/><path d="M245 119l12 1 5 9-19-1Z" fill="${paint}"/></g>${wheels}</svg>`;
 }
 const api={select,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleArt=api;
})(typeof window==='undefined'?{}:window);
