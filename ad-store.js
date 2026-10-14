'use strict';
const {createBackend}=require('./server-backend');
const {createStore}=require('./state-store');
function createAdStore({url,key,gatewayUrl,gatewayToken,file,fetchImpl=fetch}={}){
 const backend=createBackend({url,key,gatewayUrl,gatewayToken,fetchImpl});
 const local=createStore({file});
 async function load(){
  if(!backend.configured)return await local.load()||{};
  const response=await backend.request('chs_ad_ledger?select=user_id,record');
  if(!response.ok)throw Error('Ad ledger unavailable');
  const result=Object.create(null);for(const row of await response.json())result[row.user_id]=row.record;return result;
 }
 async function save(records){
  if(!backend.configured){if(!local.durable)throw Error('Ad ledger persistence required');await local.save(records);return;}
  const response=await backend.request('rpc/chs_store_ad_ledger',{method:'POST',body:{records}});
  if(!response.ok)throw Error('Ad ledger write failed');
 }
 return {load,save};
}
module.exports={createAdStore};
