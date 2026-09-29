'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yyvljkzitodxhtkilsxm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zgP-ABl8eaVGLkheMdlVWw_0TeZIEr8';
const lobbies = new Map();
const authCache = new Map();
const MAX_PLAYERS = 20;
const PUBLIC_RANGE_M = 20000;
const FIND_RANGE_M = 35;
const LOCATION_MAX_AGE_MS = 15000;
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
const fresh = (p, now = Date.now()) => !!p?.location && now - p.location.at <= LOCATION_MAX_AGE_MS;
const goodFindFix = (p, now) => fresh(p, now) && p.location.accuracy <= FIND_MAX_ACCURACY_M;
const withinFindRange = (a, b) => distance(a.location, b.location) + a.location.accuracy + b.location.accuracy <= FIND_RANGE_M;
const code = () => {
  let candidate;
  do { candidate = crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }
  while (candidate.length !== 5 || lobbies.has(candidate));
  return candidate;
};

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
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8192) { reject(new HttpError(413, 'Anfrage zu groß.')); req.destroy(); }
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
function newPlayer(data, authId) {
  const name = clean(data.name, 24);
  const vehicle = clean(data.vehicle, 70);
  if (!name || !vehicle) fail(400, 'Spielername und Fahrzeug fehlen.');
  return {
    id: crypto.randomUUID(), authId, name, vehicle,
    color: clean(data.color, 30) || 'Unbekannt',
    mode: data.mode === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
    level: 1, role: null, ready: false, found: false, location: null,
    lastSeen: Date.now(), cooldownUntil: 0
  };
}
function publicPlayer(p, now) {
  return {
    id: p.id, name: p.name, vehicle: p.vehicle, color: p.color, mode: p.mode,
    level: p.level, role: p.role, ready: p.ready, found: p.found,
    connected: now - p.lastSeen < 30000, hasLocation: fresh(p, now)
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
  const opponents = lobby.players.filter(p => p.id !== me.id && !p.found && fresh(p, now) && p.role && p.role !== me.role);
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
    cooldownUntil: me.cooldownUntil, escapeUntil: 0,
    lobby: {
      code: lobby.code, name: lobby.name, visibility: lobby.visibility,
      state: lobby.state, hostId: lobby.hostId, players: lobby.players.map(p => publicPlayer(p, now)),
      me: publicPlayer(me, now), countdownEndsAt: lobby.countdownEndsAt,
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
function updateLocation(p, data) {
  const point = parsePosition(data);
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
    const position = parsePosition(data);
    return { lobbies: [...lobbies.values()]
      .filter(l => l.visibility === 'PUBLIC' && l.state === 'LOBBY' && l.players.length < MAX_PLAYERS && l.origin)
      .map(l => ({ lobby: l, meters: distance(position, l.origin) }))
      .filter(x => x.meters <= Math.min(PUBLIC_RANGE_M, x.lobby.radius))
      .sort((a, b) => a.meters - b.meters)
      .map(({ lobby, meters }) => ({ code: lobby.code, name: lobby.name, players: lobby.players.length, maxPlayers: MAX_PLAYERS, distanceKm: Math.max(0.1, Math.round(meters / 100) / 10) })) };
  }
  if (action === 'create') {
    const player = newPlayer(data, authId);
    const visibility = data.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
    const origin = visibility === 'PUBLIC' ? parsePosition(data) : null;
    if (origin) player.location = { ...origin, at: now };
    const lobby = {
      code: code(), name: clean(data.lobbyName, 40) || 'NIGHT HUNT', visibility, origin,
      hostId: player.id, players: [player], state: 'LOBBY', result: null,
      radius: Math.min(10000, Math.max(1000, number(data.radius) || 3000)),
      duration: Math.min(3600, Math.max(300, number(data.duration) || 900)),
      headstart: Math.min(300, Math.max(30, number(data.headstart) || 180)),
      escape: Math.min(30, Math.max(10, number(data.escape) || 15)),
      createdAt: now, countdownEndsAt: null, headstartEndsAt: null, endsAt: null
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
    if (existing) return { userId: existing.id, lobby: resultState(lobby, existing).lobby };
    const player = newPlayer(data, authId);
    if (lobby.visibility === 'PUBLIC') {
      const location = parsePosition(data);
      if (distance(location, lobby.origin) > Math.min(PUBLIC_RANGE_M, lobby.radius)) fail(403, 'Diese öffentliche Runde ist zu weit entfernt.');
      player.location = { ...location, at: now };
    }
    lobby.players.push(player);
    return { userId: player.id, lobby: resultState(lobby, player).lobby };
  }
  const { lobby, me } = getSession(data, authId);
  updateGame(lobby, now);
  if (action === 'state') return resultState(lobby, me);
  if (action === 'location') {
    updateLocation(me, data);
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
    if (!lobby.players.every(p => fresh(p, now))) fail(409, 'Alle Spieler brauchen aktuelles GPS.');
    if (lobby.origin && !lobby.players.every(p => distance(p.location, lobby.origin) <= lobby.radius)) fail(409, 'Mindestens ein Spieler ist außerhalb des Spielradius.');
    if (!lobby.players.every(p => p.id === me.id || p.ready)) fail(409, 'Noch nicht alle Spieler sind bereit.');
    for (const p of lobby.players) { p.role = p.id === lobby.hostId ? 'SEEKER' : 'HIDER'; p.found = false; }
    lobby.state = 'COUNTDOWN'; lobby.countdownEndsAt = now + 5000;
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
    if (!lobby.players.length) lobbies.delete(lobby.code);
    else if (lobby.hostId === me.id) lobby.hostId = lobby.players[0].id;
    return { ok: true };
  }
  fail(404, 'Unbekannte Funktion.');
}
const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const action = url.pathname.slice(5);
      if (!['public','create','join','state','location','ready','start','found','rematch','leave'].includes(action)) fail(404, 'Unbekannte Funktion.');
      if (req.method !== (['public','state'].includes(action) ? 'GET' : 'POST')) fail(405, 'Methode nicht erlaubt.');
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
    if (now - lobby.createdAt > 6 * 60 * 60 * 1000 || (lobby.state === 'LOBBY' && now - Math.max(...lobby.players.map(p => p.lastSeen)) > 10 * 60 * 1000)) lobbies.delete(key);
  }
}, 30000).unref();
if (require.main === module) http.createServer(handler).listen(PORT, () => console.log(`Car Hide & Seek auf Port ${PORT}`));
module.exports = { handler, route, distance, lobbies, HttpError };
