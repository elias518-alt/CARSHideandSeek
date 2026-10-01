'use strict';
const crypto=require('node:crypto');
const CATEGORIES=new Set(['API','AUTH','GPS','DISCONNECT','REJOIN','BACKEND','FRONTEND','VEHICLE','CHAT','SUPABASE','NETWORK']);
function createMonitor(){
  const pending=new Map();let flushing=null;
  function record(category,code,count=1){
    if(!CATEGORIES.has(category)||!/^[A-Z0-9_]{1,50}$/.test(code)||!Number.isInteger(count)||count<1)return;
    const minute=Math.floor(Date.now()/60000),key=minute+':'+category+':'+code;
    const entry=pending.get(key);
    if(entry)entry.count=Math.min(100000,entry.count+count);
    else if(pending.size<500)pending.set(key,{id:crypto.randomUUID(),at:new Date().toISOString(),category,code,count});
  }
  async function flush(write){
    if(flushing)return flushing;
    if(!pending.size)return;
    // Freeze the batch; new events get new IDs. A retry cannot duplicate it.
    const entries=[...pending.entries()].slice(0,100);entries.forEach(([key])=>pending.delete(key));
    const rows=entries.map(([,value])=>({...value}));
    flushing=(async()=>{try{await write(rows);}catch(error){
      // UUID keys keep failed batches separate from fresh, aggregating events.
      for(const row of rows)if(pending.size<500)pending.set('retry:'+row.id,row);
      throw error;
    }finally{flushing=null;}})();return flushing;
  }
  return {record,flush,pending:()=>pending.size};
}
module.exports={createMonitor,CATEGORIES};
