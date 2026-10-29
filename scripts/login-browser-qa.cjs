// Real SDK, no credentials: verify that the browser can begin OAuth even when
// old local data or script delivery is broken. The authorization request is
// intercepted before leaving the test, so no account is used or changed.
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
(async()=>{const server=http.createServer(require('../server').handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const base='http://127.0.0.1:'+server.address().port;
for(const scenario of ['signed-in','normal','corrupt-cache','wrong-cache-shape','missing-sdk','missing-app','no-javascript']){
 const context=await browser.newContext({viewport:{width:1440,height:900},javaScriptEnabled:scenario!=='no-javascript'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let authorize;
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/auth/v1/authorize'){authorize=u;return route.fulfill({contentType:'text/html',body:'OAuth redirect reached'});}if(scenario==='signed-in'&&u.pathname.includes('supabase-js-')){const stub=require('node:fs').readFileSync(__dirname+'/community-ui-qa.mjs','utf8').match(/const stub=`([\s\S]*?)`;/)[1];return route.fulfill({contentType:'text/javascript',body:stub});}if(scenario==='signed-in'&&u.pathname.startsWith('/api/'))return route.fulfill({json:u.pathname.endsWith('account-status')?{accepted:true,legal:{ready:true}}:{}});if(u.origin!==base)return route.abort();if(scenario==='missing-sdk'&&u.pathname.includes('supabase-js-'))return route.abort();if(scenario==='missing-app'&&u.pathname==='/app.js')return route.abort();return route.continue();});
 if(scenario==='corrupt-cache')await page.addInitScript(()=>{localStorage.setItem('chs','{bad');localStorage.setItem('chsGarage','[bad');});
 if(scenario==='wrong-cache-shape')await page.addInitScript(()=>{localStorage.setItem('chs','[]');localStorage.setItem('chsGarage','{}');});
 await page.goto(base,{waitUntil:'networkidle'});
 if(scenario==='signed-in'){await page.waitForFunction(()=>document.querySelector('#homeGreeting').textContent.includes('Elias'));assert.deepEqual(errors,[]);assert.equal(await page.locator('#authGate').isVisible(),false);console.log('signed-in: home is reachable');await context.close();continue;}
 if(['normal','corrupt-cache','wrong-cache-shape'].includes(scenario)){assert.deepEqual(errors,[],scenario);await page.waitForFunction(()=>document.querySelector('#authStatus').textContent.trim()==='Anmeldung erforderlich');}
 if(scenario==='normal')await page.screenshot({path:'/tmp/chs-login-desktop.png'});
 await page.locator('#googleLogin').click();await page.waitForURL('**/auth/v1/authorize**');
 assert.equal(authorize.origin,'https://yyvljkzitodxhtkilsxm.supabase.co');assert.equal(authorize.searchParams.get('provider'),'google');
 assert.equal(authorize.searchParams.get('redirect_to'),['missing-sdk','missing-app','no-javascript'].includes(scenario)?'https://carshideandseek.onrender.com/':base+'/');
 console.log(scenario+': OAuth navigation works');await context.close();
}
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
