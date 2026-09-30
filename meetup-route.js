'use strict';
// Only server-supplied GPS points are accepted by the authenticated API.
async function roadRoute(from, to, fetcher = fetch) {
  const base = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  const url = new URL('/route/v1/driving/' + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat, base);
  url.search = 'overview=full&geometries=geojson&steps=false';
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Routendienst nicht erreichbar.');
  const data = await response.json();
  const route = data.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (data.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(coordinates)
      || coordinates.length < 2 || coordinates.length > 50000
      || coordinates.some(point => !Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)
      || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0) {
    throw new Error('Keine Straßenroute verfügbar.');
  }
  return { geometry: route.geometry, distance: Math.round(route.distance), duration: Math.round(route.duration) };
}
module.exports = { roadRoute };
