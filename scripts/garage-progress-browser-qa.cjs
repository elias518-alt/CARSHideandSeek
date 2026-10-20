// Real app/assets; account, progression and API responses are local fixtures.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),out=process.env.CHS_QA_OUTPUT||'/tmp/chs-garage-progress';
const stub=fs.readFileSync(path.join(repo,'scripts/community-ui-qa.mjs'),'utf8').match(/const stub=`([\s\S]*?)`;/)[1];
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer(require('../server').handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser,checks=0;
 const check=(value,label)=>{assert.ok(value,label);checks++;};
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [360,390,430,1024]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2',r=>r.fulfill({contentType:'text/javascript',body:stub}));
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',r=>{const action=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({json:action==='account-status'?{accepted:true,legal:{ready:true}}:action==='vehicle-rewards'?{level:3,loadouts:{}}:action==='personal-stats'?{seekerRounds:2,hiderRounds:3}:action==='invites'?{invites:[]}:action==='ads-status'?{enabled:false,reward:{}}:{}});});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));
   await page.evaluate(async()=>{
    const holder=document.createElement('div');holder.innerHTML=vehicleIllustration({brand:'BMW',model:'M2',year:2024,series:'G87',color:'Blau'},'home-hero');
    const svg=holder.querySelector('svg');
    for(const node of svg.querySelectorAll('image')){
     const blob=await(await fetch(node.getAttribute('href'))).blob();
     const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});node.setAttribute('href',data);
    }
    svg.setAttribute('width',600);svg.setAttribute('height',300);
    const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await image.decode();
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=900;canvas.getContext('2d').drawImage(image,150,300,600,300);
    window.qaGaragePhoto=canvas.toDataURL('image/png');
    localGarage=[
     {id:'photo',brand:'BMW',model:'M2',series:'G87',year:2024,color:'Blau',photo:qaGaragePhoto,active:true},
     {id:'atlas',brand:'BMW',model:'3er',series:'E36',year:1996,color:'Silber'},
     {id:'mini',brand:'Mini',model:'Cooper S',year:2020,color:'Rot'}
    ];
    dbProfile.level=3;dbProfile.xp=2500;dbProfile.rounds_played=4;
    achievementCatalog=[{id:'ROUNDS_5',name:'Warmgefahren',description:'Schließe 5 Runden ab.',xp_reward:100,condition_field:'rounds_played',condition_target:5}];
    achievementUnlocked=new Set();renderAchievements();
    const original=supabaseClient.rpc;
    supabaseClient.rpc=async(name,args)=>{
     if(name==='chs_community_read')return {data:args.section==='progress'?{level:3,xp:2500,stats:{games:4,wins:1},rewards:[{id:'frame_copper',kind:'frame',value:'copper',label:'Kupferrahmen',level:5}]}:{rows:[],self:null,total:0}};
     return original(name,args);
    };
    syncVehicleUI();openPage('garage');
   });
   await page.waitForFunction(()=>document.querySelector('#garageShowroom .garageSceneCar [data-photo-fit=ready]'));
   check(await page.locator('.garageSceneCar svg image').getAttribute('href')===await page.evaluate(()=>qaGaragePhoto),'garage preserves uploaded photo');
   check(!await page.locator('.vehicleRewards').isVisible(),'tuning collapsed by default');
   check(await page.locator('#garageCars [data-edit-car=photo]').isVisible(),'selected car editable');
   check(await page.locator('#garageCars [data-car-photo=photo]').isVisible(),'photo upload reachable');
   check(await page.locator('.garageSelector button').count()===3,'all cars selectable');
   await page.screenshot({path:out+'/garage-photo-'+width+'.png',fullPage:true,animations:'disabled'});
   await page.locator('[data-garage-view=tuning]').click();
   check(await page.locator('.vehicleRewards').isVisible(),'tuning controls reachable');
   check(await page.locator('.garageSceneCar [data-showroom-photo]').count()===0,'explicit model tuning preview');
   check(await page.locator('[data-vehicle-reward=rims][data-value=graphite]').getAttribute('aria-disabled')==='true','higher level parts locked');
   await page.locator('[data-garage-view=vehicle]').click();
   await page.waitForFunction(()=>document.querySelector('.garageSceneCar [data-photo-fit=ready]'));
   check(await page.locator('.garageSceneCar svg image').getAttribute('href')===await page.evaluate(()=>qaGaragePhoto),'return restores same photo');
   await page.locator('[data-show-car=atlas]').click();
   check(await page.locator('#garageCars [data-car-id=atlas]').isVisible(),'activate non-active car reachable');
   check(await page.locator('#garageCars .garageCar:visible').count()===1,'only selected details shown');
   const clipping=await page.locator('#garageShowroom svg').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).overflow==='hidden'));
   check(clipping,'atlas neighbours clipped in hero and thumbnails');
   await page.screenshot({path:out+'/garage-model-'+width+'.png',fullPage:true,animations:'disabled'});
   await page.evaluate(()=>{openPage('profile');openProfileStatistics();});
   check((await page.locator('.statsUnlocks').innerText()).includes('Street Sport'),'stats show car unlocks');
   if(width===390)await page.locator('.statsUnlocks').screenshot({path:out+'/stats-unlocks-390.png',animations:'disabled'});
   await page.locator('.statsUnlocks [data-hub=progress]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.hubLevels>li').length===50);
   check((await page.locator('.hubLevels>li').nth(1).innerText()).includes('Velocity · Silber'),'level 2 silver rims');
   check((await page.locator('.hubLevels>li').nth(2).innerText()).includes('Ice Blue'),'level 3 glow');
   check((await page.locator('.hubLevels>li').nth(4).innerText()).includes('Street Sport'),'level 5 sport');
   check((await page.locator('.hubLevels>li').nth(7).innerText()).includes('Velocity · Graphit'),'level 8 graphite');
   check((await page.locator('.hubLevels>li').nth(4).innerText()).includes('Kupferrahmen'),'existing rewards retained');
   check((await page.locator('.hubLevels>li').nth(1).innerText()).includes('Freigeschaltet'),'car unlock not falsely equipped');
   await page.screenshot({path:out+'/progress-'+width+'.png',animations:'disabled'});
   if(width===390){await page.locator('.hubLevels>li').nth(1).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/level-unlocks-390.png',animations:'disabled'});}
   await page.locator('.hubLevels>li').nth(1).locator('[data-hub=garage]').click();
   check(await page.locator('dialog[open]').count()===0,'garage action closes nested dialogs');
   check(await page.locator('#garage').isVisible(),'garage destination');
   await page.evaluate(()=>{openPage('profile');document.querySelector('[data-achievement=ROUNDS_5]').click();});
   check((await page.locator('#badgeDetailsDialog').innerText()).includes('4 / 5'),'achievement uses real threshold');
   await page.locator('#badgeDetailsDialog .dialogClose').click();
   await page.evaluate(()=>{localGarage=[];syncVehicleUI();openPage('garage');});
   check((await page.locator('#garageCars').innerText()).includes('NOCH KEIN FAHRZEUG'),'empty garage remains usable');
   check(!await page.evaluate(()=>document.body.scrollWidth>innerWidth+2),'no page overflow');
   check(errors.length===0,errors.join(';'));
   await page.close();
  }
  console.log(JSON.stringify({status:'passed',checks,out}));
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
