'use strict';
const rewards=require('./vehicle-rewards');
const configuration=require('./vehicle-configuration');
function createVehicleRewardService({url,key,fetcher=(...args)=>fetch(...args)}){
 const queues=new Map();
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 async function request(authorization,path,method='GET',body){
  let response;try{response=await fetcher(url+path,{method,headers:{Authorization:authorization,apikey:key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{fail(503,'Fahrzeugbelohnungen sind momentan nicht erreichbar.');}
  if(!response.ok)fail(response.status===401?401:503,'Fahrzeugbelohnungen konnten nicht geladen oder gespeichert werden.');
  return response.json();
 }
 async function read(actor,authorization){
  const [progress,cars,user]=await Promise.all([
   request(authorization,'/rest/v1/rpc/chs_community_read','POST',{section:'progress',query:'',page:0}),
   request(authorization,'/rest/v1/vehicles?select=id,brand,model,series,body_type,model_year&user_id=eq.'+encodeURIComponent(actor)),
   request(authorization,'/auth/v1/user')
  ]);
  if(user?.id!==actor||!Array.isArray(cars)||!Number.isFinite(Number(progress?.level)))fail(503,'Der gespeicherte Fortschritt konnte nicht geprüft werden.');
  const level=Math.max(1,Math.min(50,Math.floor(Number(progress.level)))),loadouts={},presentations={};
  for(const car of cars){loadouts[car.id]=rewards.supported(rewards.restrict(user.user_metadata?.chs_vehicle_loadouts?.[car.id],level),car);presentations[car.id]=configuration.presentation(user.user_metadata?.chs_vehicle_presentations?.[car.id]);}
  return {level,loadouts,presentations,cars,title:progress.title||''};
 }
 async function save(actor,authorization,input){
  const previous=queues.get(actor)||Promise.resolve();
  const work=previous.catch(()=>{}).then(async()=>{
   const state=await read(actor,authorization),car=state.cars.find(car=>car.id===input?.vehicleId);
   if(!car)fail(403,'Dieses Fahrzeug gehört nicht zu deiner Garage.');
   const candidate=input?.loadout;
   if(!candidate||typeof candidate!=='object'||Object.keys(candidate).some(key=>!Object.hasOwn(rewards.catalog,key)))fail(400,'Ungültige Fahrzeuganpassung.');
   for(const [key,items]of Object.entries(rewards.catalog)){
    const item=items.find(item=>item.id===candidate[key]);if(!item)fail(400,'Ungültige Fahrzeuganpassung.');
    if(item.level>state.level)fail(403,item.label+' benötigt Level '+item.level+'.');
   }
   if(JSON.stringify(rewards.normalize(candidate))!==JSON.stringify(rewards.supported(candidate,car)))fail(400,'Felgen und Sportpaket sind für diese Baureihe noch nicht angepasst.');
   state.loadouts[car.id]=rewards.normalize(candidate);
   if(input.presentation)state.presentations[car.id]=configuration.presentation(input.presentation);
   // Only the cosmetic metadata key is changed. XP and membership remain untouched.
   await request(authorization,'/auth/v1/user','PUT',{data:{chs_vehicle_loadouts:state.loadouts,...(input.presentation?{chs_vehicle_presentations:state.presentations}:{})}});
   return {level:state.level,loadouts:state.loadouts,presentations:state.presentations,title:state.title};
  });
  queues.set(actor,work);try{return await work;}finally{if(queues.get(actor)===work)queues.delete(actor);}
 }
 return {async read(actor,authorization){const {level,loadouts,presentations,title}=await read(actor,authorization);return {level,loadouts,presentations,title};},save};
}
module.exports={createVehicleRewardService};
