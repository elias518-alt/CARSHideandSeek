// Karten-Reparatur: funktioniert mit dem bestehenden module-Script.
let maplibregl = null;
let loading = false;
let loadFailed = false;
let loadTimer;
function loadAsset(url, css = false) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(css ? 'link' : 'script');
    const timer = setTimeout(() => { el.remove(); reject(new Error('Zeitüberschreitung: ' + url)); }, 12000);
    el.onload = () => { clearTimeout(timer); resolve(); };
    el.onerror = () => { clearTimeout(timer); el.remove(); reject(new Error('Laden fehlgeschlagen: ' + url)); };
    if (css) { el.rel = 'stylesheet'; el.href = url; }
    else { el.src = url; el.async = true; }
    document.head.appendChild(el);
  });
}
async function loadLibrary() {
  if (loading || maplibregl || loadFailed) return;
  loading = true;
  setStatus('Kartenbibliothek wird geladen…');
  for (const base of ['https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/', 'https://unpkg.com/maplibre-gl@5.6.0/dist/']) {
    try {
      await Promise.all([loadAsset(base + 'maplibre-gl.css', true), loadAsset(base + 'maplibre-gl.js')]);
      if (!window.maplibregl) throw new Error('Kartenbibliothek fehlt');
      maplibregl = window.maplibregl;
      loading = false;
      initialize(latest?.map || {});
      return;
    } catch (error) { console.error('Kartenbibliothek:', error); }
  }
  loading = false;
  loadFailed = true;
  setStatus('Kartenbibliothek blockiert oder nicht erreichbar. Internetverbindung prüfen und Seite neu laden.');
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const mapNode = document.getElementById('liveMap');
const shell = document.querySelector('.mapShell');
const statusNode = document.getElementById('mapStatus');
const legend = document.getElementById('mapLegend');
let map = null;
let ready = false;
let latest = null;
let fitted = false;
let lastCircleKey = '';
const markers = new Map();

function circleGeoJSON(center, radiusMeters) {
  const earthRadius = 6371008.8;
  const lat1 = center.lat * Math.PI / 180;
  const lon1 = center.lng * Math.PI / 180;
  const angular = radiusMeters / earthRadius;
  const coordinates = [];
  for (let i = 0; i <= 96; i++) {
    const bearing = (i / 96) * 2 * Math.PI;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
    coordinates.push([lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coordinates] }, properties: {} };
}
function validPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
function setStatus(message) {
  if (!statusNode) return;
  statusNode.textContent = message;
  statusNode.hidden = !message;
}
function initialize(data) {
  const initial = validPoint(data.center) ? data.center : data.positions?.find(validPoint);
  if (map || !mapNode || !maplibregl || loadFailed) return;
  try {
    map = new maplibregl.Map({
      container: mapNode,
      style: STYLE_URL,
      center: initial ? [initial.lng, initial.lat] : [10.45, 51.16],
      zoom: initial ? 13 : 5,
      minZoom: 4,
      maxZoom: 19,
      attributionControl: true
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    setStatus('Straßenkarte wird geladen…');
    loadTimer = setTimeout(() => { if (!ready) setStatus('Kartendaten laden zu lange. Internetverbindung oder Netzwerkfilter prüfen und neu laden.'); }, 20000);
    map.on('load', () => {
      clearTimeout(loadTimer);
      ready = true;
      shell.classList.add('mapReady');
      setStatus('');
      map.addSource('game-radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'game-radius-fill', type: 'fill', source: 'game-radius', paint: { 'fill-color': '#ff762b', 'fill-opacity': 0.09 } });
      map.addLayer({ id: 'game-radius-outline', type: 'line', source: 'game-radius', paint: { 'line-color': '#ff762b', 'line-width': 3, 'line-dasharray': [2, 2] } });
      updateMap(latest);
      if (!latest?.map) setStatus('Karte bereit. Warte auf Standortdaten vom Spielserver…');
      map.resize();
    });
    map.on('error', event => {
      if (!ready) setStatus('Karte konnte nicht geladen werden. GPS und Spiel funktionieren weiterhin.');
      console.error('Kartendaten:', event.error);
    });
  } catch (error) {
    loadFailed = true;
    setStatus('Karte kann nicht starten. Bitte einen aktuellen Browser mit aktivierter Hardwarebeschleunigung verwenden.');
    console.error('Kartenstart:', error);
  }
}
function updateCircle(data) {
  if (!validPoint(data.center)) return;
  const radius = Math.max(100, Math.min(10000, Number(data.radius) || 3000));
  const key = `${data.center.lat},${data.center.lng},${radius}`;
  if (key !== lastCircleKey) {
    map.getSource('game-radius')?.setData(circleGeoJSON(data.center, radius));
    lastCircleKey = key;
  }
  if (!fitted) {
    const coordinates = circleGeoJSON(data.center, radius).geometry.coordinates[0];
    const lngs = coordinates.map(p => p[0]), lats = coordinates.map(p => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 30, duration: 0, maxZoom: 16 });
    fitted = true;
  }
  legend.textContent = `● Du    ● Mitspieler    ┄ Spielradius ${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}`;
}
function makeMarker(player, mine) {
  const element = document.createElement('div');
  element.className = `mapPlayer ${mine ? 'isMe' : 'isOther'}`;
  element.textContent = mine ? '▲' : (player.role === 'SEEKER' ? '⌕' : '🚘');
  element.setAttribute('aria-label', mine ? 'Mein Standort' : `Standort von ${player.name}`);
  const popupContent = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = mine ? 'Du' : player.name;
  const detail = document.createElement('div');
  detail.textContent = `${player.role === 'SEEKER' ? 'Sucher' : player.role === 'HIDER' ? 'Verstecker' : 'Spieler'} · GPS ±${Math.round(player.accuracy)} m`;
  popupContent.append(title, detail);
  const marker = new maplibregl.Marker({ element, anchor: 'center' })
    .setLngLat([player.lng, player.lat])
    .setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(popupContent))
    .addTo(map);
  markers.set(player.id, marker);
}
function updateMarkers(data, meId) {
  const current = new Set();
  for (const player of data.positions || []) {
    if (!validPoint(player)) continue;
    current.add(player.id);
    const mine = player.id === meId;
    const marker = markers.get(player.id);
    if (marker) marker.setLngLat([player.lng, player.lat]);
    else makeMarker(player, mine);
  }
  for (const [id, marker] of markers) {
    if (!current.has(id)) { marker.remove(); markers.delete(id); }
  }
}
function updateMap(gameState) {
  latest = gameState;
  if (!document.getElementById('game')?.classList.contains('active')) return;
  if (!maplibregl) { loadLibrary(); return; }
  const data = gameState?.map || {};
  if (!map) initialize(data);
  if (!ready) return;
  map.resize();
  updateCircle(data);
  updateMarkers(data, gameState?.lobby?.me?.id);
  if (!gameState?.map) setStatus('Keine Kartendaten vom Spielserver. Bitte die Serverversion des Karten-Updates bereitstellen.');
  else if (!data.positions?.length) setStatus('Straßenkarte bereit. Warte auf GPS – Standortzugriff erlauben.');
  else setStatus('');
}
document.getElementById('mapFollow')?.addEventListener('click', () => {
  if (!map || !latest?.map) return;
  const me = latest.map.positions?.find(p => p.id === latest.lobby.me.id);
  const point = me || latest.map.center;
  if (validPoint(point)) map.easeTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 15), duration: 450 });
});
window.chsMapUpdate = updateMap;
window.chsMapReset = () => {
  latest = null;
  for (const marker of markers.values()) marker.remove();
  markers.clear();
  fitted = false;
  lastCircleKey = '';
  map?.getSource('game-radius')?.setData({ type: 'FeatureCollection', features: [] });
};

// Start auch ohne GPS; bei Seitenwechsel die sichtbare Größe neu berechnen.
const gameNode = document.getElementById('game');
if (gameNode && mapNode) {
  const activate = () => { if (gameNode.classList.contains('active')) updateMap(latest); };
  new MutationObserver(activate).observe(gameNode, { attributes: true, attributeFilter: ['class'] });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => map?.resize()).observe(mapNode);
  activate();
}

