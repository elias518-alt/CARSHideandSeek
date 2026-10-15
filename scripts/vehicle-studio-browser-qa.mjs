// Real Chromium SVG rendering, local files only, no accounts or production writes.
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),repo=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const server=http.createServer(require(repo+'server').handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,output=process.env.CHS_QA_OUTPUT||'/tmp/chs-studio-qa';fs.mkdirSync(output,{recursive:true});
let browser,checks=0;const check=(value,message)=>{if(!value)throw Error(message);checks++;};
try{
 browser=await chromium.launch({executablePath:process.env.CHS_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1400,height:1100}});
 await page.goto(base+'/manifest.json');
 await page.setContent('<meta charset="utf-8"><base href="'+base+'/"><style>body{background:#111823;color:white;font:15px sans-serif;margin:20px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:#222d3c;border:1px solid #405067;border-radius:16px;padding:10px}svg{width:100%;height:190px;overflow:hidden}h3{margin:5px;font-size:14px}</style><main></main>');
 await page.addScriptTag({url:base+'/vehicle-generations.js'});await page.addScriptTag({url:base+'/vehicle-studio.js'});
 await page.evaluate(()=>{const colors=['Schwarz','Weiß','Silber','Grau','Blau','Rot','Grün','Orange','Gelb','Lila','Rosa','Beige'];document.querySelector('main').innerHTML=colors.map(color=>'<article><h3>G20 · '+color+'</h3>'+vehicleStudio.render({brand:'BMW',model:'3er',year:2022,color})+'</article>').join('');});
 await page.waitForLoadState('networkidle');await page.screenshot({path:output+'/paint.png',fullPage:true});
 const sheets=Object.fromEntries([...new Set(Object.values(require(repo+'vehicle-studio').sheets).map(s=>s.file))].map(name=>[name,'data:image/webp;base64,'+fs.readFileSync(repo+'assets/vehicles/'+name+'.webp').toString('base64')]));
 const pixels=await page.evaluate(async sheets=>{
  const result=[];
  for(const car of [{brand:'BMW',model:'3er',year:2022},{brand:'BMW',model:'5er',year:2020},{brand:'Mercedes-Benz',model:'C-Klasse',year:2018},{brand:'Audi',model:'A6',year:2020},{brand:'BMW',model:'1er',year:2017},{brand:'BMW',model:'4er',year:2022},{brand:'BMW',model:'7er',year:1998},{brand:'BMW',model:'X1',year:2020},{brand:'BMW',model:'X5',year:2020},{brand:'BMW',model:'1er Cabrio',year:2010},{brand:'Mini',model:'Cooper',year:2020},{brand:'Mini',model:'Cooper S',year:2010},{brand:'Mini',model:'Cabrio',year:2020},{brand:'Audi',model:'A1',year:2020},{brand:'Audi',model:'Q3',year:2020},{brand:'Audi',model:'TT',year:2001},{brand:'Audi',model:'TT',year:2010},{brand:'Audi',model:'A5',year:2010},{brand:'Audi',model:'A5 Sportback',year:2012},{brand:'Audi',model:'100',year:1988},{brand:'Audi',model:'A4 Avant',year:2020}]){
   async function raster(color,original=false){const d=document.createElement('div');d.innerHTML=vehicleStudio.render({...car,color});const svg=d.firstElementChild;svg.setAttribute('width','400');svg.setAttribute('height','240');const image=svg.querySelector('image');const name=image.getAttribute('href').split('/').at(-1).replace('.webp','');image.setAttribute('href',sheets[name]);if(original)image.removeAttribute('filter');const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await img.decode();const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,400,240).data;}
   const original=await raster('Silber',true),black=await raster('Schwarz'),white=await raster('Weiß');let neutral=0,changedNeutral=0,painted=0;
   for(let i=0;i<original.length;i+=4){if(original[i+3]<250)continue;const delta=Math.max(...[0,1,2].map(k=>Math.abs(black[i+k]-white[i+k])));if(original[i]+5<original[i+1]||original[i+2]+5<original[i+1]){neutral++;if(delta>6)changedNeutral++;}if(delta>45)painted++;}
   result.push({car:car.brand+' '+car.model,neutral,changedNeutral,painted});
  }return result;
 },sheets);
 for(const row of pixels){check(row.neutral>100,'Glass/trim sample missing '+row.car);check(row.changedNeutral<row.neutral*.01,'Paint leaked into glass/trim '+JSON.stringify(row));check(row.painted>3000,'Body paint not changing '+row.car);}
 const generationCount=await page.evaluate(()=>{const gallery=document.createElement('div');gallery.innerHTML=Object.values(vehicleGenerations.families).flatMap(f=>f.rows.map(([code,year])=>vehicleStudio.render({brand:f.brand,model:f.model,year,series:code,color:'Silber'}))).join('');return gallery.querySelectorAll('[data-studio-generation]').length;});
 check(generationCount===192,'Missing generation in gallery');
 // Inspect all entries, then photograph one atlas at a time. A full-height
 // screenshot of hundreds of filtered SVGs exceeds some Chromium GPU limits.
 // Separate contact sheets stay legible for visual inspection of every new cell.
 for(const name of Object.keys(sheets)){
  await page.evaluate(name=>{
   const cars=Object.values(vehicleGenerations.families).flatMap(f=>f.rows.map(([code,year])=>({brand:f.brand,model:f.model,year,series:code,color:'Silber'})));
   document.querySelector('main').innerHTML=cars.map(car=>({car,svg:vehicleStudio.render(car)})).filter(item=>item.svg.includes('/'+name+'.webp')).map(({car,svg})=>'<article><h3>'+car.brand+' '+car.model+' '+car.series+'</h3>'+svg+'</article>').join('');
  },name);
  await page.waitForLoadState('networkidle');await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
 }
 console.log(JSON.stringify({checks,status:'passed',pixels,screenshots:output}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
