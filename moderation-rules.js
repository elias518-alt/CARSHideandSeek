'use strict';
const ROLES=['user','moderator','admin','super_admin'];
const PERMISSIONS={user:[],moderator:['reports'],admin:['lab','reports','players','bans','lobbies','stats','audit'],super_admin:['lab','reports','players','bans','lobbies','stats','audit','roles']};
const CATEGORIES={dangerous_driving:'Gefährliches Fahren',harassment:'Belästigung',cheating:'Manipulation / falscher Standort',privacy:'Verletzung der Privatsphäre',other:'Sonstiger Regelverstoß'};
const STATUSES=['open','in_review','resolved','dismissed'];
const ONBOARDING_VERSION='beta-2026-10-01';
const REGIONS=['BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH'];
const permitted=(role,permission)=>(PERMISSIONS[role]||[]).includes(permission);
function reportInput(data){
  const category=data.category===undefined&&typeof data.reason==='string'?'other':data.category;
  const comment=String(data.comment??data.reason??'').trim();
  if(!Object.hasOwn(CATEGORIES,category)||comment.length>500||(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(comment)))throw Object.assign(new Error('Ungültige Meldung. Bitte Kategorie wählen; Kommentar höchstens 500 Zeichen.'),{status:400});
  return {category,comment};
}
function lobbySummary(lobby,now=Date.now()){
  return {code:lobby.code,name:lobby.name,hostId:lobby.hostId,players:lobby.players.filter(p=>!p.left).length,connected:lobby.players.filter(p=>!p.left&&now-p.lastSeen<30000).length,
    visibility:lobby.visibility,radius:lobby.radius,phase:lobby.state,closed:!!lobby.closed,createdAt:lobby.createdAt,startAt:lobby.roundStartedAt||null,endAt:lobby.endsAt||null,
    participants:lobby.players.map(p=>({id:p.id,profileId:p.authId,name:p.name,role:p.role,lastSeen:p.lastSeen,joinedAt:p.joinedAt,connected:now-p.lastSeen<30000,left:!!p.left,found:!!p.found,eliminated:!!p.eliminated}))};
}
module.exports={ROLES,PERMISSIONS,CATEGORIES,STATUSES,ONBOARDING_VERSION,REGIONS,permitted,reportInput,lobbySummary};
