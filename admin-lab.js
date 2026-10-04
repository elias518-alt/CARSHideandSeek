'use strict';
const round=require('./round-engine');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
// Only called after the HTTP handler obtains a fresh server-owned staff role.
function operate(lobby,me,command,role,now=Date.now(),testRole='SEEKER') {
  if(!['admin','super_admin'].includes(role))fail(403,'Admin-Test nur für Administratoren.');
  if(lobby.hostId!==me.id||lobby.players.length!==1||lobby.visibility!=='PRIVATE')fail(409,'Solo-Test benötigt eine private Lobby mit dir als einzigem Host.');
  if(!['start','headstart','active','finish'].includes(command))fail(400,'Unbekannte Testaktion.');
  if(round.driverBlocked(me))fail(409,'Als Fahrer erst sicher anhalten.');
  if(command==='start') {
    if(lobby.state!=='LOBBY')fail(409,'Teststart ist nur im Warteraum möglich.');
    if(!['SEEKER','HIDER'].includes(testRole))fail(400,'Ungültige Testrolle.');
    if(!round.fresh(me,now,60000)||me.location.accuracy>25)fail(409,'Für den Test ist aktuelles GPS bis 25 m Genauigkeit erforderlich.');
    lobby.testMode=true;lobby.testOwnerAuthId=me.authId;lobby.origin={lat:me.location.lat,lng:me.location.lng};
    me.role=testRole;lobby.state='COUNTDOWN';lobby.countdownEndsAt=now+5000;
    round.startRound(lobby,now);
  } else {
    if(!lobby.testMode||lobby.testOwnerAuthId!==me.authId)fail(403,'Kein eigener Admin-Test.');
    if(command==='headstart') {
      if(lobby.state!=='COUNTDOWN')fail(409,'Countdown ist nicht aktiv.');
      lobby.state='HEADSTART';lobby.countdownEndsAt=now;lobby.headstartEndsAt=now+lobby.headstart*1000;
    } else if(command==='active') {
      if(!['COUNTDOWN','HEADSTART'].includes(lobby.state))fail(409,'Es gibt keine Wartephase zu überspringen.');
      lobby.state='ACTIVE';lobby.headstartEndsAt=now;lobby.endsAt=now+lobby.duration*1000;
    } else {
      if(!round.playing(lobby))fail(409,'Kein laufender Test.');
      round.finish(lobby,false,'ADMIN_TEST',now);
    }
    round.event(lobby,'ADMIN_TEST','Admin-Test: '+command,{actorId:me.id},now);
  }
  return {ok:true,testMode:true,phase:lobby.state};
}
module.exports={operate};
