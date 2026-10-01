'use strict';
const {documents}=require('./legal');
const {createBackend}=require('./server-backend');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function error(status,message,extra={}){return Object.assign(new Error(message),{status,extra});}
function adminIds(env=process.env){return (env.CHS_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(uuid);}
function createAccountService({url,key,fetchImpl=fetch,env=process.env}={}){
  const backend=createBackend({url,key,fetchImpl,gatewayUrl:env.CHS_BACKEND_GATEWAY_URL,gatewayToken:env.CHS_BACKEND_TOKEN});
  async function request(resource,{method='GET',body,ignoreDuplicates=false}={}){
    if(!backend.configured)throw error(503,'Kontoschutz ist noch nicht eingerichtet. Bitte später erneut versuchen.');
    const prefer=method==='POST'?`resolution=${ignoreDuplicates?'ignore':'merge'}-duplicates,return=representation`:undefined;
    let response;
    try{response=await backend.request(resource,{method,body,prefer,timeout:10000});}
    catch{throw error(503,'Kontoschutz ist vorübergehend nicht erreichbar.');}
    if(!response.ok)throw error(503,'Kontoschutz konnte nicht geprüft oder gespeichert werden.');
    return response.status===204?null:response.json();
  }
  async function status(id){
    if(!uuid(id))throw error(401,'Ungültige Anmeldung.');
    const legal=documents(env);
    const [bans,acceptances]=await Promise.all([
      request('chs_account_bans?user_id=eq.'+id+'&select=reason,until_at,revoked_at'),
      request('chs_legal_acceptances?user_id=eq.'+id+'&version=eq.'+legal.version+'&document_hash=eq.'+legal.hash+'&select=accepted_at&limit=1')
    ]);
    const row=bans[0],banned=!!(row&&!row.revoked_at&&(!row.until_at||Date.parse(row.until_at)>Date.now()));
    const admin=adminIds(env).includes(id),developerPreview=!legal.ready&&!banned&&admin&&env.CHS_DEVELOPER_PREVIEW==='true';
    return {admin,developerPreview,banned,ban:banned?{reason:row.reason,until:row.until_at}:null,accepted:acceptances.length>0,legal};
  }
  async function requireAccess(id,{consent=true}={}){
    const account=await status(id);
    if(account.banned)throw error(403,'Dein Konto ist gesperrt.',{code:'ACCOUNT_BANNED',ban:account.ban});
    if(consent&&!account.developerPreview&&(!account.legal.ready||!account.accepted))throw error(428,account.legal.ready?'Bitte zuerst Nutzungsbedingungen und Sicherheitshinweise bestätigen.':'Die Freigabe der Rechtstexte steht noch aus.',{code:'LEGAL_REQUIRED'});
    return account;
  }
  async function requireAdmin(id){
    // The allowlist is server configuration, never JWT user_metadata.
    if(!adminIds(env).includes(id))throw error(403,'Nur für konfigurierte Administratoren.');
    await requireAccess(id,{consent:false});
  }
  async function accept(id,data){
    const account=await requireAccess(id,{consent:false}),legal=account.legal;
    if(!legal.ready)throw error(503,'Die Rechtstexte sind noch nicht freigegeben.');
    if(data.version!==legal.version||data.hash!==legal.hash)throw error(409,'Die Rechtstexte wurden aktualisiert. Bitte erneut lesen.');
    if(data.terms!==true||data.safety!==true||data.adult!==true||data.privacyRead!==true)throw error(400,'Bitte alle erforderlichen Erklärungen selbst bestätigen.');
    await request('chs_legal_acceptances?on_conflict=user_id,version,document_hash',{method:'POST',ignoreDuplicates:true,body:{user_id:id,version:legal.version,document_hash:legal.hash,document_snapshot:{operator:legal.operator,terms:legal.terms,privacy:legal.privacy,safety:legal.safety},accepted_at:new Date().toISOString(),terms:true,safety:true,adult:true,privacy_read:true}});
    return {ok:true};
  }
  async function players(actor,{q='',page=0}={}){
    await requireAdmin(actor);
    const search=String(q).trim().slice(0,40).replace(/[^\p{L}\p{N} _-]/gu,'');
    const offset=Math.max(0,Math.min(100000,Math.trunc(Number(page)||0)))*25;
    const query=new URLSearchParams({select:'id,username,player_tag,level,rounds_played,wins,created_at,last_seen_at',order:'created_at.desc,id',limit:'26',offset:String(offset)});
    if(search)query.set('or',`(username.ilike.*${search}*,player_tag.ilike.*${search}*)`);
    const rows=await request('profiles?'+query);
    const ids=rows.slice(0,25).map(p=>p.id).filter(uuid);
    const bans=ids.length?await request('chs_account_bans?user_id=in.('+ids.join(',')+')&select=user_id,reason,until_at,revoked_at'):[];
    return {players:rows.slice(0,25).map(p=>({...p,admin:adminIds(env).includes(p.id),ban:bans.find(b=>b.user_id===p.id&&!b.revoked_at&&(!b.until_at||Date.parse(b.until_at)>Date.now()))||null})),hasMore:rows.length>25};
  }
  async function ban(actor,data){
    await requireAdmin(actor);
    const target=data.targetId,reason=String(data.reason||'').trim().slice(0,500),unban=data.unban===true;
    if(!uuid(target))throw error(400,'Ungültiges Zielkonto.');
    if(adminIds(env).includes(target))throw error(400,'Administratorkonten sind vor Sperren geschützt.');
    if(reason.length<5)throw error(400,'Bitte eine nachvollziehbare Begründung angeben.');
    const hours=Number(data.hours);
    if(!unban&&![1,24,168,720,0].includes(hours))throw error(400,'Ungültige Sperrdauer.');
    const exists=await request('profiles?id=eq.'+target+'&select=id&limit=1');
    if(!exists.length)throw error(404,'Spieler nicht gefunden.');
    await request('rpc/chs_admin_set_ban',{method:'POST',body:{p_actor:actor,p_target:target,p_reason:reason,p_until:unban||hours===0?null:new Date(Date.now()+hours*3600000).toISOString(),p_revoke:unban}});
    return {ok:true,targetId:target,banned:!unban};
  }
  async function audit(actor){await requireAdmin(actor);return {actions:await request('chs_admin_audit?select=id,actor_id,target_id,action,reason,created_at&order=created_at.desc&limit=50')};}
  async function prune(){if(backend.configured)await request('chs_admin_audit?created_at=lt.'+encodeURIComponent(new Date(Date.now()-90*86400000).toISOString()),{method:'DELETE'});}
  return {status,requireAccess,requireAdmin,accept,players,ban,audit,prune};
}
module.exports={createAccountService,adminIds,uuid};
