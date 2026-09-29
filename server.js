'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yyvljkzitodxhtkilsxm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zgP-ABl8eaVGLkheMdlVWw_0TeZIEr8';
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || '';
const lobbies = new Map();
const lobbyInvites = new Map();
const authCache = new Map();
const MAX_PLAYERS = 20;
const PUBLIC_RANGE_M = 20000;
const FIND_RANGE_M = 35;
const ACTIVE_LOCATION_MAX_AGE_MS = 15000;
const LOBBY_LOCATION_MAX_AGE_MS = 45000;
const LOBBY_MAX_ACCURACY_M = 200;
const ACTIVE_MAX_ACCURACY_M = 100;
const FIND_MAX_ACCURACY_M = 25;

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
const goodFindFix = (p, now) =>
  fresh(p, now, ACTIVE_LOCATION_MAX_AGE_MS) &&
  p.location.accuracy <= FIND_MAX_ACCURACY_M;
const withinFindRange = (a, b) => distance(a.location, b.location) + a.location.accuracy + b.location.accuracy <= FIND_RANGE_M;
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
    photoUrl: safePhotoUrl(data.photoUrl),
    mode: data.mode === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
    level: 1, role: null, ready: false, found: false, location: null,
    lastSeen: Date.now(), cooldownUntil: 0
  };
}
function publicPlayer(p, now, maxAge = ACTIVE_LOCATION_MAX_AGE_MS) {
  return {
    id: p.id, name: p.name, vehicle: p.vehicle, color: p.color,
    photoUrl: p.photoUrl || '', mode: p.mode,
    level: p.level, role: p.role, ready: p.ready, found: p.found,
    connected: now - p.lastSeen < 30000, hasLocation: fresh(p, now, maxAge)
  };
}
function updateGame(lobby, now = Date.now()) {
  if (lobby.state === 'COUNTDOWN' && now >= lobby.countdownEndsAt) {
    lobby.state = 'HEADSTART'; lobby.headstartEndsAt = now + lobby.headstart * 1000;
  }
  if (lobby.state === 'HEADSTART' && now >= lobby.headstartEndsAt) {
    lobby.state = 'ACTIVE'; lobby.endsAt = now + lobby.duration * 1000;
  }
  if (lobby.state === 'ACTIVE' && now >= lobby.endsAt) finish(lobby, false);
}
function finish(lobby, seekersWin) {
  lobby.state = 'RESULT';
  lobby.result = {
    seekersWin, found: lobby.players.filter(p => p.role === 'HIDER' && p.found).length,
    totalHiders: lobby.players.filter(p => p.role === 'HIDER').length
  };
}
function resultState(lobby, me) {
  const now = Date.now();
  updateGame(lobby, now);
  const locationMaxAge = lobby.state === 'LOBBY'
    ? LOBBY_LOCATION_MAX_AGE_MS
    : ACTIVE_LOCATION_MAX_AGE_MS;
  const opponents = lobby.players.filter(
    p => p.id !== me.id && !p.found && fresh(p, now, locationMaxAge) && p.role && p.role !== me.role
  );
  const nearest = fresh(me, now)
    ? opponents.map(p => ({ p, meters: distance(me.location, p.location) })).sort((a, b) => a.meters - b.meters)[0]
    : null;
  const proximity = nearest ? {
    distance: Math.round(nearest.meters / 10) * 10,
    level: nearest.meters < 50 ? 'VERY_CLOSE' : nearest.meters < 150 ? 'CLOSE' : nearest.meters < 500 ? 'NEAR' : 'FAR'
  } : null;
  const nearbyTargets = me.role === 'SEEKER' && lobby.state === 'ACTIVE' && goodFindFix(me, now)
    ? opponents.filter(p => p.role === 'HIDER' && goodFindFix(p, now) && withinFindRange(me, p)).map(p => p.id)
    : [];
  return {
    serverTime: now, proximity, nearbyTargets,
    chat: lobby.messages.slice(-50),
    map: {
      center: lobby.origin ? { lat: lobby.origin.lat, lng: lobby.origin.lng } : null,
      radius: lobby.radius,
      positions: lobby.players.filter(p => fresh(p, now, locationMaxAge)).map(p => ({
        id: p.id, name: p.name, role: p.role, found: p.found,
        lat: p.location.lat, lng: p.location.lng,
        accuracy: p.location.accuracy, updatedAt: p.location.at
      }))
    },
    cooldownUntil: me.cooldownUntil, escapeUntil: 0,
    lobby: {
      code: lobby.code, name: lobby.name, visibility: lobby.visibility,
      settings: { radius: lobby.radius, duration: lobby.duration, headstart: lobby.headstart, revision: lobby.settingsRevision || 0 },
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
  if (p.location) {
    const seconds = (now - p.location.at) / 1000;
    const traveled = distance(p.location, point);
    if (seconds > 0 && traveled > 60 * seconds + p.location.accuracy + point.accuracy + 40)
      fail(400, 'Unplausibler GPS-Sprung. Bitte Position erneut ermitteln.');
  }
  p.location = { ...point, at: now };
}
async function route(action, data, authId) {
  const now = Date.now();
  if (action === 'public') {
    const position = parsePosition(data, LOBBY_MAX_ACCURACY_M);
    return { lobbies: [...lobbies.values()]
      .filter(l => l.visibility === 'PUBLIC' && l.state === 'LOBBY' && l.players.length < MAX_PLAYERS && l.origin)
      .map(l => ({ lobby: l, meters: distance(position, l.origin) }))
      .filter(x => x.meters <= Math.min(PUBLIC_RANGE_M, x.lobby.radius))
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
      .filter(invite => invite.targetAuthId === authId)
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
    if (invite && invite.targetAuthId === authId) lobbyInvites.delete(id);
    return { ok: true };
  }
  if (action === 'invite') {
    const { lobby, me } = getSession(data, authId);
    if (lobby.state !== 'LOBBY') fail(409, 'Freunde können nur vor dem Spielstart eingeladen werden.');
    const targetAuthId = clean(data.targetAuthId, 100);
    if (!targetAuthId) fail(400, 'Freund fehlt.');
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
      hostId: player.id, players: [player], state: 'LOBBY', result: null,
      radius: Math.min(10000, Math.max(200, number(data.radius) || 3000)),
      duration: Math.min(3600, Math.max(300, number(data.duration) || 900)),
      headstart: Math.min(300, Math.max(30, number(data.headstart) || 180)),
      escape: Math.min(30, Math.max(10, number(data.escape) || 15)),
      createdAt: now, countdownEndsAt: null, headstartEndsAt: null, endsAt: null,
      messages: []
    };
    lobbies.set(lobby.code, lobby);
    return { userId: player.id, lobby: resultState(lobby, player).lobby };
  }
  if (action === 'join') {
    const lobby = lobbies.get(clean(data.code, 5).toUpperCase());
    if (!lobby) fail(404, 'Lobby nicht gefunden.');
    if (lobby.state !== 'LOBBY') fail(409, 'Diese Runde hat bereits begonnen.');
    if (lobby.players.length >= MAX_PLAYERS) fail(409, 'Lobby ist voll.');
    const existing = lobby.players.find(p => p.authId === authId);
    if (existing) {
      existing.name = clean(data.name, 24) || existing.name;
      existing.vehicle = clean(data.vehicle, 70) || existing.vehicle;
      existing.color = clean(data.color, 30) || existing.color;
      existing.photoUrl = safePhotoUrl(data.photoUrl) || existing.photoUrl || '';
      existing.mode = data.mode === 'DRIVER' ? 'DRIVER' : 'PASSENGER';
      existing.lastSeen = now;
      clearLobbyInvitesFor(authId, lobby.code);
      return { userId: existing.id, lobby: resultState(lobby, existing).lobby };
    }
    const player = newPlayer(data, authId);
    if (lobby.visibility === 'PUBLIC') {
      const location = parsePosition(data, LOBBY_MAX_ACCURACY_M);
      if (distance(location, lobby.origin) > Math.min(PUBLIC_RANGE_M, lobby.radius)) fail(403, 'Diese öffentliche Runde ist zu weit entfernt.');
      player.location = { ...location, at: now };
    }
    lobby.players.push(player);
    clearLobbyInvitesFor(authId, lobby.code);
    return { userId: player.id, lobby: resultState(lobby, player).lobby };
  }
  const { lobby, me } = getSession(data, authId);
  updateGame(lobby, now);
  if (action === 'state') return resultState(lobby, me);
  if (action === 'settings') {
    if (me.id !== lobby.hostId) fail(403, 'Nur der Host darf die Lobby ändern.');
    if (lobby.state !== 'LOBBY') fail(409, 'Einstellungen sind nur vor dem Rundenstart änderbar.');
    if (data.revision !== (lobby.settingsRevision || 0)) fail(409, 'Die Einstellungen wurden bereits geändert. Bitte erneut öffnen.');
    const name = clean(data.lobbyName, 40);
    if (!name) fail(400, 'Bitte einen Lobby-Namen eingeben.');
    if (!['PUBLIC', 'PRIVATE'].includes(data.visibility)) fail(400, 'Ungültige Sichtbarkeit.');
    const bounds = { radius: [200, 10000], duration: [300, 3600], headstart: [30, 300] };
    const values = {};
    for (const [key, [min, max]] of Object.entries(bounds)) {
      if (typeof data[key] !== 'number' || !Number.isInteger(data[key]) || data[key] < min || data[key] > max)
        fail(400, `Ungültiger Wert für ${key} (${min}–${max}).`);
      values[key] = data[key];
    }
    if (data.visibility === 'PUBLIC' && !lobby.origin) fail(409, 'Für öffentliche Lobbys muss zuerst der GPS-Mittelpunkt feststehen.');
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
    const maxAccuracy = lobby.state === 'LOBBY'
      ? LOBBY_MAX_ACCURACY_M
      : ACTIVE_MAX_ACCURACY_M;
    updateLocation(me, data, maxAccuracy);
    if (!lobby.origin && me.id === lobby.hostId) lobby.origin = me.location;
    return { ok: true };
  }
  if (action === 'ready') {
    if (lobby.state !== 'LOBBY') fail(409, 'Runde läuft bereits.');
    me.ready = !!data.ready;
    return { ok: true };
  }
  if (action === 'start') {
    if (me.id !== lobby.hostId) fail(403, 'Nur der Host kann starten.');
    if (lobby.state !== 'LOBBY') fail(409, 'Runde läuft bereits.');
    if (lobby.players.length < 2) fail(409, 'Mindestens zwei Spieler nötig.');
    if (!lobby.players.every(p => fresh(p, now, LOBBY_LOCATION_MAX_AGE_MS))) {
      fail(409, 'Alle Spieler brauchen einen aktuellen Standort.');
    }
    if (
      lobby.origin &&
      !lobby.players.every(
        p => distance(p.location, lobby.origin) <= lobby.radius + Math.min(LOBBY_MAX_ACCURACY_M, p.location.accuracy || 0)
      )
    ) {
      fail(409, 'Mindestens ein Spieler ist außerhalb des Spielradius.');
    }
    if (!lobby.players.every(p => p.id === me.id || p.ready)) fail(409, 'Noch nicht alle Spieler sind bereit.');
    for (const p of lobby.players) { p.role = p.id === lobby.hostId ? 'SEEKER' : 'HIDER'; p.found = false; }
    lobby.state = 'COUNTDOWN'; lobby.countdownEndsAt = now + 5000;
    clearLobbyInvitesForCode(lobby.code);
    return { ok: true };
  }
  if (action === 'found') {
    if (lobby.state !== 'ACTIVE' || me.role !== 'SEEKER') fail(409, 'Fund derzeit nicht möglich.');
    if (me.cooldownUntil > now) fail(429, 'Bitte vor dem nächsten Fundversuch warten.');
    const target = lobby.players.find(p => p.id === data.targetId && p.role === 'HIDER' && !p.found);
    if (!target) fail(404, 'Fahrzeug nicht mehr verfügbar.');
    if (!goodFindFix(me, now) || !goodFindFix(target, now)) fail(409, 'Beide GPS-Positionen müssen aktuell und genau sein.');
    const meters = distance(me.location, target.location);
    if (!withinFindRange(me, target)) {
      me.cooldownUntil = now + 5000;
      fail(409, 'Du bist noch nicht nah genug am Fahrzeug oder GPS ist zu ungenau.', { distance: meters });
    }
    target.found = true;
    me.cooldownUntil = now + 3000;
    if (lobby.players.filter(p => p.role === 'HIDER').every(p => p.found)) finish(lobby, true);
    return { ok: true, distance: meters };
  }
  if (action === 'rematch') {
    if (me.id !== lobby.hostId || lobby.state !== 'RESULT') fail(403, 'Nur der Host kann eine neue Runde starten.');
    lobby.state = 'LOBBY'; lobby.result = null; lobby.countdownEndsAt = lobby.headstartEndsAt = lobby.endsAt = null;
    for (const p of lobby.players) { p.role = null; p.found = false; p.ready = false; p.cooldownUntil = 0; }
    return { ok: true };
  }
  if (action === 'leave') {
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

      if (!['public','lobby-info','invites','invite','invite-dismiss','create','join','state','location','ready','start','found','rematch','leave','chat','settings'].includes(action)) fail(404, 'Unbekannte Funktion.');
      if (req.method !== (['public','state','lobby-info','invites'].includes(action) ? 'GET' : 'POST')) fail(405, 'Methode nicht erlaubt.');
      const authId = await verifyAuth(req);
      const data = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req);
      send(res, 200, await route(action, data, authId));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Methode nicht erlaubt.');
    const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(ROOT, '.' + requestPath);
    if (!file.startsWith(ROOT + path.sep)) fail(403, 'Zugriff verweigert.');
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
}, 30000).unref();
if (require.main === module) http.createServer(handler).listen(PORT, () => console.log(`Car Hide & Seek auf Port ${PORT}`));
module.exports = { handler, route, distance, lobbies, lobbyInvites, HttpError };
