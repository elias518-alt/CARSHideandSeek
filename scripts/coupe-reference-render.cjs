// Controlled comparison render: red paint, five spokes, sport package, no decorative glow.
const http=require('node:http');
const {chromium}=require(process.env.CHS_QA_PLAYWRIGHT||'playwright');
(async()=>{const server=http.createServer(require('../server').handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:650},deviceScaleFactor:1.5});
await page.goto('http://127.0.0.1:'+server.address().port+'/legal/imprint');
await page.setContent('<style>body{margin:0;background:linear-gradient(#dde1e4,#f4f5f6);font:16px Arial;color:#283341}#model{height:590px;width:1000px}canvas{width:100%;height:100%;display:block}p{margin:0 24px}</style><div id="model"></div><p>CHS Coupé · Sport · 40 mm tiefer · Rot · Fünfspeichen</p>');
await page.evaluate(async()=>{window.vehicleStudio={color:()=> '#aa0919'};const {mount}=await import('/vehicle-3d.js');await mount(document.querySelector('#model'),{id:'reference',color:'Rot'},{rims:'stock',package:'sport',glow:'off'});});
await page.waitForSelector('[data-ready=true]');await page.screenshot({path:'/tmp/chs-coupe-reference.png'});console.log(await page.locator('#model').evaluate(e=>e.get3DState()));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
