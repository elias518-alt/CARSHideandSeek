// Restricted server-to-server gateway. Supabase credentials stay inside the
// function runtime. Only a hash of the Render credential is stored in the DB.
const methods={chs_account_bans:['GET'],chs_legal_acceptances:['GET','POST'],profiles:['GET'],chs_admin_audit:['GET','DELETE'],chs_server_state:['GET','POST'],chs_verified_results:['POST'],'rpc/chs_admin_set_ban':['POST']};
const columns={profiles:['id','username','player_tag','level','rounds_played','wins','created_at','last_seen_at'],chs_account_bans:['user_id','reason','until_at','revoked_at'],chs_legal_acceptances:['accepted_at'],chs_admin_audit:['id','actor_id','target_id','action','reason','created_at'],chs_server_state:['snapshot','expires_at']};
Object.assign(methods,{chs_staff_roles:['GET','POST'],chs_player_blocks:['GET','POST','DELETE'],chs_player_reports:['GET','POST'],chs_onboarding:['GET','POST'],chs_user_regions:['GET','POST'],chs_daily_activity:['POST'],chs_player_round_stats:['GET'],chs_ops_events:['POST']});
for(const name of ['chs_admin_set_role','chs_admin_update_report','chs_admin_log_close','chs_admin_beta_stats','chs_record_match','chs_beta_retention','chs_personal_beta_stats'])methods['rpc/'+name]=['POST'];
Object.assign(columns,{chs_staff_roles:['user_id','role'],chs_player_blocks:['user_id','target_id'],chs_player_reports:['id','reporter_id','target_id','lobby_code','category','comment','status','resolution','created_at','updated_at'],chs_onboarding:['version'],chs_user_regions:['user_id','country','region'],chs_player_round_stats:['role','finds','survival_seconds','won']});
columns.chs_admin_audit.push('context');
const json=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function readJson(req){
  const reader=req.body?.getReader();if(!reader)throw Error('Missing body');
  const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8*1024*1024){await reader.cancel();throw Error('Too large');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function createGateway({url,serviceKey,fetchImpl=fetch,now=Date.now}){
  let cachedHash='',hashUntil=0;
  function headers(){const h={apikey:serviceKey,'Content-Type':'application/json'};if(!serviceKey.startsWith('sb_secret_'))h.Authorization='Bearer '+serviceKey;return h;}
  async function expectedHash(){
    if(cachedHash&&hashUntil>now())return cachedHash;
    const response=await fetchImpl(url+'/rest/v1/chs_backend_credentials?slot=eq.render&select=token_hash&limit=1',{headers:headers(),signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Credential store unavailable');
    const rows=await response.json();cachedHash=rows[0]?.token_hash||'';hashUntil=now()+10000;return cachedHash;
  }
  return async req=>{
    if(req.method!=='POST')return json(405,'Method not allowed');
    if(req.headers.has('origin'))return json(403,'Server access only');
    const token=req.headers.get('x-chs-backend-token')||'';
    if(!/^[a-f0-9]{64}$/.test(token))return json(401,'Unauthorized');
    if(!url||!serviceKey)return json(503,'Backend unavailable');
    try{
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
      const expected=await expectedHash();let different=expected.length^hash.length;
      for(let i=0;i<hash.length;i++)different|=hash.charCodeAt(i)^(expected.charCodeAt(i)||0);
      if(different)return json(401,'Unauthorized');
      let input;try{input=await readJson(req);}catch{return json(400,'Invalid request');}
      if(input.resource==='health')return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
      const resource=input.resource,method=input.method||'GET';
      if(typeof resource!=='string'||resource.length>4000)return json(400,'Invalid resource');
      const path=resource.split('?')[0];if(!methods[path]?.includes(method))return json(403,'Resource not allowed');
      const query=new URLSearchParams(resource.split('?').slice(1).join('?'));
      if(method==='GET'&&!query.has('select'))return json(400,'Explicit columns required');
      if(query.has('select')&&query.get('select').split(',').some(c=>!columns[path]?.includes(c)))return json(403,'Columns not allowed');
      if(path==='chs_admin_audit'&&method==='DELETE'){
        const cutoff=query.get('created_at')||'';
        if(!cutoff.startsWith('lt.')||!(Date.parse(cutoff.slice(3))<=now()-90*86400000))return json(403,'Retention filter required');
      }
      if(path==='chs_server_state'&&method==='POST'&&input.body?.slot!=='gameplay')return json(403,'Invalid state slot');
      if(path==='chs_verified_results'&&input.prefer!=='resolution=ignore-duplicates,return=representation')return json(403,'Immutable result required');
      if(path==='chs_player_blocks'&&method==='DELETE'&&['user_id','target_id'].some(key=>!/^eq\.[a-f0-9-]{36}$/i.test(query.get(key)||'')))return json(403,'Exact block owner and target required');
      if(path==='chs_staff_roles'&&method==='POST'&&(input.body?.role!=='super_admin'||input.prefer!=='resolution=ignore-duplicates,return=representation'))return json(403,'Bootstrap only; role changes require audited RPC');
      if(path==='chs_player_reports'&&method==='POST'&&(input.prefer!=='resolution=ignore-duplicates,return=representation'||Object.keys(input.body||{}).some(key=>!['id','reporter_id','target_id','lobby_code','category','comment'].includes(key))))return json(403,'New report only; updates require audited RPC');
      const h=headers();
      if(input.prefer){if(!['resolution=merge-duplicates,return=minimal','resolution=merge-duplicates,return=representation','resolution=ignore-duplicates,return=representation'].includes(input.prefer))return json(400,'Invalid write mode');h.Prefer=input.prefer;}
      const response=await fetchImpl(url+'/rest/v1/'+resource,{method,headers:h,body:input.body?JSON.stringify(input.body):undefined,signal:AbortSignal.timeout(7000)});
      return new Response(response.status===204?null:await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }catch{return json(503,'Backend unavailable');}
  };
}
