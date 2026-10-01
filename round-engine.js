'use strict';
const crypto=require('node:crypto');
const LIMITS=Object.freeze({find:8,lock:30,start:50,gpsAge:17000,gpsGrace:120000,disconnect:180000,outside:120000,driverSpeed:0.8,replacement:30000,afk:600000,afkGrace:120000});
const active=p=>!p.found&&!p.eliminated&&!p.left;
const playing=lobby=>['COUNTDOWN','HEADSTART','ACTIVE'].includes(lobby.state);
const fresh=(p,now,age=LIMITS.gpsAge)=>!!p?.location&&now-p.location.at<=age;
function event(lobby,type,body,details={},now=Date.now()){
  lobby.events ||= [];
  const item={id:crypto.randomUUID(),at:now,type,body,...details};
  lobby.events.push(item);
  if(lobby.events.length>3000)lobby.events.splice(0,lobby.events.length-3000);
  return item;
}
function initializePlayer(p,now){
  p.joinedAt ??= now;p.lastActivityAt ??= now;
  p.stats ||= {finds:0,escapes:0,failedFinds:0,outsideMs:0};
  p.fixes ||= [];
}
function initialize(lobby,now=Date.now()){
  lobby.events ||= [];lobby.locks ||= {};lobby.abortVotes ||= [];
  for(const p of lobby.players)initializePlayer(p,now);
}
function driverBlocked(p){return p.mode==='DRIVER'&&(!Number.isFinite(p.location?.speed)||p.location.speed>LIMITS.driverSpeed);}
function stable(p,now,count=3){
  const fixes=(p.fixes||[]).filter(f=>now-f.at<=12000&&f.accuracy<=8);
  return fixes.length>=count&&fixes.at(-1).at-fixes.at(-count).at>=3000;
}
function stablePair(a,b,now,distance,count){
  const own=(a.fixes||[]).filter(f=>now-f.at<=12000&&f.accuracy<=8&&Number.isFinite(f.lat)&&Number.isFinite(f.lng));
  const other=(b.fixes||[]).filter(f=>now-f.at<=12000&&f.accuracy<=8&&Number.isFinite(f.lat)&&Number.isFinite(f.lng));
  const used=new Set(),confirmed=[];
  for(const fix of own.slice(-count)){
    const partner=other.filter(f=>!used.has(f.at)&&Math.abs(f.at-fix.at)<=2500).sort((x,y)=>Math.abs(x.at-fix.at)-Math.abs(y.at-fix.at))[0];
    if(partner&&distance(fix,partner)+(fix.accuracy+partner.accuracy)/2<=LIMITS.find){used.add(partner.at);confirmed.push(fix);}
  }
  return confirmed.length>=count&&confirmed.at(-1).at-confirmed.at(-count).at>=3000;
}
function eligibility(lobby,seeker,target,now,distance){
  if(lobby.state!=='ACTIVE'||seeker.role!=='SEEKER'||!active(seeker)||!active(target))return 'Fund derzeit nicht möglich.';
  if(seeker.replacementNeedsStop && (seeker.replacementUntil||0)<=now)return 'Als Ersatzsucher zuerst sicher anhalten; mehrere GPS-Messungen bestätigen den Stillstand.';
  if((seeker.replacementUntil||0)>now)return 'Noch Zeit zum sicheren Anhalten.';
  if((seeker.cooldownUntil||0)>now||(target.escapeCooldownUntil||0)>now)return 'Bitte vor dem nächsten Fundversuch warten.';
  if(seeker.outsideSince)return 'Fund außerhalb des Spielgebiets nicht möglich.';
  if(driverBlocked(seeker))return 'Fahrer: erst sicher anhalten und die Geschwindigkeit bestätigen lassen.';
  if(!fresh(seeker,now,7000)||!fresh(target,now,7000))return 'GPS fehlt oder ist veraltet. Position wird gesucht.';
  if(seeker.location.accuracy>8||target.location.accuracy>8)return 'Position wird bestätigt: GPS muss bei beiden auf höchstens 8 m genau sein.';
  const a=seeker.location,b=target.location;
  if(distance(a,b)+(a.accuracy+b.accuracy)/2>LIMITS.find)return 'Noch nicht nah genug: Fahrzeug innerhalb von 8 m und GPS-Ungenauigkeit berücksichtigen.';
  const heights=[a,b].every(p=>Number.isFinite(p.altitude)&&Number.isFinite(p.altitudeAccuracy)&&p.altitudeAccuracy<=5);
  if(heights&&Math.abs(a.altitude-b.altitude)>4+a.altitudeAccuracy+b.altitudeAccuracy)return 'Höhenunterschied: Fahrzeuge befinden sich vermutlich auf verschiedenen Ebenen.';
  const count=heights?3:5;
  if(!stable(seeker,now,count)||!stable(target,now,count)||!stablePair(seeker,target,now,distance,count))return 'Position wird bestätigt: mehrere stabile Messungen nötig'+(heights?'.':'; Höhenangaben sind nicht ausreichend genau.');
  return '';
}
function startRound(lobby,now){
  initialize(lobby,now);lobby.roundStartedAt=now;lobby.locks={};lobby.abortVotes=[];lobby.events=[];
  for(const p of lobby.players){
    p.found=false;p.eliminated=false;p.left=false;p.eliminationReason='';p.cooldownUntil=0;
    p.stats={finds:0,escapes:0,failedFinds:0,outsideMs:0};p.roundFinds=0;
    delete p.foundAt;delete p.foundBy;delete p.eliminatedAt;
    p.roundStartRole=p.role;p.lastActivityAt=now;p.holdPoint=p.role==='SEEKER'?{...lobby.origin}:null;
    delete p.outsideSince;delete p.outsideEvidence;delete p.holdEvidence;delete p.replacementUntil;delete p.replacementNeedsStop;delete p.escapeCooldownUntil;delete p.gpsGapActive;
  }
  event(lobby,'START','Runde startet in 5 Sekunden.',{},now);
  event(lobby,'ROLES','Sucher wurden bestimmt.',{players:lobby.players.map(p=>({id:p.id,role:p.role}))},now);
}
function finish(lobby,seekersWin,reason='TIME',now=Date.now()){
  if(lobby.state==='RESULT')return;
  initialize(lobby,now);lobby.state='RESULT';lobby.locks={};
  const aborted=['ABORT_VOTE','TOO_FEW_PLAYERS','NO_PLAYERS','ADMIN_CLOSED'].includes(reason);
  event(lobby,'END',aborted?'Runde abgebrochen.':seekersWin?'Sucher gewinnen.':'Verstecker gewinnen.',{reason},now);
  const players=lobby.players.map(p=>{
    if(p.outsideSince)p.stats.outsideMs+=Math.max(0,now-p.outsideSince);
    delete p.outsideSince;
    return {id:p.id,name:p.name,vehicle:p.vehicle,role:p.role,startRole:p.roundStartRole||p.role,found:!!p.found,foundBy:p.foundBy||null,
      eliminated:!!p.eliminated,reason:p.eliminationReason||'',...p.stats,
      survivalSeconds:Math.max(0,Math.round(((p.foundAt||p.eliminatedAt||now)-(lobby.roundStartedAt||now))/1000))};
  });
  lobby.result={id:crypto.randomUUID(),seekersWin:!!seekersWin,aborted,reason,endedAt:now,
    found:players.filter(p=>p.role==='HIDER'&&p.found).length,totalHiders:players.filter(p=>p.role==='HIDER').length,players};
  for(const p of lobby.players){p.location=null;p.fixes=[];delete p.meetupRoute;}
}
function eliminate(lobby,p,reason,now){
  if(!active(p))return;
  p.eliminated=true;p.eliminatedAt=now;p.eliminationReason=reason;
  if(p.outsideSince){p.stats.outsideMs+=now-p.outsideSince;delete p.outsideSince;}
  for(const [id,lock] of Object.entries(lobby.locks))if(lock.seekerId===p.id||lock.targetId===p.id)delete lobby.locks[id];
  event(lobby,'ELIMINATED',p.name+' ist ausgeschieden.',{playerId:p.id,reason},now);
  p.location=null;p.fixes=[];delete p.meetupRoute;
}
function replacement(lobby,now,random=Math.random){
  if(lobby.replaceSeekers===false)return null;
  const hiders=lobby.players.filter(p=>p.role==='HIDER'&&active(p));
  const candidates=hiders.filter(p=>fresh(p,now)&&now-p.lastSeen<30000);
  if(hiders.length<2||!candidates.length)return null;
  const chosen=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
  chosen.role='SEEKER';chosen.replacementNeedsStop=true;chosen.replacementUntil=now+LIMITS.replacement;chosen.holdPoint=null;
  chosen.seekerRounds=(chosen.seekerRounds||0)+1;
  event(lobby,'REPLACEMENT','Neuer Sucher: '+chosen.name+' · 30 Sekunden zum sicheren Anhalten.',{playerId:chosen.id,until:chosen.replacementUntil},now);
  return chosen;
}
function evidence(p,key,outside,now){
  if(!outside){delete p[key];return false;}
  const at=p.location.at;
  if(!p[key])p[key]={first:at,last:at,count:1};
  else if(p[key].last!==at){p[key].last=at;p[key].count++;}
  return p[key].count>=2&&p[key].last-p[key].first>=3000;
}
function migrateHost(lobby,now){
  const host=lobby.players.find(p=>p.id===lobby.hostId);
  if(host&&!host.left&&!host.eliminated&&now-host.lastSeen<45000)return;
  const candidate=lobby.players.filter(p=>!p.left&&!p.eliminated&&now-p.lastSeen<30000).sort((a,b)=>a.joinedAt-b.joinedAt)[0];
  if(candidate&&candidate.id!==lobby.hostId){lobby.hostId=candidate.id;event(lobby,'HOST',candidate.name+' ist jetzt Host.',{playerId:candidate.id},now);}
}
function resolveLocks(lobby,now,distance){
  for(const [id,lock] of Object.entries(lobby.locks)){
    const seeker=lobby.players.find(p=>p.id===lock.seekerId),target=lobby.players.find(p=>p.id===lock.targetId);
    if(!seeker||!target||!active(seeker)||!active(target)||!fresh(seeker,now,7000)||!fresh(target,now,7000)||seeker.location.accuracy>25||target.location.accuracy>25||driverBlocked(seeker)||seeker.outsideSince){
      delete lobby.locks[id];event(lobby,'LOCK_CANCELLED','Fund-Countdown abgebrochen: aktuelle sichere Position fehlt.',{playerId:lock.seekerId,targetId:lock.targetId},now);continue;
    }
    const meters=distance(seeker.location,target.location);
    const beyond=meters-seeker.location.accuracy-target.location.accuracy>LIMITS.lock;
    const fixAt=Math.max(seeker.location.at,target.location.at);
    if(beyond){
      if(!lock.outside)lock.outside={first:fixAt,last:fixAt,count:1};
      else if(lock.outside.last!==fixAt){lock.outside.last=fixAt;lock.outside.count++;}
    }else delete lock.outside;
    if(target.stats.escapes<1&&lock.outside?.count>=2&&lock.outside.last-lock.outside.first>=2000){
      target.stats.escapes++;target.escapeCooldownUntil=now+15000;seeker.cooldownUntil=now+2000;
      delete lobby.locks[id];event(lobby,'ESCAPED',target.name+' ist einmal entkommen. Beim nächsten gültigen Lock ist keine weitere Flucht möglich.',{playerId:target.id,seekerId:seeker.id},now);continue;
    }
    if(now>=lock.endsAt && !(target.stats.escapes<1 && lock.outside && now<lock.endsAt+3000)){
      target.found=true;target.foundAt=now;target.foundBy=seeker.id;
      target.stats.survivalSeconds=Math.round((now-lobby.roundStartedAt)/1000);
      seeker.roundFinds=(seeker.roundFinds||0)+1;seeker.stats.finds++;
      seeker.cooldownUntil=now+3000;delete lobby.locks[id];
      event(lobby,'FOUND',target.vehicle+' gefunden · '+seeker.name+' hat '+target.name+' gefunden.',{playerId:target.id,seekerId:seeker.id,lockId:id},now);
      target.location=null;target.fixes=[];delete target.meetupRoute;
    }
  }
}
function tick(lobby,now,distance,random=Math.random){
  initialize(lobby,now);migrateHost(lobby,now);
  if(lobby.state==='COUNTDOWN'&&now>=lobby.countdownEndsAt){
    lobby.state='HEADSTART';lobby.headstartEndsAt=lobby.countdownEndsAt+lobby.headstart*1000;
    event(lobby,'HEADSTART','Versteckphase: Sucher bleiben am Treffpunkt.',{},now);
  }
  if(!playing(lobby)||!lobby.roundStartedAt)return;
  for(const p of lobby.players){
    if(!active(p))continue;
    if(now-p.lastSeen>LIMITS.disconnect){eliminate(lobby,p,'DISCONNECT',now);continue;}
    const connected=now-p.lastSeen<30000;
    const gpsMissing=connected&&!fresh(p,now);
    if(gpsMissing&&!p.gpsGapActive){p.gpsGapActive=true;p.gpsGapCount=(p.gpsGapCount||0)+1;}
    if(!gpsMissing)p.gpsGapActive=false;
    if(connected&&now-(p.location?.at||lobby.roundStartedAt)>LIMITS.gpsGrace){eliminate(lobby,p,'GPS_TIMEOUT',now);continue;}
    if(now-p.lastActivityAt>LIMITS.afk+LIMITS.afkGrace){eliminate(lobby,p,'AFK',now);continue;}
    if(p.replacementNeedsStop&&now>=p.replacementUntil&&fresh(p,now)){
      const stopped=(p.fixes||[]).filter(f=>now-f.at<=12000&&f.accuracy<=8&&Number.isFinite(f.speed)&&f.speed<=LIMITS.driverSpeed);
      if(stopped.length>=3&&stopped.at(-1).at-stopped.at(-3).at>=3000){p.replacementNeedsStop=false;event(lobby,'REPLACEMENT_READY',p.name+' hat sicher angehalten und kann suchen.',{playerId:p.id},now);}
    }
    if(fresh(p,now)&&p.location.accuracy<=100&&lobby.origin){
      const meters=distance(p.location,lobby.origin),outside=meters-p.location.accuracy>lobby.radius;
      if(evidence(p,'outsideEvidence',outside,now)&&!p.outsideSince){p.outsideSince=now;event(lobby,'OUTSIDE',p.name+' ist außerhalb des Spielgebiets · 2 Minuten zur Rückkehr.',{playerId:p.id,until:now+LIMITS.outside},now);}
      if(meters+p.location.accuracy<=lobby.radius&&p.outsideSince){p.stats.outsideMs+=now-p.outsideSince;delete p.outsideSince;event(lobby,'RETURNED',p.name+' ist zurück im Spielgebiet.',{playerId:p.id},now);}
      if(p.outsideSince&&now-p.outsideSince>=LIMITS.outside&&outside){eliminate(lobby,p,'OUTSIDE',now);continue;}
      if(p.location.accuracy<=25&&lobby.state==='HEADSTART'&&p.role==='SEEKER'&&p.holdPoint&&!p.replacementUntil&&p.location.at<lobby.headstartEndsAt){
        if(evidence(p,'holdEvidence',distance(p.location,p.holdPoint)-p.location.accuracy>LIMITS.start,now)){
          eliminate(lobby,p,'EARLY_START',now);event(lobby,'DISQUALIFIED',p.name+' hat den Startbereich zu früh verlassen.',{playerId:p.id},now);replacement(lobby,now,random);
        }
      }
    }
  }
  if(lobby.state==='HEADSTART'&&now>=lobby.headstartEndsAt){
    lobby.state='ACTIVE';lobby.endsAt=lobby.headstartEndsAt+lobby.duration*1000;
    event(lobby,'ACTIVE','Suchphase beginnt.',{},now);
  }
  if(lobby.state==='ACTIVE')resolveLocks(lobby,now,distance);
  const seekers=lobby.players.filter(p=>p.role==='SEEKER'&&active(p)),hiders=lobby.players.filter(p=>p.role==='HIDER'&&active(p));
  if(!seekers.length&&hiders.length)replacement(lobby,now,random);
  const currentSeekers=lobby.players.filter(p=>p.role==='SEEKER'&&active(p));
  if(!currentSeekers.length&&!hiders.length)finish(lobby,false,'NO_PLAYERS',now);
  else if(!hiders.length)finish(lobby,true,'ALL_HIDERS_OUT',now);
  else if(!currentSeekers.length)finish(lobby,false,'NO_SEEKERS',now);
  else if(lobby.state==='ACTIVE'&&now>=lobby.endsAt)finish(lobby,false,'TIME',now);
}
function beginLock(lobby,seeker,targetId,now,distance){
  initialize(lobby,now);
  const target=lobby.players.find(p=>p.id===targetId&&p.role==='HIDER');
  if(!target)return {error:'Fahrzeug nicht mehr verfügbar.',status:404};
  if(target.found&&target.foundBy===seeker.id)return {ok:true,status:'FOUND',targetId};
  if(target.found)return {error:'Bereits gefunden.',status:409};
  const owned=Object.values(lobby.locks).find(lock=>lock.seekerId===seeker.id);
  if(owned)return owned.targetId===targetId?{ok:true,status:'LOCKED',...owned}:{error:'Dein Fund-Countdown hat bereits ein festes Ziel.',status:409};
  if(Object.values(lobby.locks).some(lock=>lock.targetId===targetId))return {error:'Dieses Fahrzeug wird bereits von einem anderen Sucher bestätigt.',status:409};
  const reason=eligibility(lobby,seeker,target,now,distance);
  if(reason){
    if(lobby.state==='ACTIVE'&&seeker.role==='SEEKER'&&active(seeker)&&now>=(seeker.cooldownUntil||0)){
      seeker.stats.failedFinds++;seeker.cooldownUntil=now+(seeker.stats.failedFinds%3===0?30000:5000);
      event(lobby,'FAILED_FIND','Ungültiger Fundversuch.',{playerId:seeker.id},now);
    }
    return {error:reason,status:409};
  }
  const lock={id:crypto.randomUUID(),targetId,seekerId:seeker.id,startedAt:now,endsAt:now+Math.min(15,Math.max(10,lobby.escape||10))*1000};
  lobby.locks[lock.id]=lock;event(lobby,'LOCK',seeker.name+' bestätigt '+target.vehicle+'.',{playerId:target.id,seekerId:seeker.id,lockId:lock.id,until:lock.endsAt},now);
  return {ok:true,status:'LOCKED',...lock,distance:distance(seeker.location,target.location)};
}
function stateFor(lobby,me,now,distance){
  initialize(lobby,now);
  const locks=Object.values(lobby.locks).filter(lock=>lock.seekerId===me.id||lock.targetId===me.id).map(lock=>({...lock,outside:undefined}));
  const targets=me.role==='SEEKER'&&!locks.some(lock=>lock.seekerId===me.id)?lobby.players.filter(p=>p.role==='HIDER'&&!eligibility(lobby,me,p,now,distance)).map(p=>p.id):[];
  return {locks,nearbyTargets:targets,escapesUsed:me.stats.escapes,driverBlocked:driverBlocked(me),eliminated:!!me.eliminated,
    gpsWarning:playing(lobby)&&active(me)&&!fresh(me,now),gpsDeadline:playing(lobby)?(me.location?.at||lobby.roundStartedAt||now)+LIMITS.gpsGrace:null,
    outsideDeadline:me.outsideSince?me.outsideSince+LIMITS.outside:null,
    replacementUntil:me.replacementUntil||0,replacementNeedsStop:!!me.replacementNeedsStop,afkDeadline:playing(lobby)&&active(me)&&now-me.lastActivityAt>LIMITS.afk?me.lastActivityAt+LIMITS.afk+LIMITS.afkGrace:null,
    events:lobby.events.slice(-40)};
}
module.exports={LIMITS,active,playing,fresh,driverBlocked,stable,stablePair,eligibility,event,initialize,initializePlayer,startRound,finish,eliminate,replacement,tick,beginLock,stateFor};
