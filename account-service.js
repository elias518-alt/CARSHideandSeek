'use strict';
const {documents}=require('./legal');
const {createBackend}=require('./server-backend');
const rules=require('./moderation-rules');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function error(status,message,extra={}){return Object.assign(new Error(message),{status,extra});}
function adminIds(env=process.env){return (env.CHS_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(uuid);}
function createAccountService({url,key,fetchImpl=fetch,env=process.env}={}){
  const backend=createBackend({url,key,fetchImpl,gatewayUrl:env.CHS_BACKEND_GATEWAY_URL,gatewayToken:env.CHS_BACKEND_TOKEN});
  const attestations=new Map();
  const accessCache=new Map(),activityAt=new Map();
  async function roleFor(id){
    if(!uuid(id))throw error(401,'Ungültige Anmeldung.');
    if(adminIds(env).includes(id))return 'super_admin';
    const rows=await request('chs_staff_roles?user_id=eq.'+id+'&select=role&limit=1');
    return rules.ROLES.includes(rows[0]?.role)?rows[0].role:'user';
  }
  async function request(resource,{method='GET',body,ignoreDuplicates=false}={}){
    if(!backend.configured)throw error(503,'Kontoschutz ist noch nicht eingerichtet. Bitte später erneut versuchen.');
    const prefer=method==='POST'?`resolution=${ignoreDuplicates?'ignore':'merge'}-duplicates,return=representation`:undefined;
    let response;
    try{response=await backend.request(resource,{method,body,prefer,timeout:10000});}
    catch{throw error(503,'Kontoschutz ist vorübergehend nicht erreichbar.');}
    if(!response.ok){
      if(resource.startsWith('rpc/chs_admin_')&&response.status===400){
        let message='';try{message=(await response.json()).message||'';}catch{}
        if(/forbidden|protected/i.test(message))throw error(403,'Diese Aktion ist nicht erlaubt.');
        if(/not found/i.test(message))throw error(404,'Eintrag nicht gefunden.');
        throw error(409,'Die Aktion konnte nicht bestätigt werden. Bitte Ansicht neu laden und erneut prüfen.');
      }
      throw error(503,'Kontoschutz konnte nicht geprüft oder gespeichert werden.');
    }
    return response.status===204?null:response.json();
  }
  async function status(id){
    if(!uuid(id))throw error(401,'Ungültige Anmeldung.');
    const legal=documents(env);
    const [bans,acceptances,role,onboarding]=await Promise.all([
      request('chs_account_bans?user_id=eq.'+id+'&select=reason,until_at,revoked_at'),
      request('chs_legal_acceptances?user_id=eq.'+id+'&version=eq.'+legal.version+'&document_hash=eq.'+legal.hash+'&select=accepted_at&limit=1'),
      roleFor(id),request('chs_onboarding?user_id=eq.'+id+'&version=eq.'+rules.ONBOARDING_VERSION+'&select=version&limit=1')
    ]);
    const row=bans[0],banned=!!(row&&!row.revoked_at&&(!row.until_at||Date.parse(row.until_at)>Date.now()));
    const admin=role!=='user',developerPreview=!legal.ready&&!banned&&adminIds(env).includes(id)&&env.CHS_DEVELOPER_PREVIEW==='true';
    return {admin,role,permissions:rules.PERMISSIONS[role],developerPreview,banned,ban:banned?{reason:row.reason,until:row.until_at}:null,accepted:acceptances.length>0,legal,onboardingRequired:onboarding.length===0,onboardingVersion:rules.ONBOARDING_VERSION};
  }
  async function requireAccess(id,{consent=true,cached=false,onboarding=false}={}){
    const entry=accessCache.get(id);
    const account=cached&&entry?.until>Date.now()?entry.account:await status(id);
    if(cached)accessCache.set(id,{account,until:entry?.account===account?entry.until:Date.now()+2000});
    if(accessCache.size>2000)accessCache.delete(accessCache.keys().next().value);
    if(account.banned)throw error(403,'Dein Konto ist gesperrt.',{code:'ACCOUNT_BANNED',ban:account.ban});
    if(consent&&!account.developerPreview&&(!account.legal.canAccept||!account.accepted))throw error(428,account.legal.canAccept?'Bitte zuerst Nutzungsbedingungen und Sicherheitshinweise bestätigen.':'Die Freigabe der Rechtstexte steht noch aus.',{code:'LEGAL_REQUIRED'});
    if(onboarding&&account.onboardingRequired)throw error(428,'Bitte zuerst die Spielregeln bestätigen.',{code:'ONBOARDING_REQUIRED'});
    return account;
  }
  async function requirePermission(id,permission){
    const role=await roleFor(id);
    if(!rules.permitted(role,permission))throw error(403,'Für diese Funktion fehlen dir die Berechtigungen.');
    await requireAccess(id,{consent:false});
    return role;
  }
  async function requireAdmin(id){return requirePermission(id,'players');}
  async function accept(id,data){
    const account=await requireAccess(id,{consent:false}),legal=account.legal;
    if(!legal.canAccept)throw error(503,'Die Rechtstexte sind noch nicht freigegeben.');
    if(data.version!==legal.version||data.hash!==legal.hash)throw error(409,'Die Rechtstexte wurden aktualisiert. Bitte erneut lesen.');
    if(data.terms!==true||data.safety!==true||data.adult!==true||data.privacyRead!==true)throw error(400,'Bitte alle erforderlichen Erklärungen selbst bestätigen.');
    await request('chs_legal_acceptances?on_conflict=user_id,version,document_hash',{method:'POST',ignoreDuplicates:true,body:{user_id:id,version:legal.version,document_hash:legal.hash,document_snapshot:{operator:legal.operator,terms:legal.terms,privacy:legal.privacy,safety:legal.safety,betaAccess:legal.betaAccess},accepted_at:new Date().toISOString(),terms:true,safety:true,adult:true,privacy_read:true}});
    accessCache.delete(id);
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
    const [bans,staff,regions]=await Promise.all([ids.length?request('chs_account_bans?user_id=in.('+ids.join(',')+')&select=user_id,reason,until_at,revoked_at'):[],ids.length?request('chs_staff_roles?user_id=in.('+ids.join(',')+')&select=user_id,role'):[],coarseRegions(ids)]);
    return {players:rows.slice(0,25).map(p=>({...p,region:regions.find(r=>r.user_id===p.id)||null,role:adminIds(env).includes(p.id)?'super_admin':staff.find(r=>r.user_id===p.id)?.role||'user',admin:adminIds(env).includes(p.id),ban:bans.find(b=>b.user_id===p.id&&!b.revoked_at&&(!b.until_at||Date.parse(b.until_at)>Date.now()))||null})),hasMore:rows.length>25};
  }
  async function coarseRegions(ids){const valid=[...new Set(ids.filter(uuid))],rows=[];for(let i=0;i<valid.length;i+=100)rows.push(...await request('chs_user_regions?user_id=in.('+valid.slice(i,i+100).join(',')+')&select=user_id,country,region'));return rows;}
  async function ban(actor,data){
    const actorRole=await requirePermission(actor,'bans');
    const target=data.targetId,reason=String(data.reason||'').trim().slice(0,500),unban=data.unban===true;
    if(!uuid(target))throw error(400,'Ungültiges Zielkonto.');
    if(adminIds(env).includes(target))throw error(400,'Administratorkonten sind vor Sperren geschützt.');
    const targetRole=await roleFor(target);
    if(targetRole==='super_admin'||(targetRole==='admin'&&actorRole!=='super_admin'))throw error(403,'Dieses Administratorkonto ist geschützt.');
    if(reason.length<5)throw error(400,'Bitte eine nachvollziehbare Begründung angeben.');
    const hours=Number(data.hours);
    if(!unban&&![1,24,168,720,0].includes(hours))throw error(400,'Ungültige Sperrdauer.');
    const exists=await request('profiles?id=eq.'+target+'&select=id&limit=1');
    if(!exists.length)throw error(404,'Spieler nicht gefunden.');
    await request('rpc/chs_admin_set_ban',{method:'POST',body:{p_actor:actor,p_target:target,p_reason:reason,p_until:unban||hours===0?null:new Date(Date.now()+hours*3600000).toISOString(),p_revoke:unban}});
    accessCache.delete(target);
    return {ok:true,targetId:target,banned:!unban};
  }
  async function audit(actor){await requirePermission(actor,'audit');return {actions:await request('chs_admin_audit?select=id,actor_id,target_id,action,reason,context,created_at&order=created_at.desc&limit=50')};}
  async function setRole(actor,data){
    await requirePermission(actor,'roles');
    const {targetId,role}=data,reason=String(data.reason||'').trim();
    if(!uuid(targetId)||targetId===actor||adminIds(env).includes(targetId)||!rules.ROLES.includes(role)||reason.length<5||reason.length>500)throw error(400,'Ungültige oder geschützte Rollenänderung.');
    await request('rpc/chs_admin_set_role',{method:'POST',body:{p_actor:actor,p_target:targetId,p_role:role,p_reason:reason}});accessCache.delete(targetId);return {ok:true};
  }
  async function saveBlock(id,target,enabled){
    if(!uuid(id)||!uuid(target)||id===target)throw error(400,'Ungültiges Zielkonto.');
    const query='chs_player_blocks?user_id=eq.'+id+'&target_id=eq.'+target;
    if(enabled)await request('chs_player_blocks?on_conflict=user_id,target_id',{method:'POST',ignoreDuplicates:true,body:{user_id:id,target_id:target}});
    else await request(query,{method:'DELETE'});
  }
  async function saveReport(id,record){
    if(!uuid(id)||!uuid(record.target)||id===record.target)throw error(400,'Ungültiges Zielkonto.');
    const {category,comment}=rules.reportInput(record);
    await request('chs_player_reports',{method:'POST',ignoreDuplicates:true,body:{id:record.id,reporter_id:id,target_id:record.target,lobby_code:record.code,category,comment}});
  }
  async function reportList(actor,{status='open',page=0}={}){
    await requirePermission(actor,'reports');
    if(status!=='all'&&!rules.STATUSES.includes(status))throw error(400,'Ungültiger Meldungsstatus.');
    const query=new URLSearchParams({select:'id,reporter_id,target_id,lobby_code,category,comment,status,resolution,created_at,updated_at',order:'created_at.desc,id',limit:'51',offset:String(Math.max(0,Math.min(10000,Number(page)||0))*50)});
    if(status!=='all')query.set('status','eq.'+status);
    const rows=await request('chs_player_reports?'+query);return {reports:rows.slice(0,50),hasMore:rows.length>50};
  }
  async function updateReport(actor,data){
    await requirePermission(actor,'reports');
    const resolution=String(data.resolution||'').trim();
    if(!uuid(data.id)||!rules.STATUSES.includes(data.status)||resolution.length<5||resolution.length>500||!Number.isFinite(Date.parse(data.expected)))throw error(400,'Ungültige Meldungsbearbeitung.');
    // Optimistic revision check happens inside the atomic, locked RPC.
    await request('rpc/chs_admin_update_report',{method:'POST',body:{p_actor:actor,p_id:data.id,p_status:data.status,p_resolution:resolution,p_expected:data.expected}});return {ok:true};
  }
  async function stats(actor){await requirePermission(actor,'stats');return request('rpc/chs_admin_beta_stats',{method:'POST',body:{p_actor:actor}});}
  async function logClose(actor,code,reason){await requirePermission(actor,'lobbies');await request('rpc/chs_admin_log_close',{method:'POST',body:{p_actor:actor,p_code:code,p_reason:reason}});}
  async function markActive(id){
    if(!uuid(id)||(activityAt.get(id)||0)>Date.now())return;
    const until=Date.now()+60000;activityAt.set(id,until);
    try{
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      await request('chs_daily_activity?on_conflict=day,user_id',{method:'POST',body:{user_id:id,day,last_at:new Date().toISOString()}});
    }catch(error){activityAt.delete(id);throw error;}
    if(activityAt.size>10000)for(const [key,expiry]of activityAt)if(expiry<Date.now())activityAt.delete(key);
  }
  async function onboard(id,data){
    if(data.version!==rules.ONBOARDING_VERSION||data.understood!==true)throw error(400,'Bitte die aktuellen Spielregeln bestätigen.');
    const country=data.country||null,region=data.region||null;
    if(country&&!['DE','AT','CH','OTHER'].includes(country)||region&&(!rules.REGIONS.includes(region)||country!=='DE'))throw error(400,'Ungültige freiwillige Regionsangabe.');
    if(country)await request('chs_user_regions?on_conflict=user_id',{method:'POST',body:{user_id:id,country,region}});
    await request('chs_onboarding?on_conflict=user_id',{method:'POST',body:{user_id:id,version:rules.ONBOARDING_VERSION}});
    accessCache.delete(id);return {ok:true};
  }
  async function recordMatch(match,players){await request('rpc/chs_record_match',{method:'POST',body:{p_match:match,p_players:players}});}
  async function recordOperations(events){if(events.length)await request('chs_ops_events',{method:'POST',ignoreDuplicates:true,body:events});}
  async function personalStats(id){
    return request('rpc/chs_personal_beta_stats',{method:'POST',body:{p_user:id}});
  }
  async function initializeModeration(){
    if(!backend.configured)return [];
    for(const id of adminIds(env))await request('chs_staff_roles?on_conflict=user_id',{method:'POST',ignoreDuplicates:true,body:{user_id:id,role:'super_admin'}});
    const rows=[];for(let offset=0;;offset+=1000){const batch=await request('chs_player_blocks?select=user_id,target_id&order=user_id,target_id&limit=1000&offset='+offset);rows.push(...batch);if(batch.length<1000)break;}
    return rows;
  }
  async function attest(id,reward) {
    if(!uuid(id)||!uuid(reward.resultId)||!['HIDER','SEEKER'].includes(reward.role))throw error(400,'Ungültiges bestätigtes Ergebnis.');
    const key=id+':'+reward.resultId;
    if(attestations.has(key))return attestations.get(key);
    const pending=request('chs_verified_results?on_conflict=user_id,result_id',{method:'POST',ignoreDuplicates:true,body:{user_id:id,result_id:reward.resultId,role:reward.role,won:reward.won,finds:reward.finds,survived:reward.survived}});
    attestations.set(key,pending);
    try{await pending;}catch(error){attestations.delete(key);throw error;}
    if(attestations.size>2000)attestations.delete(attestations.keys().next().value);
  }
  async function prune(){if(backend.configured)await request('rpc/chs_beta_retention',{method:'POST',body:{}});}
  return {status,requireAccess,requireAdmin,requirePermission,roleFor,accept,players,ban,audit,prune,attest,setRole,saveBlock,saveReport,reportList,updateReport,stats,logClose,markActive,onboard,recordMatch,recordOperations,personalStats,initializeModeration,coarseRegions};
}
module.exports={createAccountService,adminIds,uuid};
