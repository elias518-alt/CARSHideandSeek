// Real frontend and MapLibre, synthetic users/GPS/RPCs and local map style.
// Database authorization is tested separately by social-map-sql-qa.mjs.
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),repo=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
const maplibre=process.env.CHS_QA_MAPLIBRE||require.resolve('maplibre-gl/dist/maplibre-gl.js');
const output=process.env.CHS_QA_OUTPUT||'/tmp/chs-social-map-qa';fs.mkdirSync(output,{recursive:true});
const server=http.createServer(require(repo+'server').handler);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser,checks=0;
const check=(value,message)=>{if(!value)throw Error(message);checks++;};
function fixture(){
 const id='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
 window.qa={id,peer,requests:[],gps:0,holdGps:false,denyGps:false,holdRead:false,failRead:false,failSave:false,settings:{mode:'off',revision:null,recipients:[]},own:null};
 Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,failure){qa.gps++;const deliver=()=>qa.denyGps?failure({code:1}):success({coords:{latitude:52.52,longitude:13.405,accuracy:20},timestamp:Date.now()});if(qa.holdGps)qa.deliverGps=deliver;else setTimeout(deliver,0);}}});
 const user={id,user_metadata:{}},profile={id,username:'Testspieler',player_tag:'QA',level:2,xp:1200,rounds_played:2,wins:1,finds:1,survived_rounds:1};
 const contact={user_id:peer,username:'Lea <img src=x onerror=alert(1)>',avatar_url:null,is_friend:true,is_crew:true};
 const mapData=()=>({server_time:new Date().toISOString(),paused:false,settings:structuredClone(qa.settings),contacts:[contact],own:structuredClone(qa.own),players:[{...contact,lat:52.525,lng:13.412,accuracy:30,measured_at:new Date(Date.now()-1200000).toISOString(),last_active_at:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+3600000).toISOString()}]});
 window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{user,access_token:'qa-token'}}}),onAuthStateChange:fn=>{qa.auth=fn;},signOut:async()=>{qa.auth('SIGNED_OUT',null);return {};},updateUser:async()=>({data:{user}})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})},from(table){const chain=new Proxy({},{get(_,key){if(key==='then')return resolve=>resolve({data:table==='profiles'?profile:[],error:null});return ()=>chain;}});return chain;},async rpc(name,args){
  if(name.startsWith('chs_social_map'))qa.requests.push({name,args:structuredClone(args)});
  if(name==='chs_social_map_read'){if(qa.failRead)return {error:{message:'Verbindung unterbrochen'}};const data=mapData();if(qa.holdRead)await new Promise(r=>qa.deliverRead=r);return {data};}
  if(name==='chs_social_map_action'){
   if(args.action==='settings'){if(qa.failSave)return {error:{message:'Speichern fehlgeschlagen'}};if(qa.holdSave)await new Promise(r=>qa.deliverSave=r);qa.settings={mode:args.payload.mode,recipients:args.payload.recipients,revision:crypto.randomUUID()};qa.own=null;return {data:{ok:true,...qa.settings}};}
   if(args.action==='publish'){if(qa.settings.mode==='off'||args.payload.revision!==qa.settings.revision)return {error:{message:'Freigabe geändert'}};qa.own={user_id:id,...args.payload,last_active_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};}return {data:{ok:true}};
  }
  if(name==='chs_social_overview_v2')return {data:[{...contact,peer_id:peer,request_id:'friend',status:'accepted',incoming:false,level:1,unread_count:0}]};
  if(name==='chs_community_read'){if(args.section==='crew')return {data:{crew:{id:'crew',name:'Testcrew',tag:'TEST',logo:'shield',join_mode:'OPEN',my_role:'MEMBER',points:1200},members:[{...contact,role:'MEMBER',points:1200}],invitations:[],requests:[],sent_invites:[]}};if(args.section==='progress')return {data:{...profile,rewards:[],stats:{}}};return {data:{rows:[],total:0,self:null}};}
  return {data:[]};
 }};}};
}
try{
 browser=await chromium.launch({executablePath:process.env.CHS_QA_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,360,430,1000]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase-js@2',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')()'}));
  await page.route('**/maplibre-gl@5.6.0/dist/maplibre-gl.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(maplibre)}));
  await page.route('**/maplibre-gl@5.6.0/dist/maplibre-gl.css',r=>r.fulfill({contentType:'text/css',body:fs.readFileSync(maplibre.replace(/\.js$/,'.css'))}));
  await page.route('https://tiles.openfreemap.org/**',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'qa-background',type:'background',paint:{'background-color':'#25303a'}}]}}));
  await page.route('**/api/**',r=>{const action=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({json:action==='account-status'?{accepted:true,banned:false,admin:false,onboardingRequired:false,legal:{ready:true}}:action==='invites'?{invites:[]}:action==='rejoin-lookup'?{code:null}:action==='personal-stats'?{}:{ok:true}});});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.accountUI?.currentAccount?.accepted&&window.socialMap&&window.qa);
  await page.evaluate(()=>openPage('friends'));await page.locator('[data-open-social-map="friends"]').click();
  await page.locator('.socialMapMarker').first().waitFor();
  check((await page.locator('#socialMapSharing').textContent()).includes('Aus'),'Default-off label');
  check(await page.evaluate(()=>qa.gps===0),'Opening map must not request GPS');
  check(await page.locator('.socialMapPerson').count()===1,'Friend with explicit incoming share visible');
  check((await page.locator('.socialMapPerson').textContent()).includes('Standort vor 20 Min.'),'Last coordinate timestamp');
  check((await page.locator('.socialMapPerson').textContent()).includes('Zuletzt aktiv vor 1 Min.'),'Separate last-active timestamp');
  check(await page.locator('#socialMapPeople img').count()===0,'Untrusted name escaped');
  check(await page.locator('#socialMapDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2),'Dialog fits width '+width);
  check(await page.locator('#socialMapCanvas canvas').count()===1,'Real MapLibre canvas');
  await page.screenshot({path:output+'/friends-'+width+'.png'});
  await page.locator('[data-social-scope="crew"]').click();await page.waitForFunction(()=>qa.requests.some(r=>r.name==='chs_social_map_read'&&r.args.scope==='crew'));
  check(await page.locator('[data-social-scope="crew"]').getAttribute('aria-pressed')==='true','Crew filter selected');
  if(width===390){
   await page.locator('[data-social-map-action="settings"]').click();check(!await page.locator('#socialMapSettings input[name=consent]').isChecked(),'Consent starts unchecked');
   await page.locator('#socialMapSettings select').selectOption('selected');await page.locator('#socialMapRecipients input').check();await page.locator('#socialMapSettings [type=submit]').click();
   check(await page.evaluate(()=>!qa.requests.some(r=>r.args.action==='settings')),'Unchecked consent cannot save');
   await page.evaluate(()=>qa.holdGps=true);await page.locator('#socialMapSettings input[name=consent]').check();await page.locator('#socialMapSettings [type=submit]').click();
   await page.waitForFunction(()=>qa.gps===1&&qa.settings.mode==='selected');
   check(await page.evaluate(()=>qa.settings.recipients.length===1&&qa.settings.recipients[0]===qa.peer),'Selected audience saved');
   await page.locator('[data-social-map-action="off"]').click();await page.waitForFunction(()=>qa.settings.mode==='off');await page.evaluate(()=>qa.deliverGps());
   check(await page.evaluate(()=>!qa.requests.some(r=>r.args.action==='publish')),'Late GPS after disabling never published');
   await page.evaluate(()=>{qa.holdGps=false;qa.denyGps=true;});await page.locator('[data-social-map-action="settings"]').click();await page.locator('#socialMapSettings select').selectOption('friends');await page.locator('#socialMapSettings input[name=consent]').check();await page.locator('#socialMapSettings [type=submit]').click();await page.waitForFunction(()=>document.getElementById('socialMapStatus').textContent.includes('verweigert'));
   check(await page.evaluate(()=>!qa.own),'Permission denied does not invent location');
   await page.evaluate(()=>qa.denyGps=false);await page.locator('[data-social-map-action="locate"]').click();await page.waitForFunction(()=>qa.own!==null);await page.waitForFunction(()=>document.querySelectorAll('.socialMapPerson').length===2);
   check((await page.locator('#socialMapPeople').textContent()).includes('Du'),'Own point after explicit sharing');
   await page.locator('[data-social-map-action="settings"]').click();await page.evaluate(()=>qa.failSave=true);await page.locator('[data-stop-sharing]').click();await page.waitForFunction(()=>document.getElementById('socialMapSettingsError').textContent.includes('fehlgeschlagen'));
   check(await page.evaluate(()=>qa.settings.mode==='friends'),'Failed disable not reported as saved');check((await page.locator('#socialMapStatus').textContent()).includes('kann noch aktiv sein'),'Failure explains server state');
   await page.evaluate(()=>{qa.failSave=false;qa.holdSave=true;});await page.locator('[data-stop-sharing]').click();await page.waitForFunction(()=>typeof qa.deliverSave==='function');
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));qa.deliverSave();});await page.waitForFunction(()=>qa.settings.mode==='off'&&!document.getElementById('socialMapSettings').open);
   check(await page.locator('.socialMapMarker').count()===0,'Hidden tab clears private markers while save completes');
   await page.evaluate(()=>{qa.holdSave=false;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.locator('.socialMapMarker').first().waitFor();
   check((await page.locator('#socialMapSharing').textContent()).includes('Aus'),'Returning after background save reloads, no stuck mutation');
   await page.evaluate(()=>qa.failRead=true);await page.locator('[data-social-map-action="refresh"]').click();await page.waitForFunction(()=>document.querySelectorAll('.socialMapPerson').length===0);check(await page.locator('.socialMapMarker').count()===0,'Offline read clears cached positions');
   await page.evaluate(()=>qa.failRead=false);await page.locator('[data-social-map-action="refresh"]').click();await page.locator('.socialMapMarker').first().waitFor();
   await page.evaluate(()=>{state={lobby:{state:'ACTIVE'}};socialMap.gameChanged();});check(await page.locator('.socialMapMarker').count()===0,'Active game immediately clears map');await page.evaluate(()=>state=null);
   await page.evaluate(()=>qa.holdRead=true);await page.locator('[data-social-map-action="refresh"]').click();await page.waitForFunction(()=>typeof qa.deliverRead==='function');await page.evaluate(()=>{qa.auth('SIGNED_OUT',null);qa.deliverRead();});
   check(await page.locator('#socialMapDialog').count()===0,'Logout removes all private map views');check(await page.locator('.socialMapMarker').count()===0,'Late read cannot restore another account markers');
  }else{
   await page.locator('#socialMapDialog .socialMapClose').click();await page.evaluate(()=>openPage('crew'));await page.locator('[data-open-social-map="crew"]').click();await page.locator('#socialMapDialog').waitFor();check((await page.locator('#socialMapDialogTitle').textContent())==='Crewkarte','Entry from crew');
  }
  check(errors.length===0,'No JavaScript errors: '+errors.join('; '));await page.close();
 }
 console.log(JSON.stringify({checks,status:'passed',widths:[360,390,430,1000],screenshots:output,scope:'Actual frontend and MapLibre with local RPC/auth/GPS/style fixtures, no physical GPS or production integration'}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
