// Real application with deterministic account/API fixtures; no production writes.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),out='/tmp/chs-unified-qa';fs.mkdirSync(out,{recursive:true});
const stub=fs.readFileSync(path.join(repo,'scripts/community-ui-qa.mjs'),'utf8').match(/const stub=`([\s\S]*?)`;/)[1];
(async()=>{
 const server=http.createServer(require(path.join(repo,'server')).handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page,checks=0;
 const check=(value,message)=>{assert.ok(value,message);checks++;};
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [1200]){
   page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let presentations={},loadouts={'car-a':{rims:'silver',package:'sport',glow:'cyan'}};
   await page.route('**/supabase-js-*.js',r=>r.fulfill({contentType:'text/javascript',body:stub}));
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',r=>{const action=new URL(r.request().url()).pathname.split('/').pop();if(action==='vehicle-rewards'){if(r.request().method()==='POST'){const d=r.request().postDataJSON();if(d.presentation)presentations[d.vehicleId]=d.presentation;if(d.loadout)loadouts[d.vehicleId]=d.loadout;}return r.fulfill({json:{level:15,loadouts,presentations}});}return r.fulfill({json:action==='account-status'?{accepted:true,legal:{ready:true}}:action==='wardrobe-access'?{plus:true}:action==='invites'?{invites:[]}:action==='ads-status'?{enabled:false,reward:{permanent:true,progress:10}}:{}});});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));




   await page.evaluate(()=>{accountUI.appearance=()=>characterStudio.normalize({figure:'luca',top:7,pants:3});openPage('profile');renderProfile();referenceUI.renderOwn();});
   await page.waitForSelector('#profileVehicleStage [data-garment-band]');
   const sizes=await page.locator('#profileVehicleStage [data-garment-band]').evaluateAll(es=>es.map(e=>({actual:getComputedStyle(e).height==='auto'?Number(e.getAttribute('height')):parseFloat(getComputedStyle(e).height),expected:Number(e.getAttribute('height'))})));
   for(const size of sizes)assert.equal(size.actual,size.expected,'Profile styles preserve the inner garment viewport');
   await page.locator('#profileVehicleStage').screenshot({path:'/tmp/profile-outfit-fixed.png'});
   const assets=Object.fromEntries(['male','female'].map(g=>[g,'data:image/webp;base64,'+fs.readFileSync(repo+'/assets/characters/studio/wardrobe-'+g+'.webp').toString('base64')]));
   const failures=await page.evaluate(async assets=>{
    const failures=[];
    for(const [figure,gender] of [['luca','male'],['mia','female']])for(let top=0;top<12;top++)for(let pants=0;pants<12;pants++){
     const wrap=document.createElement('div');wrap.innerHTML=characterStudio.render({figure,top,pants});const svg=wrap.querySelector('svg');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.querySelectorAll('image').forEach(i=>i.setAttribute('href',assets[gender]));const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await image.decode();const canvas=document.createElement('canvas');canvas.width=240;canvas.height=600;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,240,600);const data=ctx.getImageData(0,0,240,600).data;const waist=wardrobeCatalog.waists[gender][top];let gap=0,maxGap=0;for(let y=waist-12;y<waist+10;y++){const alpha=data[(y*240+120)*4+3];gap=alpha<128?gap+1:0;maxGap=Math.max(maxGap,gap);}if(maxGap>2)failures.push({figure,top,pants,maxGap});
    }
    return failures;
   },assets);assert.deepEqual(failures,[],'All clothing combinations keep an opaque waist seam');console.log(JSON.stringify({tested:288,failures}));
   await page.waitForTimeout(600);await page.close();
  }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
