'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const lobbyScene = require('./lobby-scene');
const round = require('./round-engine');
const {createStore}=require('./state-store');
const { roadRoute } = require('./meetup-route');
const { assignRoundRoles, roundRewardFor } = require('./game-rules');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yyvljkzitodxhtkilsxm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zgP-ABl8eaVGLkheMdlVWw_0TeZIEr8';
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || '';
const lobbies = new Map();
const lobbyInvites = new Map();
const authCache = new Map();
const blocks = new Map();
const reports = [];
const roundHistory = new Map();
let stateStore=null;
const snapshot=()=>({version:1,lobbies:[...lobbies.values()],blocks:[...blocks],roundHistory:[...roundHistory].filter(([,r])=>Date.now()-r.result.endedAt<30*86400000),reports:reports.filter(item=>Date.now()-item.at<30*86400000)});
async function persist(){if(stateStore)await stateStore.save(snapshot());}
async function restore(store){
  const saved=await store.load();
  if(saved){
    if(saved.version!==1)throw new Error('Unsupported state version');
    for(const lobby of saved.lobbies||[])if(Date.now()-lobby.createdAt<6*3600000){lobbies.set(lobby.code,lobby);updateGame(lobby);}
    for(const [id,list]of saved.blocks||[])blocks.set(id,list);
    for(const [id,record] of saved.roundHistory||[])if(Date.now()-record.result.endedAt<30*86400000)roundHistory.set(id,record);
    reports.push(...(saved.reports||[]).filter(item=>Date.now()-item.at<30*86400000));
  }
  stateStore=store;
}
const blocked=(a,b)=>(blocks.get(a)||[]).includes(b)||(blocks.get(b)||[]).includes(a);

const MAX_PLAYERS = 20;
const PUBLIC_RANGE_M = 1000;
const ACTIVE_LOCATION_MAX_AGE_MS = 17000;
const LOBBY_LOCATION_MAX_AGE_MS = 45000;
const LOBBY_MAX_ACCURACY_M = 200;
const ACTIVE_MAX_ACCURACY_M = 100;

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };
const clean = (value, max = 60) => String(value || '').trim().slice(0, max);
const number = value => Number(value);
const validPoint = p => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
const distance = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const v = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.min(1, Math.sqrt(v))));
};
const fresh = (p, now = Date.now(), maxAge = ACTIVE_LOCATION_MAX_AGE_MS) =>
  !!p?.location && now - p.location.at <= maxAge;
const code = () => {
  let candidate;
  do { candidate = crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }
  while (candidate.length !== 5 || lobbies.has(candidate));
  return candidate;
};

function pruneLobbyInvites(now = Date.now()) {
  for (const [id, invite] of lobbyInvites) {
    const lobby = lobbies.get(invite.code);
    if (!lobby || lobby.state !== 'LOBBY' || lobby.players.length >= MAX_PLAYERS || invite.expiresAt <= now) {
      lobbyInvites.delete(id);
    }
  }
}
function clearLobbyInvitesFor(targetAuthId, codeValue = '') {
  for (const [id, invite] of lobbyInvites) {
    if (invite.targetAuthId === targetAuthId && (!codeValue || invite.code === codeValue)) lobbyInvites.delete(id);
  }
}
function clearLobbyInvitesForCode(codeValue) {
  for (const [id, invite] of lobbyInvites) if (invite.code === codeValue) lobbyInvites.delete(id);
}

async function verifyAuth(req) {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) fail(401, 'Bitte erneut anmelden.');
  const cached = authCache.get(token);
  if (cached && cached.until > Date.now()) return cached.userId;
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY },
      signal: AbortSignal.timeout(5000)
    });
  } catch { fail(503, 'Anmeldung konnte gerade nicht geprüft werden.'); }
  if (!response.ok) fail(401, 'Sitzung abgelaufen. Bitte erneut anmelden.');
  const user = await response.json();
  if (!user.id) fail(401, 'Ungültige Anmeldung.');
  authCache.set(token, { userId: user.id, until: Date.now() + 30000 });
  if (authCache.size > 1000) authCache.clear();
  return user.id;
}
function readBody(req, maxBytes = 8192) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > maxBytes) { reject(new HttpError(413, 'Anfrage zu groß.')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new HttpError(400, 'Ungültige Daten.')); } });
    req.on('error', reject);
  });
}
function getSession(data, authId) {
  const lobby = lobbies.get(clean(data.code, 5).toUpperCase());
  if (!lobby) fail(404, 'Lobby nicht gefunden.');
  const me = lobby.players.find(p => p.id === data.userId && p.authId === authId);
  if (!me) fail(403, 'Session nicht gefunden.');
  updateGame(lobby);
  me.lastSeen = Date.now();
  return { lobby, me };
}
function safePhotoUrl(value) {
  const url = clean(value, 700);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function newPlayer(data, authId) {
  const name = clean(data.name, 24);
  const vehicle = clean(data.vehicle, 70);
  if (!name || !vehicle) fail(400, 'Spielername und Fahrzeug fehlen.');
  return {
    id: crypto.randomUUID(), authId, name, vehicle,
    color: clean(data.color, 30) || 'Unbekannt',
    bodyType: clean(data.bodyType,30),
    photoUrl: safePhotoUrl(data.photoUrl),
    avatarUrl: safePhotoUrl(data.avatarUrl),
    characterStyle: Math.max(0, Math.min(2, Math.trunc(number(data.characterStyle) || 0))),
    mode: data.mode === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
    level: Math.max(1, Math.min(50, Math.trunc(number(data.level) || 1))),
    role: null, ready: false, found: false, roundFinds: 0, location: null,
    lastSeen: Date.now(), joinedAt: Date.now(), lastActivityAt: Date.now(), cooldownUntil: 0
  };
}
function publicPlayer(p, now, maxAge = ACTIVE_LOCATION_MAX_AGE_MS) {
  return {
    id: p.id, profileId: p.authId, name: p.name, vehicle: p.vehicle, color: p.color, bodyType: p.bodyType || '',
    photoUrl: p.photoUrl || '', avatarUrl: p.avatarUrl || '', characterStyle: Number.isInteger(p.characterStyle) ? p.characterStyle : 0, mode: p.mode,
    level: p.level, role: p.role, ready: p.ready, found: p.found, eliminated: !!p.eliminated, left: !!p.left, eliminationReason: p.eliminationReason || "",
    connected: now - p.lastSeen < 30000, hasLocation: fresh(p, now, maxAge), hasStoredLocation: !!p.location
  };
}
function updateGame(lobby, now = Date.now()) {
  round.tick(lobby, now, distance);
  if(lobby.state==='RESULT'&&lobby.result&&!roundHistory.has(lobby.result.id)){
    for(const record of lobby.result.players||[]){const player=lobby.players.find(p=>p.id===record.id);record.baseXp=lobby.result.aborted||record.eliminated?0:(roundRewardFor(player,lobby.result)?.baseXp||0);}
    roundHistory.set(lobby.result.id,{result:structuredClone(lobby.result),events:structuredClone(lobby.events||[]),participants:lobby.players.map(p=>p.authId)});
    if(roundHistory.size>1000)roundHistory.delete(roundHistory.keys().next().value);
  }
}
function meetupPoint(lobby) {
  const host=lobby.players.find(p=>p.id===lobby.hostId);
  return lobby.checkpointFixed&&lobby.origin?{...lobby.origin,at:host?.location?.at||0}:host?.location;
}
function resultState(lobby, me) {
  const now = Date.now();
  updateGame(lobby, now);
  const locationMaxAge = lobby.state === 'LOBBY'
    ? LOBBY_LOCATION_MAX_AGE_MS
    : ACTIVE_LOCATION_MAX_AGE_MS;
  const opponents = lobby.players.filter(
    p => p.id !== me.id && round.active(p) && fresh(p, now, locationMaxAge) && p.role && p.role !== me.role
  );
  const nearest = fresh(me, now)
    ? opponents.map(p => ({ p, meters: distance(me.location, p.location) })).sort((a, b) => a.meters - b.meters)[0]
    : null;
  const proximity = nearest ? {
    distance: Math.round(nearest.meters / 10) * 10,
    level: nearest.meters < 50 ? 'VERY_CLOSE' : nearest.meters < 150 ? 'CLOSE' : nearest.meters < 500 ? 'NEAR' : 'FAR'
  } : null;
  const gameplay = round.stateFor(lobby, me, now, distance);
  const trackedTarget = gameplay.locks.find(lock => lock.seekerId === me.id)?.targetId;
  const reward = lobby.state === 'RESULT' && lobby.result?.id && !lobby.result.aborted && !me.eliminated
    ? { resultId: lobby.result.id, ...roundRewardFor(me, lobby.result) }
    : null;
  return {
    serverTime: now, proximity, ...gameplay, reward,
    history:[...roundHistory.values()].filter(r=>r.participants.includes(me.authId)).slice(-10).map(r=>r.result),
    chat: lobby.messages.slice(-50),
    map: {
      center: lobby.origin ? { lat: lobby.origin.lat, lng: lobby.origin.lng } : null,
      radius: lobby.radius,
      meetup: lobby.state === 'LOBBY' ? (() => {
        const host=lobby.players.find(p=>p.id===lobby.hostId);
        const point=meetupPoint(lobby);
        return point ? {lat:point.lat,lng:point.lng,name:lobby.checkpointFixed?'festgelegter Treffpunkt':host.name,stale:!lobby.checkpointFixed&&!fresh(host,now,LOBBY_LOCATION_MAX_AGE_MS)} : null;
      })() : null,
      positions: lobby.players.filter(p => p.location && (
        lobby.state === 'LOBBY' || (lobby.state !== 'RESULT' && round.active(me) && round.active(p) && fresh(p,now,locationMaxAge) &&
        (p.id === me.id || p.role === me.role || p.id === trackedTarget))
      )).map(p => ({
        id: p.id, name: p.name, role: p.role, found: p.found,
        lat: p.location.lat, lng: p.location.lng,
        accuracy: p.location.accuracy, updatedAt: p.location.at,
        connected: now - p.lastSeen < 30000,
        stale: !fresh(p, now, locationMaxAge)
      }))
    },
    cooldownUntil: me.cooldownUntil, escapeUntil: gameplay.locks.find(lock=>lock.targetId===me.id)?.endsAt || 0,
    blocksForMe:blocks.get(me.authId)||[],
    debugAvailable:(process.env.CHS_ADMIN_USER_IDS||'').split(',').map(id=>id.trim()).includes(me.authId),
    lobby: {
      code: lobby.code, name: lobby.name, visibility: lobby.visibility, background: lobbyScene.background(lobby.background),
      settings: { radius: lobby.radius, duration: lobby.duration, headstart: lobby.headstart, escape: lobby.escape, revision: lobby.settingsRevision || 0, replaceSeekers: lobby.replaceSeekers !== false },
      state: lobby.state, hostId: lobby.hostId,
      players: lobby.players.map(p => publicPlayer(p, now, locationMaxAge)),
      me: publicPlayer(me, now, locationMaxAge), countdownEndsAt: lobby.countdownEndsAt,
      headstartEndsAt: lobby.headstartEndsAt, endsAt: lobby.endsAt, result: lobby.result
    }
  };
}
function parsePosition(data, maxAccuracy = 100) {
  const p = { lat: number(data.lat), lng: number(data.lng), accuracy: number(data.accuracy) };
  if (!validPoint(p) || !Number.isFinite(p.accuracy) || p.accuracy <= 0 || p.accuracy > maxAccuracy)
    fail(400, 'GPS-Position zu ungenau oder ungültig.');
  return p;
}
function updateLocation(p, data, maxAccuracy = ACTIVE_MAX_ACCURACY_M) {
  const point = parsePosition(data, maxAccuracy);
  const now = Date.now();
  round.initializePlayer(p,now);
  const sampleAt = Number(data.timestamp);
  if (Number.isFinite(sampleAt) && sampleAt > 0) {
    if (sampleAt > now + 30000 || now - sampleAt > 45000) fail(400,'GPS-Messung ist veraltet oder liegt in der Zukunft.');
    if (sampleAt <= (p.lastSampleAt || 0)) return;
  }
  const measuredAt=Number.isFinite(sampleAt)&&sampleAt>0?Math.min(now,sampleAt):now;
  let derivedSpeed = null;
  if (p.location) {
    const seconds = (measuredAt - p.location.at) / 1000;
    const traveled = distance(p.location, point);
    if (traveled > 60 * Math.max(0,seconds) + p.location.accuracy + point.accuracy + 40) {
      p.suspiciousFixes = (p.suspiciousFixes || 0) + 1;
      fail(400, 'Unplausibler GPS-Sprung. Bitte Position erneut ermitteln.');
    }
    if (seconds >= 0.5) derivedSpeed = Math.max(0, traveled - p.location.accuracy - point.accuracy) / seconds;
  }
  const reportedSpeed = typeof data.speed === 'number' && Number.isFinite(data.speed) && data.speed >= 0 ? data.speed : null;
  const speed = derivedSpeed === null ? reportedSpeed : Math.max(derivedSpeed, reportedSpeed || 0);
  const altitude = typeof data.altitude === 'number' && Number.isFinite(data.altitude) ? data.altitude : null;
  const altitudeAccuracy = typeof data.altitudeAccuracy === 'number' && Number.isFinite(data.altitudeAccuracy) && data.altitudeAccuracy >= 0 ? data.altitudeAccuracy : null;
  p.location = { ...point, at: measuredAt, receivedAt:now, speed, altitude, altitudeAccuracy };
  if(Number.isFinite(sampleAt)&&sampleAt>0)p.lastSampleAt=sampleAt;
  p.fixes.push({...point,at:measuredAt,speed});
  p.fixes = p.fixes.filter(f => now-f.at <= 20000).slice(-20);
  if (speed > 1) p.lastActivityAt = now;

}
async function route(action, data, authId) {
  const now = Date.now();
  if (action === 'block') {
    const target=clean(data.targetAuthId,100);
    if(!target||target===authId)fail(400,'Ungültiger Spieler.');
    const list=blocks.get(authId)||[];
    blocks.set(authId,data.blocked===false?list.filter(id=>id!==target):[...new Set([...list,target])].slice(-200));
    return {ok:true};
  }
  if (action === 'report') {
    const lobby=lobbies.get(clean(data.code,5).toUpperCase());
    const me=lobby?.players.find(p=>p.authId===authId&&p.id===data.userId);
    const target=lobby?.players.find(p=>p.id===data.targetId);
    if(!me||!target||target.id===me.id)fail(403,'Melden ist nur für Mitspieler dieser Lobby möglich.');
    const reason=clean(data.reason,500);if(reason.length<5)fail(400,'Bitte einen konkreten Grund angeben.');
    if(reports.some(r=>r.reporter===authId&&r.target===target.authId&&now-r.at<60000))return {ok:true};
    reports.push({id:crypto.randomUUID(),reporter:authId,target:target.authId,code:lobby.code,at:now,reason,events:(lobby.events||[]).slice(-40)});
    if(reports.length>2000)reports.splice(0,reports.length-2000);
    return {ok:true};
  }
  if (action === 'public') {
    const position = parsePosition(data, LOBBY_MAX_ACCURACY_M);
    return { lobbies: [...lobbies.values()]
      .filter(l => !l.players.some(p=>blocked(authId,p.authId)) && l.visibility === 'PUBLIC' && l.state === 'LOBBY' && l.players.length < MAX_PLAYERS && l.origin)
      .map(l => ({ lobby: l, meters: distance(position, l.players.find(p => p.id === l.hostId)?.location || l.origin) }))
      .filter(x => x.meters <= PUBLIC_RANGE_M)
      .sort((a, b) => a.meters - b.meters)
      .map(({ lobby, meters }) => ({ code: lobby.code, name: lobby.name, players: lobby.players.length, maxPlayers: MAX_PLAYERS, distanceKm: Math.max(0.1, Math.round(meters / 100) / 10) })) };
  }
  if (action === 'lobby-info') {
    const lobby = lobbies.get(clean(data.code, 5).toUpperCase());
    if (!lobby) fail(404, 'Lobby nicht gefunden.');
    updateGame(lobby, now);
    if (lobby.state !== 'LOBBY') fail(409, 'Diese Runde hat bereits begonnen.');
    if (lobby.players.length >= MAX_PLAYERS) fail(409, 'Lobby ist voll.');
    return { code: lobby.code, name: lobby.name, visibility: lobby.visibility, players: lobby.players.length, maxPlayers: MAX_PLAYERS };
  }
  if (action === 'invites') {
    pruneLobbyInvites(now);
    const invites = [...lobbyInvites.values()]
      .filter(invite => invite.targetAuthId === authId && !blocked(authId,invite.fromAuthId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map(invite => {
        const lobby = lobbies.get(invite.code);
        return {
          id: invite.id, code: invite.code, lobbyName: invite.lobbyName, fromName: invite.fromName,
          createdAt: invite.createdAt, expiresAt: invite.expiresAt, players: lobby?.players.length || 0, maxPlayers: MAX_PLAYERS
        };
      });
    return { invites };
  }
  if (action === 'invite-dismiss') {
    const id = clean(data.inviteId, 80);
    const invite = lobbyInvites.get(id);
    if (invite && invite.targetAuthId === authId && !blocked(authId,invite.fromAuthId)) lobbyInvites.delete(id);
    return { ok: true };
  }
  if (action === 'invite') {
    const { lobby, me } = getSession(data, authId);
    if (lobby.state !== 'LOBBY') fail(409, 'Freunde können nur vor dem Spielstart eingeladen werden.');
    const targetAuthId = clean(data.targetAuthId, 100);
    if (!targetAuthId) fail(400, 'Freund fehlt.');
    if((lobby.kickedAuthIds||[]).includes(targetAuthId)){
      if(me.id!==lobby.hostId)fail(403,'Nur der Host kann entfernte Spieler erneut einladen.');
      lobby.kickedAuthIds=lobby.kickedAuthIds.filter(id=>id!==targetAuthId);
    }
    if(blocked(authId,targetAuthId))fail(403,'Einladung wegen Blockierung nicht möglich.');
    if (targetAuthId === authId) fail(400, 'Du kannst dich nicht selbst einladen.');
    for (const [id, invite] of lobbyInvites) {
      if (invite.targetAuthId === targetAuthId && invite.code === lobby.code) lobbyInvites.delete(id);
    }
    const invite = {
      id: crypto.randomUUID(), targetAuthId, fromAuthId: authId, fromName: me.name,
      code: lobby.code, lobbyName: lobby.name, createdAt: now, expiresAt: now + 10 * 60 * 1000
    };
    lobbyInvites.set(invite.id, invite);
    return { ok: true, inviteId: invite.id, expiresAt: invite.expiresAt };
  }
  if (action === 'create') {
    const player = newPlayer(data, authId);
    const visibility = data.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
    const origin = visibility === 'PUBLIC' ? parsePosition(data, LOBBY_MAX_ACCURACY_M) : null;
    if (origin) player.location = { ...origin, at: now };
    const lobby = {
      code: code(), name: clean(data.lobbyName, 40) || 'NIGHT HUNT', visibility, origin,
      background: lobbyScene.background(data.background),
      hostId: player.id, players: [player], state: 'LOBBY', result: null,
      radius: Math.min(10000, Math.max(50, number(data.radius) || 3000)),
      duration: Math.min(3600, Math.max(300, number(data.duration) || 900)),
      headstart: Math.min(300, Math.max(30, number(data.headstart) || 180)),
      escape: Math.min(15, Math.max(10, number(data.escape) || 15)),
      createdAt: now, countdownEndsAt: null, headstartEndsAt: null, endsAt: null,
      messages: []
    };
    lobbies.set(lobby.code, lobby);
    return { userId: player.id, lobby: resultState(lobby, player).lobby };
  }
  if (action === 'join') {
    const lobby = lobbies.get(clean(data.code, 5).toUpperCase());
    if (!lobby) fail(404, 'Lobby nicht gefunden.');

    // A known authenticated participant may rejoin every running phase.
    // New players are still restricted to the waiting lobby.
    updateGame(lobby, now);
    if((lobby.kickedAuthIds||[]).includes(authId))fail(403,'Du wurdest aus dieser Lobby entfernt.');
    const existing = lobby.players.find(p => p.authId === authId);
    if (existing) {
      if (existing.left) fail(409,'Du hast diese Runde verlassen. Ein erneuter Einstieg ist erst nach dem Rematch möglich.');
      existing.name = clean(data.name, 24) || existing.name;
      existing.vehicle = clean(data.vehicle, 70) || existing.vehicle;
      existing.color = clean(data.color, 30) || existing.color;
      existing.bodyType = clean(data.bodyType, 30) || existing.bodyType || '';
      existing.photoUrl = safePhotoUrl(data.photoUrl) || existing.photoUrl || '';
      existing.avatarUrl = safePhotoUrl(data.avatarUrl) || existing.avatarUrl || '';
      if (Number.isFinite(number(data.characterStyle))) {
        existing.characterStyle = Math.max(0, Math.min(2, Math.trunc(number(data.characterStyle))));
      }
      existing.mode = data.mode === 'DRIVER' ? 'DRIVER' : 'PASSENGER';
      existing.level = Math.max(1, Math.min(50, Math.trunc(number(data.level) || existing.level || 1)));
      existing.lastSeen = now;
      clearLobbyInvitesFor(authId, lobby.code);
      return { userId: existing.id, lobby: resultState(lobby, existing).lobby };
    }

    if (lobby.state !== 'LOBBY') fail(409, 'Diese Runde hat bereits begonnen.');
    if (lobby.players.some(p=>blocked(authId,p.authId)))fail(403,'Beitritt wegen Blockierung nicht möglich.');
    if (lobby.players.length >= MAX_PLAYERS) fail(409, 'Lobby ist voll.');
    const player = newPlayer(data, authId);
    if (lobby.visibility === 'PUBLIC') {
      const location = parsePosition(data, LOBBY_MAX_ACCURACY_M);
      if (distance(location, lobby.players.find(p => p.id === lobby.hostId)?.location || lobby.origin) > PUBLIC_RANGE_M) fail(403, 'Diese öffentliche Runde ist zu weit entfernt.');
      player.location = { ...location, at: now };
    }
    lobby.players.push(player);
    clearLobbyInvitesFor(authId, lobby.code);
    return { userId: player.id, lobby: resultState(lobby, player).lobby };
  }
  if (action === 'rejoin-lookup') {
    const lobby=[...lobbies.values()].filter(l=>l.players.some(p=>p.authId===authId&&!p.left)).sort((a,b)=>b.createdAt-a.createdAt)[0];
    const me=lobby?.players.find(p=>p.authId===authId);
    return lobby?{code:lobby.code,userId:me.id}: {code:null};
  }
  const { lobby, me } = getSession(data, authId);
  updateGame(lobby, now);
  if (action === 'debug') {
    const admins=(process.env.CHS_ADMIN_USER_IDS||'').split(',').map(id=>id.trim()).filter(Boolean);
    if(!admins.includes(authId))fail(403,'Debugansicht nur für konfigurierte Administratoren.');
    return {serverTime:now,state:lobby.state,timers:{countdown:lobby.countdownEndsAt,headstart:lobby.headstartEndsAt,end:lobby.endsAt},
      players:lobby.players.map(p=>({id:p.id,role:p.role,gpsAge:p.location?now-p.location.at:null,accuracy:p.location?.accuracy,suspiciousFixes:p.suspiciousFixes||0,gpsGapCount:p.gpsGapCount||0,eliminated:!!p.eliminated,
      distanceFromCheckpoint:p.location&&lobby.origin?distance(p.location,lobby.origin):null})),locks:Object.values(lobby.locks).map(lock=>{const seeker=lobby.players.find(p=>p.id===lock.seekerId),target=lobby.players.find(p=>p.id===lock.targetId);return {...lock,distance:seeker?.location&&target?.location?distance(seeker.location,target.location):null};}),reports:reports.filter(r=>r.code===lobby.code)};
  }
  if (action === 'state') return resultState(lobby, me);
  if (action === 'meetup-route') {
    if (lobby.state !== 'LOBBY') fail(409, 'Der Treffpunkt ist nur im Warteraum verfügbar.');
    const host=lobby.players.find(p=>p.id===lobby.hostId);
    if (host?.id===me.id) return {route:null,message:'Du bist der Treffpunkt deiner Crew.'};
    const point=meetupPoint(lobby);
    if (!point||(!lobby.checkpointFixed&&!fresh(host,now,LOBBY_LOCATION_MAX_AGE_MS))||!fresh(me,now,LOBBY_LOCATION_MAX_AGE_MS)) {
      return {route:null,message:'Für die Route brauchen du und der Host aktuelle GPS-Positionen.'};
    }
    const cached=me.meetupRoute;
    if (cached&&cached.hostId===host.id&&cached.pointKey===point.lat+':'+point.lng&&now-cached.at<15000) return cached.pending;
    const pending=roadRoute(me.location,point)
      .then(route=>({route,hostId:host.id,target:{lat:point.lat,lng:point.lng}}))
      .catch(()=>({route:null,message:'Straßenroute gerade nicht verfügbar. Der Treffpunkt bleibt sichtbar.'}));
    me.meetupRoute={hostId:host.id,pointKey:point.lat+':'+point.lng,at:now,pending};
    return pending;
  }
  if (action === 'background') {
    if (me.id !== lobby.hostId) fail(403, 'Nur der Host darf den Hintergrund ändern.');
    if (lobby.state !== 'LOBBY') fail(409, 'Hintergründe sind nur im Warteraum änderbar.');
    if (!lobbyScene.validBackground(data.background)) fail(400, 'Unbekannter Hintergrund.');
    lobby.background = data.background;
    return resultState(lobby, me);
  }
  if (action === 'settings') {
    if (me.id !== lobby.hostId) fail(403, 'Nur der Host darf die Lobby ändern.');
    if (lobby.state !== 'LOBBY') fail(409, 'Einstellungen sind nur vor dem Rundenstart änderbar.');
    if (data.revision !== (lobby.settingsRevision || 0)) fail(409, 'Die Einstellungen wurden bereits geändert. Bitte erneut öffnen.');
    const name = clean(data.lobbyName, 40);
    if (!name) fail(400, 'Bitte einen Lobby-Namen eingeben.');
    if (!['PUBLIC', 'PRIVATE'].includes(data.visibility)) fail(400, 'Ungültige Sichtbarkeit.');
    const bounds = { radius: [50, 10000], duration: [300, 3600], headstart: [30, 300], escape: [10, 15] };
    const values = {};
    for (const [key, [min, max]] of Object.entries(bounds)) {
      if (typeof data[key] !== 'number' || !Number.isInteger(data[key]) || data[key] < min || data[key] > max)
        fail(400, `Ungültiger Wert für ${key} (${min}–${max}).`);
      values[key] = data[key];
    }
    if (data.visibility === 'PUBLIC' && !lobby.origin) fail(409, 'Für öffentliche Lobbys muss zuerst der GPS-Mittelpunkt feststehen.');
    if (typeof data.replaceSeekers === 'boolean') values.replaceSeekers = data.replaceSeekers;
    const changed = lobby.name !== name || lobby.visibility !== data.visibility || Object.keys(values).some(key => lobby[key] !== values[key]);
    if (changed) {
      Object.assign(lobby, values, { name, visibility: data.visibility, settingsRevision: (lobby.settingsRevision || 0) + 1 });
      for (const p of lobby.players) p.ready = false;
      lobby.messages.push({ id: crypto.randomUUID(), sender: 'system', name: 'Lobby', body: 'Der Host hat die Einstellungen geändert. Bitte erneut bereit melden.', at: now });
      if (lobby.messages.length > 100) lobby.messages.splice(0, lobby.messages.length - 100);
    }
    return resultState(lobby, me);
  }
  if (action === 'chat') {
    const body = clean(data.body, 500);
    if (!body) fail(400, 'Bitte eine Nachricht eingeben.');
    if (body.length > 500) fail(400, 'Nachricht ist zu lang.');
    if (now - (me.lastChatAt || 0) < 1000) fail(429, 'Bitte kurz warten.');
    me.lastChatAt = now;
    lobby.messages.push({ id: crypto.randomUUID(), sender: me.id, name: me.name, body, at: now });
    if (lobby.messages.length > 100) lobby.messages.splice(0, lobby.messages.length - 100);
    return { ok: true };
  }
  if (action === 'location') {
    if (lobby.state === 'RESULT' || (round.playing(lobby) && !round.active(me))) return {ok:true,tracking:false};
    const maxAccuracy = lobby.state === 'LOBBY'
      ? LOBBY_MAX_ACCURACY_M
      : ACTIVE_MAX_ACCURACY_M;
    updateLocation(me, data, maxAccuracy);
    if (me.id === lobby.hostId && lobby.state==='LOBBY' && !lobby.checkpointFixed) lobby.origin = {lat:me.location.lat,lng:me.location.lng};
    updateGame(lobby,now);
    return { ok: true };
  }
  if (action === 'ready') {
    if (lobby.state !== 'LOBBY') fail(409, 'Runde läuft bereits.');
    me.ready = !!data.ready;
    return { ok: true };
  }
  if (action === 'start') {
    if(process.env.RENDER && stateStore && !stateStore.durable)fail(503,'Spielrunden sind vorübergehend nicht verfügbar. Bitte später erneut versuchen.');
    if (me.id !== lobby.hostId) fail(403, 'Nur der Host kann starten.');
    if (lobby.state !== 'LOBBY' && lobby.roundStartedAt) return {ok:true};
    if (lobby.state !== 'LOBBY') fail(409, 'Runde läuft bereits.');
    if(!lobby.origin)fail(409,'Ein gültiger GPS-Treffpunkt fehlt.');
    if (lobby.players.length < 2) fail(409, 'Mindestens zwei Spieler nötig.');
    if (!lobby.players.every(p => now-p.lastSeen<30000 && fresh(p, now, LOBBY_LOCATION_MAX_AGE_MS))) {
      fail(409, 'Alle Spieler brauchen einen aktuellen Standort.');
    }
    if (
      lobby.origin &&
      !lobby.players.every(
        p => p.location.accuracy <= 25 && distance(p.location, lobby.origin) + p.location.accuracy <= round.LIMITS.start
      )
    ) {
      fail(409, 'Alle Spieler müssen mit GPS-Genauigkeit bis 25 m innerhalb von 50 m am Treffpunkt stehen.');
    }
    if (!lobby.players.every(p => p.id === me.id || p.ready)) fail(409, 'Noch nicht alle Spieler sind bereit.');
    assignRoundRoles(lobby.players);
    lobby.state = 'COUNTDOWN'; lobby.countdownEndsAt = now + 5000;
    round.startRound(lobby,now);
    clearLobbyInvitesForCode(lobby.code);
    return { ok: true };
  }
  if (action === 'found') {
    const response = round.beginLock(lobby,me,data.targetId,now,distance);
    if (response.error) fail(response.status,response.error);
    return response;
  }
  if (action === 'activity') { me.lastActivityAt=now; return {ok:true}; }
  if (action === 'checkpoint') {
    if (me.id!==lobby.hostId || lobby.state!=='LOBBY') fail(403,'Nur der Host kann vor dem Start den Treffpunkt setzen.');
    if (!fresh(me,now,LOBBY_LOCATION_MAX_AGE_MS) || me.location.accuracy>25) fail(409,'Aktuelles GPS mit höchstens 25 m Genauigkeit erforderlich.');
    lobby.origin={lat:me.location.lat,lng:me.location.lng};lobby.checkpointFixed=true;
    lobby.settingsRevision=(lobby.settingsRevision||0)+1;
    lobby.players.forEach(p=>p.ready=false);
    return resultState(lobby,me);
  }
  if (action === 'kick') {
    if (me.id!==lobby.hostId || lobby.state!=='LOBBY') fail(403,'Entfernen ist nur durch den Host vor dem Start möglich.');
    if (data.targetId===me.id) fail(400,'Du kannst dich nicht selbst entfernen.');
    const target=lobby.players.find(p=>p.id===data.targetId);
    if(target)lobby.kickedAuthIds=[...new Set([...(lobby.kickedAuthIds||[]),target.authId])].slice(-200);
    lobby.players=lobby.players.filter(p=>p.id!==data.targetId);
    return resultState(lobby,me);
  }
  if (action === 'abort-vote') {
    if (!round.playing(lobby)||!round.active(me)) fail(409,'Keine aktive Runde.');
    if (!lobby.abortVotes.includes(me.id)) lobby.abortVotes.push(me.id);
    const voters=lobby.players.filter(round.active);
    const votes=lobby.abortVotes.filter(id=>voters.some(p=>p.id===id)).length;
    if (votes>voters.length/2) {round.finish(lobby,false,'ABORT_VOTE',now);updateGame(lobby,now);}
    return {ok:true,votes,required:Math.floor(voters.length/2)+1};
  }
  if (action === 'rematch') {
    if(me.id===lobby.hostId&&lobby.state==='LOBBY')return {ok:true};
    if (me.id !== lobby.hostId || lobby.state !== 'RESULT') fail(403, 'Nur der Host kann eine neue Runde starten.');
    lobby.players=lobby.players.filter(p=>!p.left);
    lobby.locks={};lobby.abortVotes=[];lobby.roundStartedAt=null;
    lobby.state = 'LOBBY'; lobby.result = null; lobby.countdownEndsAt = lobby.headstartEndsAt = lobby.endsAt = null;
    for (const p of lobby.players) { p.role = null; p.found = false; p.eliminated=false; p.eliminationReason=""; p.roundFinds = 0; p.ready = false; p.cooldownUntil = 0; }
    return { ok: true };
  }
  if (action === 'leave') {
    if (round.playing(lobby)) { round.eliminate(lobby,me,'LEFT',now); me.left=true; updateGame(lobby,now); return {ok:true}; }
    lobby.players = lobby.players.filter(p => p.id !== me.id);
    if (!lobby.players.length) { lobbies.delete(lobby.code); clearLobbyInvitesForCode(lobby.code); }
    else if (lobby.hostId === me.id) lobby.hostId = lobby.players[0].id;
    return { ok: true };
  }
  fail(404, 'Unbekannte Funktion.');
}
async function removeVehicleBackground(data) {
  if (!REMOVE_BG_API_KEY) {
    fail(503, 'Bildfreistellung nicht eingerichtet: In Render fehlt REMOVE_BG_API_KEY.');
  }

  const value = String(data.image || '');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) fail(400, 'Ungültiges Fahrzeugbild.');

  const base64 = match[2];
  const approxBytes = Math.floor(base64.length * 0.75);
  if (!approxBytes || approxBytes > 3 * 1024 * 1024) {
    fail(413, 'Das vorbereitete Fahrzeugbild ist zu groß.');
  }

  const boundary = `----chs${crypto.randomBytes(12).toString('hex')}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="image_file_b64"\r\n\r\n${base64}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\npreview\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\ncar\r\n`,
    `--${boundary}--\r\n`
  ];
  const body = Buffer.from(parts.join(''), 'utf8');

  const response = await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.remove.bg',
      path: '/v1.0/removebg',
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Accept': 'image/png'
      },
      timeout: 45000
    }, res => {
      const chunks = [];
      let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total <= 10 * 1024 * 1024) chunks.push(chunk);
        else request.destroy(new Error('Antwort der Bildfreistellung ist zu groß.'));
      });
      res.on('end', () => resolve({ status: res.statusCode || 500, headers: res.headers, body: Buffer.concat(chunks) }));
    });

    request.on('timeout', () => request.destroy(new Error('Zeitüberschreitung bei remove.bg.')));
    request.on('error', reject);
    request.end(body);
  }).catch(error => {
    console.error('remove.bg request failed:', error);
    fail(502, 'Bildfreistellung ist gerade nicht erreichbar. Bitte erneut versuchen.');
  });

  if (!response || response.status < 200 || response.status >= 300) {
    const detail = response?.body?.toString('utf8') || '';
    console.error('remove.bg error:', response?.status, detail.slice(0, 800));
    if (response?.status === 400) fail(400, 'remove.bg konnte dieses Foto nicht verarbeiten. Bitte ein anderes Foto testen.');
    if (response?.status === 402) fail(503, 'Das remove.bg-Kontingent ist aufgebraucht.');
    if (response?.status === 403) fail(503, 'REMOVE_BG_API_KEY ist ungültig oder nicht freigeschaltet.');
    if (response?.status === 429) fail(503, 'Zu viele Bildanfragen. Bitte kurz warten.');
    fail(502, `Bildfreistellung fehlgeschlagen${response?.status ? ` (HTTP ${response.status})` : ''}.`);
  }

  const contentType = String(response.headers['content-type'] || '');
  if (!contentType.includes('image/')) {
    console.error('remove.bg unexpected content-type:', contentType, response.body.toString('utf8').slice(0, 500));
    fail(502, 'remove.bg hat kein Bild zurückgegeben.');
  }

  if (!response.body.length) fail(502, 'remove.bg hat ein leeres Bild zurückgegeben.');
  return { image: `data:image/png;base64,${response.body.toString('base64')}` };
}

const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const action = url.pathname.slice(5);

      if (action === 'remove-background') {
        if (req.method !== 'POST') fail(405, 'Methode nicht erlaubt.');
        await verifyAuth(req);
        const data = await readBody(req, 5 * 1024 * 1024);
        send(res, 200, await removeVehicleBackground(data));
        return;
      }

      if (!['public','lobby-info','invites','invite','invite-dismiss','create','join','state','location','ready','start','found','rematch','leave','chat','settings','background','meetup-route','activity','checkpoint','kick','abort-vote','rejoin-lookup','debug','block','report'].includes(action)) fail(404, 'Unbekannte Funktion.');
      if (req.method !== (['public','state','lobby-info','invites','meetup-route','rejoin-lookup','debug','block','report'].includes(action) ? 'GET' : 'POST')) fail(405, 'Methode nicht erlaubt.');
      const authId = await verifyAuth(req);
      const data = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req);
      const response=await route(action,data,authId);
      await persist();
      send(res,200,response);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Methode nicht erlaubt.');
    const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(ROOT, '.' + requestPath);
    if (!file.startsWith(ROOT + path.sep)) fail(403, 'Zugriff verweigert.');
    const extension=path.extname(file);
    if (!types[extension] || ['server.js','round-engine.js','state-store.js','game-rules.js','meetup-route.js','package.json'].includes(path.basename(file)) || requestPath.startsWith('/supabase/')) fail(404, 'Datei nicht gefunden.');
    const stat = await fs.promises.stat(file).catch(() => null);
    if (!stat?.isFile() || path.basename(file) === 'server.js' || requestPath.split('/').some(part => part.startsWith('.'))) fail(404, 'Datei nicht gefunden.');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch (err) {
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Serverfehler.', ...(err.extra || {}) });
    if (!err.status) console.error(err);
  }
}
setInterval(() => {
  const now = Date.now();
  for (const [key, lobby] of lobbies) {
    updateGame(lobby, now);
    if (now - lobby.createdAt > 6 * 60 * 60 * 1000 || (lobby.state === 'LOBBY' && now - Math.max(...lobby.players.map(p => p.lastSeen)) > 10 * 60 * 1000)) {
      lobbies.delete(key);
      clearLobbyInvitesForCode(key);
    }
  }
  pruneLobbyInvites(now);
  for(const [id,record]of roundHistory)if(now-record.result.endedAt>=30*86400000)roundHistory.delete(id);
  for(let index=reports.length-1;index>=0;index--)if(now-reports[index].at>=30*86400000)reports.splice(index,1);
  void persist().catch(error=>console.error('State storage failed:',error.message));
}, 1000).unref();
if (require.main === module) {
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const file=process.env.CHS_STATE_FILE || (!process.env.RENDER?path.join(ROOT,'.state','gameplay.json'):null);
  if(!key&&!file&&process.env.RENDER) console.error('Gameplay persistence is not configured. Set SUPABASE_SECRET_KEY before hosting real rounds.');
  restore(createStore({url:SUPABASE_URL,key,file})).then(()=>{
    http.createServer(handler).listen(PORT,()=>console.log(`Car Hide & Seek auf Port ${PORT}`));
  }).catch(error=>{console.error('State recovery failed:',error.message);process.exitCode=1;});
}
module.exports = { handler, route, distance, lobbies, lobbyInvites, HttpError,restore,blocks,reports,roundHistory };
