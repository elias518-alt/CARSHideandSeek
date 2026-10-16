// Actual wardrobe and profile UI with local account/membership fixtures.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),output=process.env.CHS_QA_OUTPUT||'/tmp/chs-character-qa';fs.mkdirSync(output,{recursive:true});
let stub=fs.readFileSync(path.join(repo,'scripts/community-ui-qa.mjs'),'utf8').match(/const stub=`([\s\S]*?)`;/)[1];
stub+=`;const originalClient=window.supabase.createClient;window.supabase.createClient=function(){const client=originalClient(),rpc=client.rpc;client.auth.refreshSession=async()=>({data:{}});window.qaUploads=[];window.qaRemovals=[];client.storage.from=()=>({upload:async(path,blob)=>{if(window.qaUploadError)return {error:{message:'offline'}};const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const bitmap=await createImageBitmap(blob);window.qaUploads.push({path,size:blob.size,type:blob.type,width:bitmap.width,height:bitmap.height,data:btoa(binary)});return {data:{path}};},remove:async paths=>{if(window.qaRemoveError)return {error:{message:'offline'}};window.qaRemovals.push(...paths);return {data:paths};}});client.rpc=async(name,args)=>name==='chs_plus_read'?{data:{active:window.qaPlus===true,accent:'orange',server_time:new Date().toISOString(),expires_at:null}}:rpc(name,args);return client;};`;
(async()=>{
 const server=http.createServer(require(path.join(repo,'server')).handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,checks=0;const check=(v,m)=>{if(!v)throw Error(m);checks++;};
 try{
  browser=await chromium.launch({executablePath:process.env.CHS_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of process.env.CHS_PIXELS_ONLY?[]:process.env.CHS_QA_WIDTH?[Number(process.env.CHS_QA_WIDTH)]:[360,390,1000]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];let saved=null;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2',r=>r.fulfill({contentType:'text/javascript',body:stub}));
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',async r=>{
    const action=new URL(r.request().url()).pathname.split('/').pop();
    if(action==='wardrobe-access')return r.fulfill({json:{plus:await page.evaluate(()=>window.qaPlus===true)}});
    if(action==='wardrobe-save'&&await page.evaluate(()=>window.qaSaveRejected))return r.fulfill({status:403,json:{error:'PLUS abgelaufen'}});
    if(action==='wardrobe-save'){saved=r.request().postDataJSON().appearance;return r.fulfill({json:{user:{id:'11111111-1111-4111-8111-111111111111',user_metadata:{chs_appearance:saved}}}});}
    return r.fulfill({json:action==='account-status'?{accepted:true,banned:false,admin:false,onboardingRequired:false,legal:{ready:true}}:action==='invites'?{invites:[]}:action==='rejoin-lookup'?{code:null}:action==='ads-status'?{enabled:false,reward:{}}:{}});
   });
   await page.route('**/storage/v1/object/public/profile-images/**',async r=>{const photo=await page.evaluate(url=>window.qaUploads.find(u=>url.endsWith(u.path)),r.request().url());return photo?r.fulfill({contentType:'image/png',body:Buffer.from(photo.data,'base64')}):r.abort();});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));
   await page.evaluate(()=>accountUI.openWardrobe());
   check(await page.locator('[data-character-choice^=classic]').count()===3,'All three free figures');
   check(await page.locator('[data-character-choice=male]').isDisabled()&&await page.locator('[data-character-choice=female]').isDisabled(),'PLUS locked');
   for(let classic=0;classic<3;classic++){
    await page.locator('[data-character-choice=classic-'+classic+']').click();
    check(await page.locator('[data-wardrobe-preview] .lobbyCrewCharacter--'+classic).count()===1,'Free selection '+classic);
   }
   await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});
   check(saved?.collection==='classic'&&saved?.classic===2,'Free figure persisted');
   await page.evaluate(async()=>{window.qaPlus=true;await plusUI.refresh();await accountUI.openWardrobe();});
   await page.locator('[data-character-choice=female]').click();await page.locator('[name=top]').selectOption('2');await page.locator('[name=pants]').selectOption('0');await page.locator('[name=topColor]').selectOption('cream');await page.locator('[name=pantsColor]').selectOption('black');
   check(await page.locator('[data-wardrobe-preview] [data-character=female][data-top="2"][data-pants="0"]').count()===1,'Studio outfit preview');
   check(!(await page.locator('#wardrobeDialog').textContent()).match(/Quaternius|NoEdge/),'Technical names removed');
   check(!await page.locator('#wardrobeDialog').evaluate(e=>e.scrollWidth>e.clientWidth+2),'Wardrobe overflow');
   await page.locator('#wardrobeDialog').evaluate(el=>el.scrollTop=0);await page.locator('#wardrobeDialog').screenshot({path:output+'/wardrobe-'+width+'.png'});
   // A synthetic upload fixture cropped locally from our own generated character art.
   const portrait=await page.evaluate(async()=>{const im=new Image();im.src='assets/characters/studio/alex.webp';await im.decode();const c=document.createElement('canvas');c.width=240;c.height=320;c.getContext('2d').drawImage(im,138,25,72,96,0,0,240,320);return c.toDataURL('image/png').split(',')[1];});
   const photoFile={name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(portrait,'base64')};
   await page.locator('[data-photo-file]').setInputFiles(photoFile);
   await page.waitForFunction(()=>document.querySelector('[data-wardrobe-preview] [data-studio-face]')?.getAttribute('href').startsWith('blob:'));
   check(await page.evaluate(()=>qaUploads.length)===0,'Photo stays local before confirmation');
   check(await page.locator('[data-photo-capture]').getAttribute('capture')==='user','Mobile camera uses front camera chooser');
   await page.locator('#wardrobeDialog button[type=submit]').click();
   check((await page.locator('#wardrobeDialog [role=alert]').textContent()).includes('Veröffentlichung'),'Photo requires explicit publishing confirmation');
   await page.locator('[data-crop=zoom]').fill('1.2');await page.locator('[data-crop=rotation]').fill('4');
   await page.locator('[data-face-adjust=x]').fill('2');await page.locator('[data-photo-consent]').check();
   await page.waitForTimeout(150);
   await page.evaluate(()=>window.qaUploadError=true);await page.locator('#wardrobeDialog button[type=submit]').click();
   await page.waitForFunction(()=>document.querySelector('#wardrobeDialog [role=alert]').textContent.includes('hochgeladen'));
   check(await page.evaluate(()=>qaUploads.length)===0,'Failed storage upload does not save look');
   await page.evaluate(()=>{window.qaUploadError=false;window.qaSaveRejected=true;});await page.locator('#wardrobeDialog button[type=submit]').click();
   await page.waitForFunction(()=>window.qaRemovals.length===1);
   check(await page.evaluate(()=>qaRemovals[0]===qaUploads[0].path),'Explicit server rejection rolls back uploaded crop');
   await page.evaluate(()=>window.qaSaveRejected=false);
   await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});
   check(saved?.gender==='female'&&saved?.top===2&&saved?.pants===0&&saved?.topColor==='cream'&&saved?.pantsColor==='black','Studio customization persisted');
   check(await page.locator('#homeOwnScene .wardrobeStudio').count()===1,'Saved character displayed at home');
   check(saved?.face?.x===2&&saved.face.path.startsWith('11111111-1111-4111-8111-111111111111/character-face-'),'Own photo and alignment persisted');
   const uploaded=await page.evaluate(()=>qaUploads.at(-1));check(uploaded.type==='image/png'&&uploaded.width===192&&uploaded.height===256&&uploaded.size<196608,'Only bounded raster crop uploaded');
   check(await page.locator('#homeOwnScene [data-studio-face]').count()===1,'Saved face shown at home');
   await page.evaluate(()=>accountUI.openWardrobe());await page.locator('[data-photo-remove]').click();
   await page.evaluate(()=>window.qaRemoveError=true);await page.locator('#wardrobeDialog button[type=submit]').click();
   await page.waitForFunction(()=>document.querySelector('#wardrobeDialog [role=alert]').textContent.includes('gelöscht'));
   check(saved.face===null,'Removing photo clears appearance even if storage temporarily fails');
   await page.evaluate(()=>window.qaRemoveError=false);await page.locator('#wardrobeDialog button[type=submit]').click();await page.locator('#wardrobeDialog').waitFor({state:'hidden'});
   check(await page.evaluate(path=>qaRemovals.includes(path),uploaded.path),'Retry deletes old stored photo');
   await page.evaluate(()=>accountUI.openWardrobe());await page.locator('[data-photo-capture]').setInputFiles(photoFile);
   await page.waitForFunction(()=>document.querySelector('[data-wardrobe-preview] [data-studio-face]')?.getAttribute('href').startsWith('blob:'));
   const beforeCancel=await page.evaluate(()=>qaUploads.length);await page.locator('#wardrobeDialog .dialogClose').click();
   check(await page.evaluate(()=>qaUploads.length)===beforeCancel,'Cancel camera photo never uploads');

   await page.evaluate(()=>{localGarage=[{id:'car-a',brand:'BMW',model:'328i',year:1996,series:'E36',body:'Coupé',color:'Blau',active:true}];syncVehicleUI();openPage('profile');});
   const geometry=await page.evaluate(()=>{const car=document.getElementById('profileVehicleStage'),progress=document.querySelector('#profile .profileProgress'),svg=car.querySelector('svg');return {car:car.getBoundingClientRect().toJSON(),progress:progress.getBoundingClientRect().toJSON(),align:svg?.getAttribute('preserveAspectRatio'),shadow:getComputedStyle(car,'::before').content};});
   check(geometry.align==='xMidYMax meet','Profile tyres aligned to floor');check(geometry.shadow!=='none','Profile contact shadow');
   check(geometry.car.bottom<=geometry.progress.top+8,'Profile car overlaps progress');
   await page.screenshot({path:output+'/profile-'+width+'.png',fullPage:true});
   await page.evaluate(()=>openPage('home'));await page.screenshot({path:output+'/home-'+width+'.png',fullPage:true});
   await page.evaluate(async()=>{await accountUI.openWardrobe();window.qaPlus=false;await plusUI.refresh();});
   check(await page.locator('[data-character-choice=male]').isDisabled(),'Revoked PLUS locks immediately');
   check(await page.locator('[data-wardrobe-preview] .wardrobeStudio').count()===0,'Revoked PLUS restores free preview');
   check(await page.locator('#homeOwnScene .wardrobeStudio').count()===0,'Revoked PLUS restores home figure');
   check(errors.length===0,'Browser errors '+errors.join(';'));await page.close();
  }
  const page=await browser.newPage({viewport:{width:1200,height:900}});await page.goto('http://127.0.0.1:'+server.address().port+'/manifest.json');
  await page.setContent('<style>body{background:#182331;color:white;font:14px system-ui}main{display:grid;grid-template-columns:repeat(6,1fr)}svg{height:420px;width:180px}.wardrobeStudio{display:block}</style><main></main>');
  await page.addScriptTag({path:path.join(repo,'character-studio.js')});
  const pixels=await page.evaluate(async atlases=>{
   const renders=[];for(const gender of ['male','female'])for(let top=0;top<3;top++)for(let pantsIndex=0;pantsIndex<3;pantsIndex++){const outfit=top,atlas=atlases[gender];
    const raster=async(topColor,pantsColor,raw=false)=>{const d=document.createElement('div');d.innerHTML=characterStudio.render({gender,top,pants:pantsIndex,topColor,pantsColor});const svg=d.querySelector('svg');if(raw)svg.querySelector('image').removeAttribute('filter');svg.setAttribute('width','256');svg.setAttribute('height','740');svg.querySelector('image').setAttribute('href',atlas);const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await img.decode();const c=document.createElement('canvas');c.width=256;c.height=740;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,256,740).data;};
    const raw=await raster('black','black',true),dark=await raster('black','black'),shirt=await raster('white','black'),pants=await raster('black','white');let topChanges=0,pantsChanges=0,faceChanges=0,skinSamples=0;
    for(let i=0;i<dark.length;i+=4){const y=Math.floor(i/4/256);const a=Math.abs(dark[i]-shirt[i]),b=Math.abs(dark[i]-pants[i]);if(a>20)topChanges++;if(b>20)pantsChanges++;if(raw[i+3]>240&&raw[i]>80&&raw[i]>raw[i+1]+15&&raw[i+1]>raw[i+2]+8){skinSamples++;if(a>8||b>8)faceChanges++;}}
    renders.push({gender,top,pants:pantsIndex,topChanges,pantsChanges,faceChanges,skinSamples});
   }
   document.querySelector('main').innerHTML=['male','female'].flatMap(gender=>[0,1,2].flatMap(top=>[0,1,2].map(pants=>'<article>'+characterStudio.render({gender,top,pants,topColor:['black','green','cream'][top],pantsColor:'navy'})+'</article>'))).join('');document.querySelectorAll('article').forEach(el=>el.querySelector('image').setAttribute('href',atlases[el.querySelector('.wardrobeStudio').dataset.character]));return renders;
  },Object.fromEntries([['male','alex'],['female','maya']].map(([gender,file])=>[gender,'data:image/webp;base64,'+fs.readFileSync(path.join(repo,'assets/characters/studio/'+file+'.webp')).toString('base64')])));
  await page.screenshot({path:output+'/studio-looks.png'});
  for(const p of pixels){check(p.topChanges>3000&&p.pantsChanges>3000,'Clothing colors change '+JSON.stringify(p));check(p.skinSamples>300&&p.faceChanges<30,'Skin/face recolored '+JSON.stringify(p));}
  await page.close();console.log(JSON.stringify({checks,status:'passed',pixels,output}));
 }catch(error){for(const context of browser?.contexts()||[])for(const page of context.pages()){console.error(await page.evaluate(()=>({error:document.querySelector('#wardrobeDialog [role=alert]')?.textContent,preview:document.querySelector('[data-wardrobe-preview]')?.innerHTML?.slice(-600),cameraDisabled:document.querySelector('[data-photo-capture]')?.disabled,plus:window.plusUI?.active})));await page.screenshot({path:output+'/failure.png'});}throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
