'use strict';
const crypto=require('node:crypto');
const POLICY=Object.freeze({roundsBetween:3,intervalMs:10*60*1000,maxInterstitialsPer24h:3,maxRewardedPer24h:10,permanentRewardThreshold:10,interstitialMaxSeconds:15,rewardedMaxSeconds:30,rewardDurationMs:2*60*60*1000});
const failure=(status,message)=>Object.assign(new Error(message),{status});
function createAdService({provider=null,history=()=>[],unsafe=()=>false,persist=async()=>{},now=Date.now}={}){
 let records=Object.create(null);const queues=new Map();
 const configured=()=>!!provider?.name&&typeof provider.createSession==='function'&&typeof provider.verifyReward==='function';
 function snapshot(){return structuredClone(records);}
 function restore(value){records=value&&typeof value==='object'&&!Array.isArray(value)?Object.assign(Object.create(null),structuredClone(value)):Object.create(null);}
 const empty=()=>({interstitials:[],rewarded:[],pending:null,rewardUntil:0,rewardPermanent:false,events:[]});
 function recent(values){return values.filter(at=>Number.isFinite(at)&&now()-at<86400000);}
 function status(actor){const r=records[actor],last=r?.interstitials?.at(-1)||0;
  const eligible=configured()&&!unsafe(actor)&&(!last||now()-last>=POLICY.intervalMs)&&recent(r?.interstitials||[]).length<POLICY.maxInterstitialsPer24h&&history().filter(x=>x.participants?.includes(actor)&&!x.result?.aborted&&x.result.endedAt>last).length>=POLICY.roundsBetween;
  return {enabled:configured(),interstitialEligible:eligible,provider:configured()?provider.name:null,reason:configured()?null:'PROVIDER_NOT_CONFIGURED',policy:POLICY,reward:{id:'neon-garage',label:r?.rewardPermanent?'Neon-Garagen-Look dauerhaft':'Neon-Garagen-Look für 2 Stunden',permanent:r?.rewardPermanent===true,progress:recent(r?.rewarded||[]).length,target:POLICY.permanentRewardThreshold,expiresAt:r?.rewardPermanent?null:r?.rewardUntil>now()?r.rewardUntil:null}};}
 async function locked(actor,work){const old=queues.get(actor)||Promise.resolve();const next=old.catch(()=>{}).then(work);queues.set(actor,next);try{return await next;}finally{if(queues.get(actor)===next)queues.delete(actor);}}
 async function change(actor,work){return locked('ledger',async()=>{const previous=records[actor]?structuredClone(records[actor]):null;const r=records[actor]||empty();const result=await work(r);records[actor]=r;try{await persist();}catch{if(previous)records[actor]=previous;else delete records[actor];throw failure(503,'Werbestatus konnte nicht gespeichert werden.');}return result;});}
 async function providerCall(work){let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure(503,'Werbeanbieter antwortet nicht.')),10000);})]);}finally{clearTimeout(timer);}}
 async function begin(actor,input={}){
  if(!configured())throw failure(503,'Werbung ist noch nicht verfügbar.');
  if(!actor||unsafe(actor))throw failure(409,'Während einer Lobby, Runde oder im Fahrer-Modus ist Werbung gesperrt.');
  if(input.consent!==true||input.stationary!==true)throw failure(400,'Werbeeinwilligung und sicherer Stillstand müssen bestätigt werden.');
  if(!['interstitial','rewarded'].includes(input.kind))throw failure(400,'Unbekannter Werbeplatz.');
  return change(actor,async r=>{
   if(r.pending&&r.pending.expiresAt>now())throw failure(409,'Eine Werbeanfrage läuft bereits.');
   r.interstitials=recent(r.interstitials);r.rewarded=recent(r.rewarded);
   if(input.kind==='interstitial'){
    const rounds=history().filter(x=>x.participants?.includes(actor)&&!x.result?.aborted);
    const selected=rounds.find(x=>x.result?.id===input.resultId);
    const last=r.interstitials.at(-1)||0;
    if(!selected||now()-selected.result.endedAt>600000||selected.result.endedAt>now())throw failure(403,'Kein aktuelles abgeschlossenes Spiel vorhanden.');
    if(rounds.filter(x=>x.result.endedAt>last).length<POLICY.roundsBetween||last&&now()-last<POLICY.intervalMs||r.interstitials.length>=POLICY.maxInterstitialsPer24h)throw failure(409,'Werbepause aktiv.');
   }else {if(r.rewardPermanent)throw failure(409,'Der Neon-Look ist bereits dauerhaft freigeschaltet.');if(r.rewarded.length>=POLICY.maxRewardedPer24h)throw failure(409,'Zehn Werbebelohnungen in 24 Stunden erreicht.');}
   const id=crypto.randomUUID(),maxSeconds=input.kind==='interstitial'?POLICY.interstitialMaxSeconds:POLICY.rewardedMaxSeconds;
   const session=await providerCall(()=>provider.createSession({actor,id,kind:input.kind,maxSeconds}));
   if(unsafe(actor))throw failure(409,'Werbung wurde wegen einer neuen Spielsitzung abgebrochen.');
   if(!session||!Number.isFinite(session.maxSeconds)||session.maxSeconds>maxSeconds||session.maxSeconds<=0)throw failure(503,'Keine passende kurze Anzeige verfügbar.');
   r.pending={id,kind:input.kind,createdAt:now(),expiresAt:now()+180000};
   // Reserve frequency when an ad is issued, so cancellation cannot bypass limits.
   if(input.kind==='interstitial')r.interstitials.push(now());
   return {id,kind:input.kind,session,reward:status(actor).reward};
  });
 }
 async function complete(actor,input={}){
  if(!configured())throw failure(503,'Werbung ist noch nicht verfügbar.');
  return change(actor,async r=>{
   const pending=r.pending;
   if(!pending||pending.id!==input.id||pending.expiresAt<=now()||pending.kind!=='rewarded')throw failure(403,'Keine gültige Belohnungsanfrage.');
   if(unsafe(actor))throw failure(409,'Belohnung während einer Spielsitzung gesperrt.');
   const proof=await providerCall(()=>provider.verifyReward({actor,id:pending.id,proof:input.proof}));
   if(r.pending?.id!==pending.id||pending.expiresAt<=now())throw failure(403,'Belohnungsanfrage ist abgelaufen.');
   if(!proof||proof.actor!==actor||proof.sessionId!==pending.id||proof.completed!==true||typeof proof.eventId!=='string'||!proof.eventId||proof.eventId.length>200||!Number.isFinite(proof.at)||proof.at<pending.createdAt||proof.at>now()+30000||Object.values(records).some(record=>record.events.some(e=>e.id===proof.eventId)))throw failure(403,'Der Anbieter hat die Belohnung nicht bestätigt.');
   if(unsafe(actor))throw failure(409,'Belohnung während einer Spielsitzung gesperrt.');
   r.events.push({id:proof.eventId,at:now()});r.rewarded=recent(r.rewarded);r.rewarded.push(now());r.rewardUntil=now()+POLICY.rewardDurationMs;r.rewardPermanent=r.rewardPermanent||r.rewarded.length>=POLICY.permanentRewardThreshold;r.pending=null;
   return {reward:{id:'neon-garage',label:r.rewardPermanent?'Neon-Garagen-Look dauerhaft':'Neon-Garagen-Look für 2 Stunden',permanent:r.rewardPermanent,progress:r.rewarded.length,target:POLICY.permanentRewardThreshold,expiresAt:r.rewardPermanent?null:r.rewardUntil}};
  });
 }
 async function cancel(actor){if(!records[actor]?.pending)return {ok:true};return change(actor,r=>{r.pending=null;return {ok:true};});}
 async function prune(){return locked('ledger',async()=>{const previous=snapshot();for(const [id,r]of Object.entries(records)){r.events=r.events.filter(e=>now()-e.at<30*86400000);r.interstitials=recent(r.interstitials);r.rewarded=recent(r.rewarded);if(r.pending?.expiresAt<=now())r.pending=null;if(!r.rewardPermanent&&!r.pending&&r.rewardUntil<=now()&&!r.interstitials.length&&!r.rewarded.length&&!r.events.length)delete records[id];}if(JSON.stringify(previous)!==JSON.stringify(records)){try{await persist();}catch(error){restore(previous);throw error;}}});}
 return {status,begin,complete,cancel,snapshot,restore,prune};
}
module.exports={createAdService,POLICY};
