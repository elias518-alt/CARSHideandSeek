// Actual wardrobe and profile UI with local account/membership fixtures.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),output=process.env.CHS_QA_OUTPUT||'/tmp/chs-character-qa';fs.mkdirSync(output,{recursive:true});
let stub=fs.readFileSync(path.join(repo,'scripts/community-ui-qa.mjs'),'utf8').match(/const stub=`([\s\S]*?)`;/)[1];
stub+=`;const originalClient=window.supabase.createClient;window.supabase.createClient=function(){const client=originalClient(),rpc=client.rpc;client.auth.refreshSession=async()=>({data:{}});window.qaUploads=[];window.qaRemovals=[];client.storage.from=()=>({upload:async()=>{qaUploads.push(1);throw Error('Unexpected photo upload');},remove:async paths=>{if(window.qaRemoveError)return {error:{message:'offline'}};qaRemovals.push(...paths);return {data:paths};}});client.rpc=async(name,args)=>name==='chs_plus_read'?{data:{active:window.qaPlus===true,accent:'orange',server_time:new Date().toISOString(),expires_at:null}}:rpc(name,args);return client;};`;
(async()=>{
 const server=http.createServer(require(path.join(repo,'server')).handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,checks=0;const check=(v,m)=>{if(!v)throw Error(m);checks++;};
 try{
  browser=await chromium.launch({executablePath:process.env.CHS_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [360,390,1000]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[],models=[];let saved;
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/face-api/'))models.push(r.url());});
   await page.route('**/supabase-js@2',r=>r.fulfill({contentType:'text/javascript',body:stub}));
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',async r=>{
    const action=new URL(r.request().url()).pathname.split('/').pop();
    if(action==='wardrobe-access')return r.fulfill({json:{plus:await page.evaluate(()=>window.qaPlus===true)}});
    if(action==='wardrobe-save'&&await page.evaluate(()=>window.qaSaveRejected))return r.fulfill({status:403,json:{error:'PLUS abgelaufen'}});
    if(action==='wardrobe-save'){saved=r.request().postDataJSON().appearance;return r.fulfill({json:{user:{id:'11111111-1111-4111-8111-111111111111',user_metadata:{chs_appearance:saved}}}});}
    return r.fulfill({json:action==='account-status'?{accepted:true,banned:false,admin:false,onboardingRequired:false,legal:{ready:true}}:action==='invites'?{invites:[]}:action==='rejoin-lookup'?{code:null}:action==='ads-status'?{enabled:false,reward:{}}:{}});
   });
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));
   await page.evaluate(()=>accountUI.openWardrobe());
   check(await page.locator('[data-character-choice^=classic]').count()===3,'Three free figures');check(await page.locator('[data-character-choice=male]').isDisabled(),'PLUS locked');check(models.length===0,'Models lazy loaded');
   await page.locator('[data-character-choice=classic-2]').click();await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});check(saved.classic===2,'Free look saved');
   await page.evaluate(async()=>{qaPlus=true;await plusUI.refresh();await accountUI.openWardrobe();});await page.locator('[data-character-choice=female]').click();
   for(const [key,count]of [['top',8],['pants',6],['shoes',4],['pose',5],['winPose',3]]){
    check(await page.locator('[name='+key+'] option').count()===count,key+' options');
    for(let i=0;i<count;i++){await page.locator('[name='+key+']').selectOption(String(i));check(await page.locator('[name='+key+']').inputValue()===String(i),key+' '+i);}
   }
   check(await page.locator('[data-wardrobe-preview] .avatarCelebrating[data-pose="7"]').count()===1,'Victory preview');
   await page.locator('[data-section=colors] summary').click();await page.locator('[name=topColor]').selectOption('pink');await page.locator('[name=pantsColor]').selectOption('black');await page.locator('[name=shoeColor]').selectOption('cream');
   await page.locator('[data-section=face] summary').click();await page.locator('[name=trait-hair]').selectOption('5');await page.locator('[name=trait-glasses]').selectOption('1');
   check(!await page.locator('#wardrobeDialog').evaluate(e=>e.scrollWidth>e.clientWidth+2),'No horizontal overflow');
   const portrait=await page.evaluate(async()=>{const im=new Image();im.src='assets/characters/studio/alex.webp';await im.decode();const c=document.createElement('canvas');c.width=240;c.height=320;c.getContext('2d').drawImage(im,132,11,86,111,0,0,240,320);return c.toDataURL('image/png').split(',')[1];});
   await page.locator('[data-photo-file]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(portrait,'base64')});
   await page.waitForFunction(()=>document.querySelector('[data-avatar-status]').textContent.includes('bereit'),{},{timeout:60000});
   if(width===360){
    const blank=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=240;c.getContext('2d').fillRect(0,0,240,240);return c.toDataURL('image/png').split(',')[1];});
    await page.locator('[data-photo-file]').setInputFiles({name:'blank.png',mimeType:'image/png',buffer:Buffer.from(blank,'base64')});
    await page.waitForFunction(()=>document.querySelector('#wardrobeDialog [role=alert]').textContent.includes('Kein klares Gesicht'));
    check(!await page.locator('[data-photo-gallery]').isDisabled(),'Invalid photo allows retry/manual editing');
   }
   check(models.filter(u=>u.endsWith('.bin')).length===2,'Both local detector models loaded');check(models.every(u=>u.startsWith('http://127.0.0.1:')),'Analysis entirely same origin');
   check(await page.locator('[data-photo-capture]').getAttribute('capture')==='user','Front camera');check(await page.locator('[data-wardrobe-preview] image').count()===0,'No photograph in avatar');
   await page.locator('#wardrobeDialog').evaluate(e=>e.scrollTop=0);await page.locator('#wardrobeDialog').screenshot({path:output+'/wardrobe-'+width+'.png'});
   await page.evaluate(()=>qaSaveRejected=true);await page.locator('#wardrobeDialog button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#wardrobeDialog [role=alert]').textContent.includes('abgelaufen'));
   check(await page.locator('#wardrobeDialog').isVisible(),'Rejected save stays open');await page.evaluate(()=>qaSaveRejected=false);
   await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});
   check(saved.version===5&&saved.top===7&&saved.pants===5&&saved.shoes===3&&saved.pose===4&&saved.winPose===2,'All choices persisted');check(saved.traits.hair===5&&saved.traits.glasses&&saved.traits.eyeSpacing!==1,'Real landmarks produce bounded traits and preserve manual choices');check(saved.face===null&&!JSON.stringify(saved).includes('data:'),'Only parameters saved');check(await page.evaluate(()=>qaUploads.length)===0,'No image upload');
   await page.evaluate(()=>{localGarage=[{id:'qa',brand:'BMW',model:'M2',year:2024,series:'G87',body:'Coupé',color:'Blau',active:true}];syncVehicleUI();openPage('home');referenceUI.renderOwn();});
   await page.screenshot({path:output+'/home-'+width+'.png',fullPage:true});
   const result=async(role,seekersWin,eliminated=false,found=false)=>page.evaluate(args=>{const p={id:'me',name:'Elias',...args};state={lobby:{me:p,players:[p],result:{players:[p],seekersWin:args.seekersWin}}};referenceUI.renderResult(state.lobby);}, {role,seekersWin,eliminated,found});
   for(const [role,seekersWin,eliminated,found,expected] of [['HIDER',false,false,false,1],['HIDER',true,false,false,0],['HIDER',false,true,false,0],['HIDER',false,false,true,0],['SEEKER',true,false,false,1],['SEEKER',false,false,false,0]]){await result(role,seekersWin,eliminated,found);check(await page.locator('#referenceResultScene .avatarCelebrating').count()===expected,'Result celebration '+[role,seekersWin,eliminated,found]);}
   await result('SEEKER',true);await page.evaluate(()=>{window.qaWinnerNode=document.querySelector('#referenceResultScene .avatarCelebrating');referenceUI.renderResult(state.lobby);});check(await page.evaluate(()=>qaWinnerNode===document.querySelector('#referenceResultScene .avatarCelebrating')),'Polling does not restart victory animation');
   // Old raw photos disappear immediately; deletion can be retried after storage failure.
   await page.evaluate(async()=>{authSession.user.user_metadata.chs_appearance.face={path:authSession.user.id+'/character-face-22222222-2222-4222-8222-222222222222.png'};await accountUI.openWardrobe();qaRemoveError=true;});
   check(await page.locator('.avatarMigration').count()===1,'Legacy migration explained');await page.locator('#wardrobeDialog button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#wardrobeDialog [role=alert]').textContent.includes('gelöscht'));
   await page.evaluate(()=>qaRemoveError=false);await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});check(await page.evaluate(()=>qaRemovals.length)===1,'Old photo removed');
   await result('SEEKER',true);await page.evaluate(async()=>{await accountUI.openWardrobe();window.qaOriginalAnalysis=selfieAvatar.analyze;selfieAvatar.analyze=()=>new Promise(resolve=>window.qaResolveAnalysis=resolve);});
   await page.locator('[data-photo-capture]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(portrait,'base64')});await page.waitForFunction(()=>typeof qaResolveAnalysis==='function');
   await page.evaluate(async()=>{qaPlus=false;await plusUI.refresh();qaResolveAnalysis({skin:5});selfieAvatar.analyze=qaOriginalAnalysis;});
   check(await page.locator('[data-wardrobe-preview] .wardrobeAvatar').count()===0,'Late analysis cannot restore revoked PLUS look');
   check(await page.locator('[data-character-choice=male]').isDisabled(),'Revocation locks editor');check(await page.locator('#homeOwnScene .wardrobeAvatar').count()===0,'Revocation restores free home character');check(await page.locator('#referenceResultScene .avatarCelebrating').count()===0,'Revocation removes celebration');
   check(errors.length===0,'No browser errors: '+errors.join(';'));await page.close();
  }
  console.log(JSON.stringify({checks,status:'passed',output}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
