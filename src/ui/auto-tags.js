/* 自动 Tag（派生数据，不持久化） */

import { haversine } from "../geo/geo-utils.js";
import { nightsBetween } from "../utils/date.js";

/**
 * 根据 event 当前数据派生自动 tag。
 * 规则：
 *   - 自驾：优先用 OSRM 路径距离 + 时长（点击轴加载）；未加载时只显直线距离
 *   - 飞机/高铁/轮船/大巴：仅显示直线距离，不带时长
 *   - 酒店：startDate + endDate → "X 晚"
 */
export function computeAutoTags(evt, state) {
  const out = [];
  if (evt.type === "交通") {
    const a = evt.anchorFrom, b = evt.anchorTo;
    if (!a || !b || a.lat == null || b.lat == null) return out;

    if (evt.transportMode === "drive") {
      const cached = state && state.preview && state.preview.transportCache.get(evt.id);
      if (cached && cached.distanceM != null) {
        out.push({ label: `约 ${formatKm(cached.distanceM / 1000)} km`, title: "OSRM 实际路径距离" });
        if (cached.durationS) {
          out.push({ label: `约 ${formatHm(cached.durationS / 3600)}`, title: "OSRM 预计驾驶时长" });
        }
      } else {
        // 未加载 OSRM：直线距离 + 提示
        const km = haversine(a.lat, a.lon, b.lat, b.lon);
        out.push({ label: `约 ${formatKm(km)} km`, title: "直线距离·点击轴查看真实路径" });
      }
    } else {
      // 飞机/高铁/轮船/大巴：直线距离，不带时长
      const km = haversine(a.lat, a.lon, b.lat, b.lon);
      out.push({ label: `约 ${formatKm(km)} km`, title: "起终点直线距离" });
    }
  } else if (evt.type === "酒店") {
    if (evt.date && evt.date.from && evt.date.to) {
      const nights = nightsBetween(evt.date.from, evt.date.to);
      if (nights > 0) out.push({ label: `${nights} 晚`, title: "入住夜数" });
    }
  }
  return out;
}

export function formatKm(km) {
  if (km < 10) return km.toFixed(1);
  return Math.round(km).toLocaleString();
}

export function formatHm(hours) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}
