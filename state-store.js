'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createBackend}=require('./server-backend');

// Server-only state. The browser must never be granted access to this table.
function createStore({file,url,key,gatewayUrl,gatewayToken,fetchImpl=fetch}={}) {
  const backend=createBackend({url,key,gatewayUrl,gatewayToken,fetchImpl});
  let pending=null,running=false,lastValue=null;
  async function request(method,body) {
    const response=await backend.request('chs_server_state'+(method==='GET'?'?slot=eq.gameplay&select=snapshot,expires_at':''),{method,body,prefer:method==='POST'?'resolution=merge-duplicates,return=minimal':undefined});
    if(!response.ok)throw new Error('State storage HTTP '+response.status);
    return method==='GET'?response.json():null;
  }
  async function load() {
    if(backend.configured){const rows=await request('GET');return rows[0]&&Date.parse(rows[0].expires_at)>Date.now()?rows[0].snapshot:null;}
    if(!file)return null;
    try {return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async function write(value) {
    if(value===lastValue)return;
    if(backend.configured){await request('POST',{slot:'gameplay',snapshot:JSON.parse(value),expires_at:new Date(Date.now()+30*86400000).toISOString()});lastValue=value;return;}
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
  return {load,save,durable:backend.configured||!!file};
}
module.exports={createStore};
