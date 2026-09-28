const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,ROOT=__dirname,lobbies=new Map();
const uid=()=>crypto.randomUUID(), now=()=>Date.now(), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const send=(r,s,o)=>{r.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store'});r.end(JSON.stringify(o))};
const body=req=>new Promise((res,rej)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{res(d?JSON.parse(d):{})}catch(e){rej(e)}})});
const code=()=>crypto.randomBytes(4).toString('hex').slice(0,5).toUpperCase();
const dist=(a,b)=>{const R=6371000,p=x=>x*Math.PI/180,da=p(b.lat-a.lat),do_=p(b.lng-a.lng),q=Math.sin(da/2)**2+Math.cos(p(a.lat))*Math.cos(p(b.lat))*Math.sin(do_/2)**2;return 2*R*Math.asin(Math.sqrt(q))};
const cleanPlayer=p=>({id:p.id,name:p.name,vehicle:p.vehicle,color:p.color,mode:p.mode,ready:p.ready,role:p.role,found:p.found,hasLocation:!!p.loc,connected:now()-p.lastSeen<15000,xp:p.xp,level:p.level});
function pub(l,id){return {code:l.code,name:l.name,state:l.state,hostId:l.hostId,start:l.start,settings:l.settings,headstartEndsAt:l.headstartEndsAt,endsAt:l.endsAt,result:l.result,players:[...l.players.values()].map(cleanPlayer),me:cleanPlayer(l.players.get(id))};}
function host(l){if(!l.players.has(l.hostId)){const p=[...l.players.values()][0];l.hostId=p?.id||null}}
function roles(l){const ps=[...l.players.values()];if(ps.length<2)throw Error('Mindestens 2 Spieler erforderlich');if(ps.some(p=>!p.ready))throw Error('Noch nicht alle Spieler sind bereit');const shuffled=[...ps].sort(()=>Math.random()-.5), seekers=clamp(l.settings.seekers||Math.max(1,Math.floor(ps.length/5)),1,ps.length-1);shuffled.forEach((p,i)=>{p.role=i<seekers?'SEEKER':'HIDER';p.found=false;p.escapeUntil=0;p.cooldownUntil=0});l.state='COUNTDOWN';l.countdownEndsAt=now()+5000;l.result=null;}
function finish(l,reason){if(l.state==='RESULT')return;l.state='RESULT';const h=[...l.players.values()].filter(p=>p.role==='HIDER'),found=h.filter(p=>p.found).length,seekersWin=h.length>0&&found===h.length;l.result={reason,seekersWin,found,totalHiders:h.length};for(const p of l.players.values()){const gain=100+(p.role==='SEEKER'?found*80:(!p.found?180:40));p.xp+=gain;p.lastGain=gain;p.level=1+Math.floor(p.xp/1000)}}
function tick(l){const t=now();host(l);if(l.state==='COUNTDOWN'&&t>=l.countdownEndsAt){l.state='HEADSTART';l.headstartEndsAt=t+l.settings.headstart*1000;l.endsAt=l.headstartEndsAt+l.settings.duration*1000}if(l.state==='HEADSTART'&&t>=l.headstartEndsAt)l.state='ACTIVE';if(['HEADSTART','ACTIVE'].includes(l.state)&&t>=l.endsAt)finish(l,'TIME');const hs=[...l.players.values()].filter(p=>p.role==='HIDER');if(l.state==='ACTIVE'&&hs.length&&hs.every(p=>p.found))finish(l,'ALL_FOUND')}
function proximity(l,p){if(!p.loc||!['HEADSTART','ACTIVE'].includes(l.state)||!p.role)return null;const enemies=[...l.players.values()].filter(x=>x.id!==p.id&&x.loc&&!x.found&&x.role!==p.role);if(!enemies.length)return null;const n=enemies.map(x=>({id:x.id,name:x.name,distance:dist(p.loc,x.loc)})).sort((a,b)=>a.distance-b.distance)[0];const d=Math.round(n.distance);return {...n,distance:d,level:d<25?'VERY_CLOSE':d<50?'CLOSE':d<100?'NEAR':'FAR'};}
function gameView(l,p){const pr=proximity(l,p);return {proximity:pr,cooldownUntil:p.cooldownUntil||0,escapeUntil:p.escapeUntil||0,inStartZone:!!(p.loc&&l.start&&dist(p.loc,l.start)<=l.settings.startZone),distanceFromStart:p.loc&&l.start?Math.round(dist(p.loc,l.start)):null};}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://x');if(u.pathname.startsWith('/api/')){const b=req.method==='GET'?{}:await body(req);
 if(u.pathname==='/api/create'&&req.method==='POST'){let c;do c=code();while(lobbies.has(c));const id=uid(),p={id,name:(b.name||'Spieler').slice(0,24),vehicle:b.vehicle||'Unbekannt',color:b.color||'Unbekannt',mode:b.mode||'PASSENGER',ready:false,role:null,found:false,loc:null,lastSeen:now(),xp:0,level:1};const l={code:c,name:(b.lobbyName||'NIGHT HUNT').slice(0,32),hostId:id,state:'LOBBY',start:null,result:null,settings:{radius:clamp(+b.radius||3000,1000,10000),duration:clamp(+b.duration||900,300,3600),headstart:clamp(+b.headstart||180,10,600),escape:clamp(+b.escape||15,5,60),startZone:100,seekers:clamp(+b.seekers||1,1,10)},players:new Map([[id,p]])};lobbies.set(c,l);return send(res,200,{userId:id,lobby:pub(l,id)})}
 if(u.pathname==='/api/join'&&req.method==='POST'){const l=lobbies.get((b.code||'').toUpperCase());if(!l)return send(res,404,{error:'Lobby nicht gefunden'});if(l.state!=='LOBBY')return send(res,409,{error:'Spiel läuft bereits'});const id=uid();l.players.set(id,{id,name:(b.name||'Spieler').slice(0,24),vehicle:b.vehicle||'Unbekannt',color:b.color||'Unbekannt',mode:b.mode||'PASSENGER',ready:false,role:null,found:false,loc:null,lastSeen:now(),xp:0,level:1});return send(res,200,{userId:id,lobby:pub(l,id)})}
 const c=(b.code||u.searchParams.get('code')||'').toUpperCase(),id=b.userId||u.searchParams.get('userId'),l=lobbies.get(c);if(!l)return send(res,404,{error:'Lobby nicht gefunden'});tick(l);const p=l.players.get(id);if(!p)return send(res,403,{error:'Session nicht mehr gültig'});p.lastSeen=now();
 if(u.pathname==='/api/state')return send(res,200,{lobby:pub(l,id),serverTime:now(),...gameView(l,p)});
 if(u.pathname==='/api/ready'&&req.method==='POST'){if(l.state!=='LOBBY')return send(res,409,{error:'Nur in der Lobby'});p.ready=!!b.ready;return send(res,200,{ok:true})}
 if(u.pathname==='/api/location'&&req.method==='POST'){if(!Number.isFinite(+b.lat)||!Number.isFinite(+b.lng))return send(res,400,{error:'Ungültige Position'});const prev=p.loc,loc={lat:+b.lat,lng:+b.lng,accuracy:+b.accuracy||999,altitude:Number.isFinite(+b.altitude)?+b.altitude:null,speed:Number.isFinite(+b.speed)?+b.speed:null,ts:now()};if(prev){const dt=(loc.ts-prev.ts)/1000,d=dist(prev,loc);loc.impliedSpeed=dt>0?d/dt:0;loc.suspicious=loc.impliedSpeed>80}p.loc=loc;if(!l.start&&l.hostId===id)l.start={lat:loc.lat,lng:loc.lng};if(l.state==='ACTIVE'&&p.role==='HIDER'){const pr=proximity(l,p);if(pr&&pr.distance<50&&!p.escapeUntil)p.escapeUntil=now()+l.settings.escape*1000;if(p.escapeUntil&&now()>p.escapeUntil)p.escapeUntil=0}return send(res,200,{ok:true,...gameView(l,p)})}
 if(u.pathname==='/api/startpoint'&&req.method==='POST'){if(l.hostId!==id)return send(res,403,{error:'Nur Host'});if(!p.loc)return send(res,409,{error:'Zuerst GPS aktivieren'});l.start={lat:p.loc.lat,lng:p.loc.lng};return send(res,200,{ok:true})}
 if(u.pathname==='/api/start'&&req.method==='POST'){if(l.hostId!==id)return send(res,403,{error:'Nur Host'});if(!l.start)return send(res,409,{error:'Startpunkt fehlt'});roles(l);return send(res,200,{ok:true})}
 if(u.pathname==='/api/found'&&req.method==='POST'){if(l.state!=='ACTIVE'||p.role!=='SEEKER')return send(res,409,{error:'Fundversuch derzeit nicht möglich'});if(now()<p.cooldownUntil)return send(res,429,{error:'Fund-Cooldown aktiv'});const target=l.players.get(b.targetId);if(!target||target.role!=='HIDER'||target.found)return send(res,400,{error:'Ungültiges Ziel'});if(!p.loc||!target.loc)return send(res,409,{error:'GPS-Daten fehlen'});if(now()-p.loc.ts>12000||now()-target.loc.ts>12000)return send(res,409,{error:'GPS-Daten zu alt'});if(p.loc.accuracy>60||target.loc.accuracy>60)return send(res,409,{error:'GPS zu ungenau'});if(p.loc.suspicious||target.loc.suspicious)return send(res,409,{error:'Positionsverlauf unplausibel'});const d=dist(p.loc,target.loc);if(d>35){p.failCount=(p.failCount||0)+1;p.cooldownUntil=now()+[30000,90000,180000][Math.min(2,p.failCount-1)];return send(res,409,{error:'Fund nicht bestätigt',distance:Math.round(d)})}target.found=true;target.escapeUntil=0;p.failCount=0;tick(l);return send(res,200,{ok:true,distance:Math.round(d)})}
 if(u.pathname==='/api/rematch'&&req.method==='POST'){if(l.hostId!==id)return send(res,403,{error:'Nur Host'});for(const x of l.players.values()){x.role=null;x.found=false;x.ready=false;x.escapeUntil=0;x.cooldownUntil=0}l.state='LOBBY';l.result=null;return send(res,200,{ok:true})}
 if(u.pathname==='/api/leave'&&req.method==='POST'){l.players.delete(id);host(l);if(!l.players.size)lobbies.delete(c);return send(res,200,{ok:true})}
 return send(res,404,{error:'API nicht gefunden'})}
const staticFiles = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/app.js': 'app.js',
  '/style.css': 'style.css'
};

const fileName = staticFiles[u.pathname];

if (!fileName) {
  res.writeHead(404);
  return res.end('Not found');
}

const file = path.join(__dirname, fileName);

if (!fs.existsSync(file)) {
  console.error('Datei fehlt:', file);
  res.writeHead(404);
  return res.end('File not found: ' + fileName);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

res.writeHead(200, {
  'Content-Type': types[path.extname(file)] || 'application/octet-stream',
  'Cache-Control': 'no-store'
});

fs.createReadStream(file).pipe(res);
