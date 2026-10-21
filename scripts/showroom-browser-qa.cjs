// Visible-car regression: front-facing cutouts with large alpha margins, and catalog art.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),out=process.env.CHS_QA_OUTPUT||'/tmp/chs-showroom-qa';fs.mkdirSync(out,{recursive:true});
const stub=fs.readFileSync(path.join(repo,'scripts/community-ui-qa.mjs'),'utf8').match(/const stub=`([\s\S]*?)`;/)[1];
(async()=>{
 const server=http.createServer(require(path.join(repo,'server')).handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,checks=0;const check=(value,label)=>{if(!value)throw Error(label);checks++;};
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  for(const width of process.env.CHS_QA_WIDTH?[Number(process.env.CHS_QA_WIDTH)]:[360,390,568,1000]){
   const page=await browser.newPage({viewport:{width,height:width===360?640:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2',r=>r.fulfill({contentType:'text/javascript',body:stub}));
   await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(repo,'assets/crew-characters.png'))}));
   await page.route('**/api/**',r=>{const action=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({json:action==='account-status'?{accepted:true,legal:{ready:true}}:action==='invites'?{invites:[]}:action==='ads-status'?{enabled:false,reward:{}}:{}});});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.getElementById('homeGreeting').textContent.includes('Elias'));
   await page.evaluate(()=>{localStorage.setItem(lobbyBackgroundKey(),'alpine');accountUI.appearance=()=>({collection:'studio',gender:'male',top:0,pants:1});document.documentElement.style.setProperty('--personal-scene','url("assets/scenes/alpine.webp")');});
   // Rasterize our own shipped illustration into an intentionally badly padded saved photo.
   const photos=await page.evaluate(async()=>{
    const holder=document.createElement('div');holder.innerHTML=vehicleIllustration({brand:'BMW',model:'M2',year:2024,series:'G87',color:'Blau'},'home-hero');const svg=holder.querySelector('svg');
    for(const el of svg.querySelectorAll('image')){const blob=await (await fetch(el.getAttribute('href'))).blob();const data=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(blob);});el.setAttribute('href',data);}
    svg.setAttribute('width','600');svg.setAttribute('height','300');const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await im.decode();
    const c=document.createElement('canvas');c.width=900;c.height=900;const ctx=c.getContext('2d');ctx.drawImage(im,150,300,600,300);const padded=c.toDataURL('image/png');
    // A more front-facing aspect ratio, with visible tire contact and large transparent margins.
    ctx.clearRect(0,0,900,900);ctx.drawImage(im,250,230,400,330);const front=c.toDataURL('image/png');
    ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#65717b';ctx.fillRect(0,0,900,900);return {padded,front,opaque:c.toDataURL('image/png')};
   });
   for(const kind of ['catalog','padded','front','opaque']){
    await page.evaluate(({photo,kind})=>{localGarage=[{id:'qa',brand:'BMW',model:'M2',year:2024,series:'G87',body:'Coupé',color:'Blau',active:true,photo}];syncVehicleUI();openPage('home');referenceUI.renderOwn();}, {photo:photos[kind]||'',kind});
    if(kind!=='catalog')await page.waitForFunction(()=>document.querySelector('#homeOwnScene [data-photo-fit="ready"]'));
    await page.waitForFunction(()=>document.getElementById('homeOwnScene').dataset.showroomReady==='true');await page.waitForTimeout(100);
    const home=await page.evaluate(()=>{const host=document.getElementById('homeOwnScene'),figure=host.querySelector('figure'),person=host.querySelector('.lobbyCrewCharacter'),svg=figure.querySelector('svg');return {car:figure.getBoundingClientRect().toJSON(),person:person.getBoundingClientRect().toJSON(),stage:document.querySelector('#home .homeStage').getBoundingClientRect().toJSON(),greeting:document.querySelector('.referenceGreeting').getBoundingClientRect().toJSON(),viewBox:svg.getAttribute('viewBox'),overflow:document.body.scrollWidth>innerWidth+2,shadow:Number.parseFloat(getComputedStyle(host.querySelector('.parkingContactShadow')).bottom)};});
    check(!home.overflow,'Page overflow '+width);check(home.car.width>=home.stage.width*.4,'Visible car too small '+width+' '+kind);
    check(home.car.left>=home.stage.left-1&&home.car.right<=home.stage.right+1,'Car clipped');
    check(home.person.height<=home.car.height*1.1&&home.person.height<=home.car.width*.9+1,'Figure dominates vehicle '+JSON.stringify(home));
    check(home.person.bottom<=home.car.bottom&&home.car.bottom-home.person.bottom<30,'Different parking planes');
    check(home.car.top>=home.greeting.bottom-5,'Greeting overlap');check(home.car.bottom<=home.stage.bottom-15,'Tires below floor');
    if(kind==='padded'||kind==='front'){const box=home.viewBox.split(' ').map(Number);check(box[1]>150&&box[3]<500,'Saved photo padding not cropped');}
    if(kind==='front'||kind==='catalog')await page.screenshot({path:out+'/home-'+kind+'-'+width+'.png',fullPage:true});
    await page.evaluate(()=>openPage('profile'));
    if(kind!=='catalog')await page.waitForFunction(()=>document.querySelector('#profileVehicleStage [data-photo-fit="ready"]'));
    await page.waitForTimeout(100);
    const profile=await page.evaluate(()=>{const host=document.getElementById('profileVehicleStage'),figure=host.querySelector('figure');return {person:host.querySelector('.lobbyCrewCharacter')?.getBoundingClientRect().toJSON(),host:host.getBoundingClientRect().toJSON(),car:figure.getBoundingClientRect().toJSON(),progress:document.querySelector('#profile .profileProgress').getBoundingClientRect().toJSON(),shadowBottom:parseFloat(getComputedStyle(host,'::before').bottom),shadowWidth:parseFloat(getComputedStyle(host,'::before').width)};});
    check(Math.abs(profile.car.bottom-profile.host.bottom+18)<2,'Photo floats above contact plane');
    check(profile.person&&profile.person.top>=profile.host.top&&profile.person.bottom<=profile.host.bottom,'Profile character clipped');
    check(profile.car.top>=profile.host.top,'Profile car clipped');
    check(profile.shadowBottom===13&&profile.shadowWidth<profile.car.width,'Contact shadow detached or wider than car');
    check(profile.car.bottom<profile.progress.top,'Car covers profile progress');
    if(kind==='front'||kind==='catalog')await page.screenshot({path:out+'/profile-'+kind+'-'+width+'.png',fullPage:true});
   }
   if(width===390){
    const looks=[...Array.from({length:3},(_,classic)=>({collection:'classic',classic})),...['alex','maya','nico','lea'].map(figure=>({collection:'studio',figure}))];
    for(const look of looks){await page.evaluate(look=>{accountUI.appearance=()=>look;openPage('profile');referenceUI.renderOwn();},look);await page.waitForTimeout(50);
     const fitted=await page.evaluate(()=>{const stage=document.getElementById('profileVehicleStage').getBoundingClientRect(),figure=document.querySelector('#profileVehicleStage>.lobbyCrewCharacter').getBoundingClientRect();return figure.top>=stage.top&&Math.abs(figure.bottom-(stage.bottom-18))<2;});check(fitted,'Figure floor '+JSON.stringify(look));}
    const breeds=await page.evaluate(()=>Object.keys(pets.breeds));
    for(const breed of breeds){await page.evaluate(breed=>{petUI.selection=()=>pets.normalize({breed,size:2});referenceUI.renderOwn();},breed);await page.waitForTimeout(50);
     const fitted=await page.evaluate(()=>{const stage=document.getElementById('profileVehicleStage').getBoundingClientRect(),pet=document.querySelector('#profileVehicleStage>.petCompanion').getBoundingClientRect();return pet.top>=stage.top&&Math.abs(pet.bottom-(stage.bottom-18))<2;});check(fitted,'Pet floor '+breed);}
   }
   for(const scene of ['hangar','skyline']){await page.evaluate(scene=>{document.documentElement.style.setProperty('--personal-scene','url("assets/scenes/'+scene+'.webp")');localGarage[0].photo='';openPage('home');referenceUI.renderOwn();},scene);await page.waitForTimeout(100);if(width===390)await page.screenshot({path:out+'/home-'+scene+'.png',fullPage:true});}
   check(!errors.length,errors.join(';'));await page.close();
  }
  console.log(JSON.stringify({checks,status:'passed',out}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
