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
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',r=>{const action=new URL(r.request().url()).pathname.split('/').pop();if(action==='vehicle-rewards'){if(r.request().method()==='POST'){const d=r.request().postDataJSON();if(d.presentation)presentations[d.vehicleId]=d.presentation;if(d.loadout)loadouts[d.vehicleId]=d.loadout;}return r.fulfill({json:{level:15,loadouts,presentations}});}return r.fulfill({json:action==='account-status'?{accepted:true,legal:{ready:true}}:action==='wardrobe-access'?{plus:true}:action==='invites'?{invites:[]}:action==='ads-status'?{enabled:false,reward:{permanent:true,progress:10}}:{}});});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));


   await page.evaluate(()=>{
    const base=supabaseClient.rpc;window.qaAccent='orange';window.qaPlus=true;window.qaAccentWrites=[];
    supabaseClient.rpc=async(name,args)=>{
     if(name==='chs_plus_action'){qaAccent=args.payload.accent;qaAccentWrites.push(qaAccent);return {data:{active:qaPlus,accent:qaAccent}};}
     if(name==='chs_plus_read')return {data:{active:qaPlus,accent:qaAccent}};
     return base(name,args);
    };
   });
   await page.evaluate(()=>plusUI.open());
   const colors={orange:'#ff8a1f',pink:'#f599cf',purple:'#bea4ff',blue:'#8fc5ff',turquoise:'#79e0ce',white:'#eff3fa'};
   for(const [name,hex] of Object.entries(colors)){
    await page.locator('[data-accent='+name+']').click();
    await page.waitForFunction(v=>document.documentElement.style.getPropertyValue('--player-accent')===v,hex);
    await page.evaluate(()=>plusUI.refresh());
    const actual=await page.evaluate(()=>({button:getComputedStyle(document.getElementById('openPlay')).getPropertyValue('--face').trim(),nav:getComputedStyle(document.getElementById('bottomNav')).getPropertyValue('--nav-face').trim(),mask:getComputedStyle(document.getElementById('bottomNav'),'::before').maskImage}));
    assert.equal(actual.button,hex);assert.equal(actual.nav,hex);assert.ok(actual.mask.includes('navigation-notch.svg'));
    await page.locator('#plusDialog header button').click();
    await page.screenshot({path:'/tmp/plus-controls-'+name+'-'+width+'.png'});
    await page.evaluate(()=>plusUI.open());
   }
   assert.equal(await page.evaluate(()=>qaAccentWrites.length),6);
   await page.evaluate(()=>{qaPlus=false;return plusUI.refresh();});
   assert.equal(await page.locator('[data-accent=pink]').isDisabled(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--player-accent')),'#ff8a1f');
   await page.evaluate(()=>plusUI.reset());
   assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--player-accent')),'#ff8a1f');
   assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth+2),false);
   console.log(JSON.stringify({width,status:'passed',themes:6,plusGate:true,reset:true}));await page.close();
  }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
