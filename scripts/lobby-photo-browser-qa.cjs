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
  for(const width of [390,1000]){
   page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let presentations={},loadouts={'car-a':{rims:'silver',package:'sport',glow:'cyan'}};
   await page.route('**/supabase-js-*.js',r=>r.fulfill({contentType:'text/javascript',body:stub}));
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/vehicles/bmw-e36-coupe.webp'))}));
   await page.route('**/api/**',r=>{const action=new URL(r.request().url()).pathname.split('/').pop();if(action==='vehicle-rewards'){if(r.request().method()==='POST'){const d=r.request().postDataJSON();if(d.presentation)presentations[d.vehicleId]=d.presentation;if(d.loadout)loadouts[d.vehicleId]=d.loadout;}return r.fulfill({json:{level:15,loadouts,presentations}});}return r.fulfill({json:action==='account-status'?{accepted:true,legal:{ready:true}}:action==='wardrobe-access'?{plus:true}:action==='invites'?{invites:[]}:action==='ads-status'?{enabled:false,reward:{permanent:true,progress:10}}:{}});});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));



   for(const count of [1,6]){
    await page.evaluate(count=>{
     clearTimeout(pollTimer);Object.assign(localGarage[0],{photo:'https://fixture.invalid/car.webp',presentation:{mode:'photo'},active:true});
     const players=Array.from({length:count},(_,i)=>({id:'p'+i,name:i?'Spieler '+i:'Elias',vehicle:'BMW 3er',vehicleYear:1996,vehicleSeries:'E36',bodyType:'Coupé',color:'Silber',ready:true,connected:true,hasLocation:true,appearance:{collection:'studio',figure:'luca',top:7,pants:3}}));
     state={serverTime:Date.now(),lobby:{code:'PHOTO'+count,state:'LOBBY',name:'Parkplatz',hostId:'p0',me:players[0],players,settings:{radius:500,duration:900,headstart:180,maxPlayers:20}},chat:[],blocksForMe:[]};openPage('game');renderGame();document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    },count);
    await page.waitForFunction(()=>document.querySelector('#players .freshCrewLead [data-showroom-photo]')?.dataset.photoFit==='ready');
    const host=page.locator('#players .freshCrewLead');
    assert.equal(await host.locator('.parkingVehicleStage .vehicleIllustration').count(),1);
    assert.equal(await host.locator('.parkingVehicleStage .vehicleRender').evaluate(e=>getComputedStyle(e).backgroundImage),'none');
    const placement=await host.locator('.parkingVehicleStage .vehicleIllustration').evaluate(e=>{const r=e.getBoundingClientRect(),v=document.querySelector('#players .parkingViewport').getBoundingClientRect();return {gap:v.bottom-r.bottom,visible:r.top>=v.top&&r.bottom<v.bottom};});
    assert.ok(placement.visible);assert.ok(placement.gap>=40,JSON.stringify(placement));
    await page.locator('#players').screenshot({path:'/tmp/lobby-photo-'+count+'-'+width+'.png'});
   }
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,status:'passed',photoOnly:true,raised:true}));await page.close();
  }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
