/* OSRM 自驾路径 */

import { OSRM_URL } from "../state.js";

export function fetchOSRMRoute(a, b) {
  const url = `${OSRM_URL}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  return fetch(url)
    .then((r) => r.json())
    .then((data) => {
      if (!data.routes || !data.routes.length) throw new Error("no routes");
      const r = data.routes[0];
      return {
        coords: r.geometry.coordinates.map((c) => [c[1], c[0]]), // lon,lat -> lat,lon
        distanceM: r.distance,    // 米
        durationS: r.duration,    // 秒
      };
    });
}
