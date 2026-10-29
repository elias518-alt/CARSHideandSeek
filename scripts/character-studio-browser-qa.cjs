// Actual wardrobe and profile UI with local account/membership fixtures.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),output=process.env.CHS_QA_OUTPUT||'/tmp/chs-character-qa';fs.mkdirSync(output,{recursive:true});
let stub=fs.readFileSync(path.join(repo,'scripts/community-ui-qa.mjs'),'utf8').match(/const stub=`([\s\S]*?)`;/)[1];
stub+=`;const originalClient=window.supabase.createClient;window.supabase.createClient=function(){const client=originalClient(),rpc=client.rpc;client.auth.refreshSession=async()=>({data:{}});window.qaUploads=[];window.qaRemovals=[];client.storage.from=()=>({upload:async()=>{qaUploads.push(1);throw Error('Unexpected photo upload');},remove:async paths=>{if(window.qaRemoveError)return {error:{message:'offline'}};qaRemovals.push(...paths);return {data:paths};}});client.rpc=async(name,args)=>name==='chs_plus_read'?{data:{active:window.qaPlus===true,accent:'orange',server_time:new Date().toISOString(),expires_at:null}}:rpc(name,args);return client;};`;
(async()=>{
 const server=http.createServer(require(path.join(repo,'server')).handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page,checks=0;const check=(v,m)=>{if(!v)throw Error(m);checks++;};
 try{
  browser=await chromium.launch({executablePath:process.env.CHS_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of [360,390,1000]){
   page=await browser.newPage({viewport:{width,height:900}});const errors=[],modelLoads=[];let metadata={},appearance,pet,saveCount=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/face-api/'))modelLoads.push(r.url());});
   await page.route('**/supabase-js-*.js',r=>r.fulfill({contentType:'text/javascript',body:stub}));await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',async r=>{
    const action=new URL(r.request().url()).pathname.split('/').pop();if(action==='wardrobe-access')return r.fulfill({json:{plus:await page.evaluate(()=>qaPlus===true)}});
    if(['wardrobe-save','pets-save'].includes(action)){
     if(await page.evaluate(()=>window.qaSaveRejected))return r.fulfill({status:403,json:{error:'PLUS abgelaufen'}});
     if(action==='pets-save'&&await page.evaluate(()=>window.qaHoldPetSave)){await page.evaluate(()=>window.qaPetSaveSeen=true);await page.waitForFunction(()=>window.qaReleasePetSave===true);}
     const data=r.request().postDataJSON();if(action==='wardrobe-save'){appearance=data.appearance;metadata.chs_appearance=appearance;}else{pet=data.pet;metadata.chs_pet=pet;saveCount++;}
     return r.fulfill({json:{user:{id:'11111111-1111-4111-8111-111111111111',user_metadata:metadata}}});
    }
    return r.fulfill({json:action==='account-status'?{accepted:true,banned:false,admin:false,onboardingRequired:false,legal:{ready:true}}:action==='invites'?{invites:[]}:action==='rejoin-lookup'?{code:null}:action==='ads-status'?{enabled:false,reward:{}}:{}});
   });
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));
   await page.evaluate(()=>accountUI.openWardrobe());check(await page.locator('[data-character-choice^=classic]').count()===3,'Three free originals retained');
   for(const id of ['alex','maya','nico','lea'])check(await page.locator('[data-character-choice='+id+']').getAttribute('aria-disabled')==='true',id+' locked for free accounts');
   await page.locator('#wardrobeDialog .dialogClose').click();await page.evaluate(()=>petUI.open());await page.locator('[data-pet-choice=husky]').click();check(await page.locator('#petsDialog button[type=submit]').isDisabled(),'Pet preview allowed, saving locked for free accounts');await page.locator('#petsDialog .dialogClose').click();
   await page.evaluate(async()=>{qaPlus=true;await plusUI.refresh();await accountUI.openWardrobe();});
   for(const id of ['alex','maya','nico','lea']){await page.locator('[data-character-choice='+id+']').click();const href=await page.locator('[data-wardrobe-preview] image').getAttribute('href');check(href.includes(id==='alex'?'alex.webp':id==='maya'?'maya.webp':'new-street.webp'),'Correct restored/new sprite '+id);}
   await page.locator('[data-studio-tab=top]').click();await page.locator('[data-look-key=top][data-look-value="2"]').click();check(await page.locator('[name=pants]').count()===0,'New figures offer honest complete outfits');await page.locator('[data-look-key=topColor][data-look-value=cream]').click();await page.locator('[data-look-key=pantsColor][data-look-value=navy]').click();await page.locator('[data-studio-tab=pose]').click();await page.locator('[data-look-key=winPose][data-look-value="1"]').click();check(await page.locator('[data-wardrobe-preview] .realisticCelebrating').count()===1,'Realistic winner preview');
   check(await page.locator('[data-photo-file]').count()===0,'No unsupported selfie overlay');check(await page.locator('.wardrobeAvatar').count()===0,'No rejected vector avatars');
   await page.locator('#wardrobeDialog').evaluate(e=>e.scrollTop=0);await page.locator('#wardrobeDialog').screenshot({path:output+'/realistic-wardrobe-'+width+'.png'});
   await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});check(appearance.version===6&&appearance.figure==='lea'&&appearance.top===2&&appearance.topColor==='cream','Realistic look saved');
   for(const [figure,gender]of [['luca','male'],['mia','female']]){
    await page.evaluate(()=>accountUI.openWardrobe());await page.locator('[data-character-choice='+figure+']').click();
    await page.locator('[data-studio-tab=top]').click();check(await page.locator('[data-look-key=top]').count()===12,'Twelve new tops '+gender);
    await page.locator('[data-look-key=top][data-look-value="5"]').click();await page.locator('[data-look-key=topColor][data-look-value=black]').click();
    await page.locator('[data-studio-tab=pants]').click();check(await page.locator('[data-look-key=pants]').count()===12,'Twelve independent bottoms '+gender);
    await page.locator('[data-look-key=pants][data-look-value="9"]').click();await page.locator('[data-look-key=pantsColor][data-look-value=gray]').click();
    await page.locator('[data-studio-tab=accessories]').click();for(const [key,value]of [['jewelry','silver'],['glasses','true'],['earrings','true'],['watch','true']])await page.locator('[data-look-key='+key+'][data-look-value='+value+']').click();
    await page.locator('[data-studio-tab=shoes]').click();await page.locator('[data-look-key=shoeColor][data-look-value=cream]').click();
    if(width===390)await page.locator('[data-wardrobe-preview]').screenshot({path:output+'/extended-'+gender+'.png'});
    await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});
    check(appearance.figure===figure&&appearance.top===5&&appearance.pants===9&&appearance.topColor==='black'&&appearance.pantsColor==='gray'&&appearance.shoeColor==='cream'&&appearance.glasses&&appearance.watch&&appearance.jewelry==='silver','Independent outfit persisted '+gender);
   }
   await page.evaluate(()=>accountUI.openWardrobe());await page.locator('[data-character-choice=lea]').click();await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});
   await page.evaluate(()=>petUI.open());
   for(const [category,ids]of [['Hunde',['shepherd','husky','doberman']],['Katzen',['bengal','shorthair']],['Weitere Tiere',['parrot','fish','hamster','horse','monkey','donkey']]]){
    await page.locator('[data-pet-category="'+category+'"]').click();
    for(const id of ids){await page.locator('[data-pet-choice='+id+']').click();check(await page.locator('[data-pet-preview] [data-pet='+id+']').count()===1,'Pet preview '+id);for(const name of ['coat','eyes','size','flip'])check(await page.locator('#petsDialog [data-pet-field='+name+']').count()>=2,id+' configurable '+name);}
   }
   await page.locator('[data-pet-category=Katzen]').click();await page.locator('[data-pet-choice=shorthair]').click();await page.locator('[data-pet-field=coat][data-pet-value="chocolate"]').click();await page.locator('[data-pet-field=eyes][data-pet-value="blue"]').click();await page.locator('[data-pet-field=stance][data-pet-value="1"]').click();await page.locator('[data-pet-field=flip][data-pet-value="1"]').click();
   check(!await page.locator('#petsDialog').evaluate(e=>e.scrollWidth>e.clientWidth+2),'Pet studio fits mobile width');await page.locator('#petsDialog').evaluate(e=>e.scrollTop=0);await page.locator('#petsDialog').screenshot({path:output+'/pets-'+width+'.png'});
   await page.evaluate(()=>qaSaveRejected=true);await page.locator('#petsDialog button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#petsDialog [role=alert]').textContent.includes('abgelaufen'));check(saveCount===0,'Rejected save leaves account unchanged');check(!await page.locator('#petsDialog button[type=submit]').isDisabled(),'Retry enabled after failure');await page.evaluate(()=>qaSaveRejected=false);
   await page.locator('#petsDialog button[type=submit]').click();await page.locator('#petsDialog').waitFor({state:'hidden'});check(pet.breed==='shorthair'&&pet.coat==='chocolate'&&pet.eyes==='blue'&&pet.stance===1&&pet.flip,'Independent pet configuration persisted');check(await page.evaluate(()=>accountUI.appearance().figure)==='lea','Saving pet preserves character');
   await page.evaluate(()=>{localGarage=[{id:'qa',brand:'BMW',model:'M2',year:2024,series:'G87',body:'Coupé',color:'Blau',active:true}];syncVehicleUI();openPage('home');referenceUI.renderOwn();});await page.waitForTimeout(150);
   check(await page.locator('#homeOwnScene .petCompanion').count()===1,'Pet visible beside car');check(await page.locator('#homeOwnScene .wardrobeRealistic').count()===1,'Realistic figure beside car');await page.screenshot({path:output+'/realistic-home-'+width+'.png',fullPage:true});
   for(const breed of Object.keys(require(path.join(repo,'pets')).breeds)){
    await page.evaluate(breed=>{authSession.user.user_metadata.chs_pet=pets.normalize({breed});referenceUI.renderOwn();},breed);await page.waitForTimeout(30);
    const bounds=await page.locator('#homeOwnScene .petCompanion').evaluate(e=>{const r=e.getBoundingClientRect(),s=document.getElementById('homeOwnScene').getBoundingClientRect();return {r:r.toJSON(),s:s.toJSON()};});check(bounds.r.left>=bounds.s.left-1&&bounds.r.right<=bounds.s.right+1&&bounds.r.bottom<=bounds.s.bottom+1,'Companion stays inside scene '+breed);if(width===390&&['horse','fish','shepherd'].includes(breed))await page.screenshot({path:output+'/home-'+breed+'.png',fullPage:true});
   }
   const result=async(win,aborted=false)=>page.evaluate(({win,aborted})=>{const p={id:'me',role:'SEEKER',name:'Elias'};state={lobby:{me:p,players:[p],result:{players:[p],seekersWin:win,aborted}}};referenceUI.renderResult(state.lobby);},{win,aborted});
   await result(true);check(await page.locator('#referenceResultScene .realisticCelebrating').count()===1,'Winner celebrates');check(await page.locator('#referenceResultScene .petCompanion').count()===1,'Companion joins result');await page.evaluate(()=>{window.qaWinnerNode=document.querySelector('#referenceResultScene .realisticCelebrating');referenceUI.renderResult(state.lobby);});check(await page.evaluate(()=>qaWinnerNode===document.querySelector('#referenceResultScene .realisticCelebrating')),'Polling preserves scene');await result(false);check(await page.locator('#referenceResultScene .realisticCelebrating').count()===0,'Loser does not celebrate');await result(true,true);check(await page.locator('#referenceResultScene .realisticCelebrating').count()===0,'Aborted game does not celebrate');
   await page.evaluate(()=>accountUI.openWardrobe());await page.locator('[data-character-choice=alex]').click();await page.locator('[data-studio-tab=pants]').click();await page.locator('[data-look-key=pants][data-look-value="1"]').click();await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});check(await page.evaluate(()=>petUI.selection().breed)==='shorthair','Saving outfit preserves saved companion');
   await page.evaluate(async()=>{await petUI.open();qaPlus=false;await plusUI.refresh();});check(await page.locator('[data-pet-preview] .petCompanion').count()===0,'PLUS revocation clears pet preview');check(await page.locator('#homeOwnScene .petCompanion').count()===0,'PLUS revocation hides home pet');check(await page.locator('#referenceResultScene .petCompanion').count()===0,'PLUS revocation hides result pet');
   await page.locator('#petsDialog button[type=submit]').click();await page.locator('#petsDialog').waitFor({state:'hidden'});check(pet===null,'Free user can remove saved pet');
   if(width===360){
    await page.evaluate(async()=>{qaPlus=true;await plusUI.refresh();await petUI.open();qaHoldPetSave=true;});await page.locator('[data-pet-category=Hunde]').click();await page.locator('[data-pet-choice=husky]').click();
    const response=page.waitForResponse(r=>r.url().endsWith('/api/pets-save'));await page.locator('#petsDialog button[type=submit]').click();await page.waitForFunction(()=>window.qaPetSaveSeen===true);
    await page.evaluate(()=>{accountUI.closePrivateViews();authSession={user:{id:'different-account',user_metadata:{}}};qaReleasePetSave=true;});await response;await page.waitForTimeout(100);
    check(await page.evaluate(()=>authSession.user.id==='different-account'&&!authSession.user.user_metadata.chs_pet),'Delayed save cannot overwrite a different account');check(await page.locator('#petsDialog').count()===0,'Logout disposes private pet editor');
   }
   check(modelLoads.length===0,'No face analysis libraries loaded');check(errors.length===0,'No browser errors '+errors.join(';'));await page.close();
  }
  console.log(JSON.stringify({checks,status:'passed',output}));
 }catch(error){if(page&&!page.isClosed()){console.error(await page.evaluate(()=>({wardrobeError:document.querySelector('#wardrobeDialog [role=alert]')?.textContent,petError:document.querySelector('#petsDialog [role=alert]')?.textContent})));await page.screenshot({path:output+'/failure.png'});}throw error;}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
