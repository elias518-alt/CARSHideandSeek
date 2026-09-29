import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

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
  statusNode.textContent = message;
  statusNode.hidden = !message;
}
function initialize(data) {
  const initial = data.center || data.positions?.find(validPoint);
  if (!validPoint(initial) || map || !mapNode) return;
  try {
    map = new maplibregl.Map({
      container: mapNode,
      style: STYLE_URL,
      center: [initial.lng, initial.lat],
      zoom: 13,
      minZoom: 4,
      maxZoom: 19,
      attributionControl: true
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.on('load', () => {
      ready = true;
      shell.classList.add('mapReady');
      setStatus('');
      map.addSource('game-radius', { type: 'geojson', data: circleGeoJSON(initial, data.radius || 3000) });
      map.addLayer({ id: 'game-radius-fill', type: 'fill', source: 'game-radius', paint: { 'fill-color': '#ff762b', 'fill-opacity': 0.09 } });
      map.addLayer({ id: 'game-radius-outline', type: 'line', source: 'game-radius', paint: { 'line-color': '#ff762b', 'line-width': 3, 'line-dasharray': [2, 2] } });
      updateMap(latest);
      map.resize();
    });
    map.on('error', event => {
      if (!ready) setStatus('Karte konnte nicht geladen werden. GPS und Spiel funktionieren weiterhin.');
      console.error('Kartendaten:', event.error);
    });
  } catch (error) {
    setStatus('Karte nicht verfügbar. GPS und Spiel funktionieren weiterhin.');
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
  if (!gameState?.map || !document.getElementById('game')?.classList.contains('active')) return;
  const data = gameState.map;
  if (!map) initialize(data);
  if (!ready) return;
  map.resize();
  updateCircle(data);
  updateMarkers(data, gameState.lobby.me.id);
  if (!data.positions?.length) setStatus('Warte auf aktuelle GPS-Positionen der Spieler…');
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
};
