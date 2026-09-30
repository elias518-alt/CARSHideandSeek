'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');

// Server-only state. The browser must never be granted access to this table.
function createStore({file,url,key,fetchImpl=fetch}={}) {
  let pending=null,running=false,lastValue=null;
  async function request(method,body) {
    const headers={apikey:key,'Content-Type':'application/json'};
    if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    if(method==='POST')headers.Prefer='resolution=merge-duplicates,return=minimal';
    const response=await fetchImpl(url+'/rest/v1/chs_server_state'+(method==='GET'?'?slot=eq.gameplay&select=snapshot,expires_at':''),{
      method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)throw new Error('State storage HTTP '+response.status);
    return method==='GET'?response.json():null;
  }
  async function load() {
    if(key){const rows=await request('GET');return rows[0]&&Date.parse(rows[0].expires_at)>Date.now()?rows[0].snapshot:null;}
    if(!file)return null;
    try {return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async function write(value) {
    if(value===lastValue)return;
    if(key){await request('POST',{slot:'gameplay',snapshot:JSON.parse(value),expires_at:new Date(Date.now()+30*86400000).toISOString()});lastValue=value;return;}
    if(!file)return;
    await fs.mkdir(path.dirname(file),{recursive:true});
    const temp=file+'.tmp';const handle=await fs.open(temp,'w',0o600);
    try{await handle.writeFile(value);await handle.sync();}finally{await handle.close();}
    await fs.rename(temp,file);lastValue=value;
  }
  async function flush() {
    if(running)return;running=true;
    try {
      while(pending){
        const batch=pending;pending=null;
        try{await write(batch.value);batch.waiters.forEach(item=>item.resolve());}
        catch(error){batch.waiters.forEach(item=>item.reject(error));}
      }
    }finally{running=false;}
  }
  function save(snapshot) {
    // At most one write and one newer snapshot are pending. Concurrent polls
    // cannot grow an unbounded database queue or acknowledge unsaved state.
    const value=JSON.stringify(snapshot,(name,value)=>name==='meetupRoute'?undefined:value);
    return new Promise((resolve,reject)=>{
      if(!pending)pending={value,waiters:[]};else pending.value=value;
      pending.waiters.push({resolve,reject});void flush();
    });
  }
  return {load,save,durable:!!key||!!file};
}
module.exports={createStore};
