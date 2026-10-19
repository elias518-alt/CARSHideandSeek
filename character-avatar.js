/* Parametric game avatar: only allowlisted visual choices, never source-photo pixels. */
(function(root){
 'use strict';let serial=0;
 const palettes={skin:['#f4d6bd','#e7b78e','#cc916a','#a76d4c','#794b36','#503126'],hair:['#241e1c','#4a3025','#805331','#c59753','#d4c5a4','#a54e31','#57565b','#e3ded8'],eyes:['#48332a','#647f55','#47788e','#777c86']};
 const hairstyles=['Kurz & Textur','Seitenscheitel','Locken','Bob','Lang & Wellig','Zopf','Buzzcut','Glatze'];
 const shapes=['Oval','Rund','Markant','Schmal'];
 const beards=['Glattrasiert','Dreitagebart','Kurzer Vollbart','Schnurrbart'];
 const poses=['Entspannt','Hand an der Hüfte','Arme verschränkt','Lässiger Stand','Winken'];
 const celebrations=['Beide Arme hoch','Siegerfaust','Victory-Zeichen'];
 const integer=(n,max,fallback=0)=>Number.isInteger(n)&&n>=0&&n<=max?n:fallback;
 const bound=(n,min,max,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n*100)/100)):fallback;
 function traits(input={},gender='male'){const v=input&&typeof input==='object'?input:{};return {skin:integer(v.skin,5,1),hair:integer(v.hair,7,gender==='female'?4:0),hairColor:integer(v.hairColor,7,1),eyes:integer(v.eyes,3),shape:integer(v.shape,3),beard:integer(v.beard,3),glasses:v.glasses===true,eyeSpacing:bound(v.eyeSpacing,.85,1.15,1),eyeSize:bound(v.eyeSize,.8,1.2,1),nose:bound(v.nose,.8,1.2,1),mouth:bound(v.mouth,.8,1.2,1)};}
 function won(lobby,playerId){const p=lobby?.result?.players?.find(p=>p.id===playerId);return !!p&&!lobby.result.aborted&&!p.eliminated&&['HIDER','SEEKER'].includes(p.role)&&typeof lobby.result.seekersWin==='boolean'&&(p.role==='SEEKER'?lobby.result.seekersWin:!lobby.result.seekersWin&&!p.found&&!p.foundBy);}
 function render(v,context='standing'){
  const t=traits(v.traits,v.gender),id='avatar-'+(++serial),female=v.gender==='female',win=context==='victory',pose=win?5+integer(v.winPose,2):integer(v.pose,4),skin=palettes.skin[t.skin],hair=palettes.hair[t.hairColor],eye=palettes.eyes[t.eyes];
  const color=k=>root.characterStudio?.colors?.[k]?.[1]||v._colors?.[k]?.[1]||'#263b60';
  const top=color(v.topColor),pants=color(v.pantsColor),shoe=color(v.shoeColor);
  const shade=c=>'#'+[1,3,5].map(p=>Math.round(parseInt(c.slice(p,p+2),16)*.72).toString(16).padStart(2,'0')).join('');
  const grad=(name,c)=>`<linearGradient id="${id}-${name}" x1="0" y1="0" x2="1" y2=".25"><stop stop-color="${c}"/><stop offset=".36" stop-color="${c}"/><stop offset="1" stop-color="${shade(c)}"/></linearGradient>`;
  const fill=name=>`url(#${id}-${name})`;
  const path=(d,c,extra='')=>`<path d="${d}" fill="${c}" ${extra}/>`;
  const line=(d,c='#101827',width=2,extra='')=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const ellipse=(cx,cy,rx,ry,c,extra='')=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" ${extra}/>`;
  let left=[[108,224],[91,291],[101,354]],right=[[212,224],[230,290],[220,354]];
  if(pose===1)left=[[108,224],[78,283],[121,310]];
  if(pose===2){left=[[108,224],[92,292],[199,269]];right=[[212,224],[230,291],[125,274]];}
  if(pose===3){left=[[108,224],[99,293],[134,350]];right=[[212,224],[226,289],[187,349]];}
  if(pose===4||pose===7)right=[[212,224],[248,172],[253,103]];
  if(pose===5){left=[[108,224],[76,153],[59,78]];right=[[212,224],[244,153],[261,78]];}
  if(pose===6)right=[[212,224],[243,165],[231,95]];
  const short=[0,4,7].includes(v.top),sleeve=v.top===5?'#e1d9c9':fill('top');
  function arm(points,side){const [[sx,sy],[ex,ey],[wx,wy]]=points,upper=`M${sx} ${sy}Q${(sx+ex)/2} ${(sy+ey)/2} ${ex} ${ey}`,lower=`M${ex} ${ey}Q${(ex+wx)/2} ${(ey+wy)/2} ${wx} ${wy}`,angle=Math.atan2(wy-ey,wx-ex)*180/Math.PI-90;
   const hand=pose===6&&side==='right'?ellipse(0,7,12,15,fill('skin'))+line('M-6 2L6 2M-7 8L5 8','#4b2d25',1):path('M-9 -3Q-13 4 -10 14L-7 22Q-4 25 -2 20L-1 8L1 24Q4 27 5 22L6 8L8 20Q11 23 12 17L11 -1Q7 -9 -1 -8Z',fill('skin'))+line('M-7 4L-5 14M0 2L0 12M7 2L7 10','#4b2d25',.9);
   return `<g class="avatarArm avatarArm--${side}">${line(upper,'#101821',female?35:40)}${line(upper,sleeve,female?31:36)}${line(lower,short?fill('skin'):'#101821',short?22:30)}${!short?line(lower,sleeve,26):''}${line(`M${sx-2} ${sy+4}L${ex-3} ${ey-3}`,'#fff',1,'opacity=".12"')}<g transform="translate(${wx} ${wy}) rotate(${angle})">${hand}${pose===7&&side==='right'?path('M-7 2L-15  -31Q-14 -37 -10 -32L0 -7L9 -33Q14 -37 14 -30L6 7Z',fill('skin')):''}</g></g>`;
  }
  const legWidth=v.pants===4?40:v.pants===2?29:34,legL=pose===3?142:123,legR=pose===3?176:199;
  function leg(side){const x=side==='left'?133:187,end=side==='left'?legL:legR,shorts=v.pants===3;return `<g class="avatarLeg">${line(`M${x} 365L${x-2} 474L${end} 601`,'#141b25',legWidth+4)}${line(`M${x} 365L${x-2} 474L${end} 601`,shorts?fill('skin'):fill('pants'),legWidth)}${shorts?line(`M${x} 363L${x-2} 459`,fill('pants'),legWidth+9):''}${line(`M${x-9} 401L${x-10} 468L${end-8} 584`,'#fff',1.5,'opacity=".12"')}${v.pants===0?path(`M${x-18} 411h32v47h-32Z`,fill('pants'),'stroke="#101827" stroke-width="1.5"')+line(`M${x-18} 420h32`,'#ffffff',1,'opacity=".2"'):''}${v.pants===1?line(`M${x-10} 477l22 -3m-18 7l14 -2`,'#d7dfed',1,'opacity=".4"'):''}${v.pants===2?line(`M${end-14} 591h28`,'#111a27',9):''}${v.shoes===2?path(`M${end-20} 574h36l3 40h-44Z`,fill('shoe')):''}${path(`M${end-18} 602Q${end+4} 596 ${end+20} 607L${end+26} 621Q${end+26} 632 ${end+13} 634L${end-29} 634Q${end-36} 628 ${end-29} 619Z`,fill('shoe'),'stroke="#111925" stroke-width="2"')}${line(`M${end-29} 629Q${end} 633 ${end+23} 627`,v.shoes===2?'#20232a':'#e8e9ed',6)}${v.shoes===1?path(`M${end-17} 585h32v25h-32Z`,fill('shoe')):''}${line(`M${end-12} 609l22 1m-24 5l24 1m-23 5l24 1`,'#e6e5e3',1.6)}${v.shoes===3?path(`M${end-22} 621l15 -9 20 9Z`,'#d5deef','opacity=".55"'):''}</g>`;}
  const waist=female?39:47,torso=`M108 207Q127 199 140 198L180 198Q201 199 212 208L209 265Q${160+waist} 310 ${160+waist} 366Q160 380 ${160-waist} 366L111 264Z`;
  const collar=v.top===4?path('M136 204L149 231L160 211L171 231L185 204Z',fill('top'),'stroke="#ffffff" stroke-opacity=".3"'):v.top===1?path('M138 195Q107 200 122 229L142 241L159 217L180 241L199 226Q214 202 182 195Z',fill('top'),'stroke="#101821" stroke-width="2"'):path('M139 201Q159 224 181 201L179 211Q160 232 141 211Z','#101821','opacity=".65"');
  const zipped=[2,3,5,6].includes(v.top),coat=v.top===6;
  const upper=path(torso,fill('top'),'stroke="#101821" stroke-width="2"')+(coat?path('M113 313L101 422Q128 433 153 424L159 352L167 424Q196 433 219 421L207 312Z',fill('top'),'stroke="#101821" stroke-width="2"'):'')+collar+(zipped?line('M160 220L160 '+(coat?423:369),'#101822',4)+line('M162 225L162 '+(coat?418:366),'#dde2e6',1,'opacity=".65"'):'')+(v.top===1?path('M132 313L120 347Q159 361 201 347L189 313Z',fill('top'),'stroke="#121d2a" stroke-width="1.5"')+line('M140 231L141 269M180 232L178 267','#e6e4df',2):'')+(v.top===3?path('M119 239h28v34h-28ZM173 239h28v34h-28Z',fill('top'),'stroke="#ffffff" stroke-opacity=".3"'):'')+(v.top===5?`<text x="128" y="264" fill="#e6d9bf" font-family="system-ui" font-weight="900" font-size="24">C</text>`:'')+(v.top===7?path('M113 218L143 300H176L207 218L195 215L171 283H148L125 214Z','#dce5f0','opacity=".85"'):'')+line('M120 280Q135 291 141 287M181 288L199 280M122 355Q160 363 198 355','#fff',1.5,'opacity=".12"');
  const headWidth=[43,48,46,39][t.shape],jaw=[29,34,36,26][t.shape];
  const face=`M${160-headWidth} 119Q${160-headWidth-3} 82 160 80Q${160+headWidth+3} 82 ${160+headWidth} 119L${160+headWidth-3} 157Q${160+jaw} 185 160 192Q${160-jaw} 185 ${160-headWidth+3} 157Z`;
  const hairBack=t.hair===3?path('M111 121Q102 74 157 67Q214 66 211 125L218 187Q198 205 181 184L137 185Q114 198 102 182Z',fill('hair')):t.hair===5?path('M182 83Q225 65 229 100Q224 121 231 147L218 192L204 179L208 139Q213 116 193 111Z',fill('hair')):t.hair===4?path('M112 114Q104 69 158 66Q215 64 212 118Q228 162 217 219L190 225L184 164H137L132 222L102 218Q94 170 112 114Z',fill('hair')):'';
  const hairFront=[
   'M114 126L109 97L120 76L132 78L140 66L154 70L171 62L181 71L199 73L212 93L207 125L198 104Q169 110 140 99L123 111Z',
   'M113 128L108 101Q112 66 158 66Q204 65 210 95L207 128L196 102Q173 96 133 110L122 127Z',
   'M113 129Q95 116 106 104Q94 88 112 81Q107 64 130 66Q140 48 157 62Q175 48 186 65Q208 61 208 80Q226 88 211 105Q223 125 205 131L197 102Q174 110 159 98Q143 111 122 105Z',
   'M112 144Q104 91 126 77Q162 52 196 78Q218 98 207 146L193 100Q165 101 144 84Q125 114 112 144Z',
   'M111 143Q98 91 125 74Q159 54 195 77Q222 100 207 146L197 106Q176 99 158 82Q140 110 123 115Z',
   'M113 135Q103 96 122 77Q162 52 198 81L209 132L194 101Q160 117 127 102Z',
   'M115 120Q108 77 159 73Q210 77 205 119L198 99Q160 84 123 100Z',''
  ][t.hair];
  const brows=line('M128 125Q139 119 149 125M172 125Q184 119 195 125',hair,4);
  const eyeMarkup=(cx)=>`<g transform="translate(${cx} 137) scale(${t.eyeSize})">${path('M-12 0Q0 -9 12 0Q0 7 -12 0Z','#f3e9df')}${ellipse(0,0,4.5,5,eye)}${ellipse(0,0,2.2,3,'#151d28')}${ellipse(1.1,-1.4,1.2,1.4,'#fff')}${line('M-12 0Q0 -9 12 0','#513b35',1.5)}</g>`;
  const beard=t.beard===1||t.beard===2?path(`M${160-headWidth+6} 149Q135 170 160 171Q186 170 ${160+headWidth-6} 149L${160+headWidth-7} 170Q160 ${t.beard===2?204:194} ${160-headWidth+7} 170Z`,hair,`opacity="${t.beard===1?.32:.85}"`):'';
  const moustache=t.beard===2||t.beard===3?path('M142 166Q150 157 160 161Q171 157 179 166Q167 170 160 165Q151 169 142 166Z',hair):'';
  const mouth=win?path('M145 173Q160 181 178 171Q169 193 154 183Z','#5e302d')+path('M147 174Q161 179 176 173L172 178Q158 182 150 178Z','#fff7e9'):line(`M${160-15*t.mouth} 175Q160 181 ${160+15*t.mouth} 174`,'#844b43',2.4);
  const head=`${hairBack}${path('M143 177L139 207Q160 225 182 207L177 177Z',fill('skin'),'stroke="#50382f" stroke-opacity=".3"')}${ellipse(115,143,9,17,fill('skin'))}${ellipse(205,143,9,17,fill('skin'))}${path(face,fill('skin'),'stroke="#4b332d" stroke-opacity=".5" stroke-width="1.5"')}${path(`M${160+headWidth-4} 119L${160+headWidth-7} 157Q186 184 160 190Q185 159 182 116Z`,'#513a30','opacity=".12"')}${ellipse(136,155,12,6,'#d57d6e','opacity=".16"')}${ellipse(185,155,12,6,'#d57d6e','opacity=".16"')}${brows}${eyeMarkup(160-23*t.eyeSpacing)}${eyeMarkup(160+23*t.eyeSpacing)}${line(`M160 136L${160-4*t.nose} 156Q162 163 ${166+3*t.nose} 156`,'#80573f',1.5)}${beard}${moustache}${mouth}${path(hairFront,fill('hair'))}${t.hair!==7?line('M125 91Q151 74 183 81', '#fff',2,'opacity=".14"'):''}${t.glasses?`<g fill="none" stroke="#182331" stroke-width="3"><rect x="121" y="127" width="33" height="23" rx="8"/><rect x="169" y="127" width="33" height="23" rx="8"/><path d="M154 134Q161 130 169 134M115 130L121 133M202 133L207 130"/></g>`:''}`;
  return `<span class="lobbyCrewCharacter wardrobeCharacter wardrobeStudio wardrobeAvatar${win?' avatarCelebrating':''}" aria-hidden="true" data-character="${v.gender}" data-top="${v.top}" data-pants="${v.pants}" data-pose="${pose}"><svg viewBox="0 30 320 610" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg"><defs>${grad('skin',skin)}${grad('hair',hair)}${grad('top',top)}${grad('pants',pants)}${grad('shoe',shoe)}</defs><g class="avatarBody">${leg('left')}${leg('right')}${pose!==2?arm(left,'left')+arm(right,'right'):''}${upper}${pose===2?arm(left,'left')+arm(right,'right'):''}${head}</g></svg></span>`;
 }
 const api={traits,render,palettes,hairstyles,shapes,beards,poses,celebrations,won};if(typeof module==='object'&&module.exports)module.exports=api;else root.characterAvatar=api;
})(typeof globalThis==='object'?globalThis:this);
