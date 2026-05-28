/* OSM Nominatim 搜索 + 后台自动锚定 */

import { NOMINATIM_URL, NOMINATIM_EMAIL } from "../state.js";
import { sleep } from "./geo-utils.js";
import { toast } from "../ui/toast.js";

export function rankByCentroid(state, results, centroid) {
  if (!centroid) return results;
  return results
    .map((r) => ({
      ...r,
      _dist: haversineDist(parseFloat(r.lat), parseFloat(r.lon), centroid.lat, centroid.lon),
    }))
    .sort((a, b) => a._dist - b._dist);
}

function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* OSM 搜索结果短名称提取 */
export function shortName(r) {
  const a = r.address || {};
  return (
    a.attraction ||
    a.tourism ||
    a.hotel ||
    a.building ||
    a.road ||
    a.suburb ||
    a.village ||
    a.town ||
    a.city ||
    a.county ||
    a.state ||
    r.name ||
    r.display_name.split(",")[0]
  );
}

/* 单次反查 */
export function geocodeOne(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    "accept-language": "zh,en",
  });
  // P1 #9：Nominatim 要求 identifying yourself
  if (NOMINATIM_EMAIL) params.set("email", NOMINATIM_EMAIL);
  return fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  })
    .then((r) => r.json())
    .then((arr) => {
      if (!arr || !arr.length) return null;
      const r = arr[0];
      return {
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        display: r.display_name,
      };
    });
}

/* ---------- 自动锚定（后台批量地理编码） ----------
 * 触发时机：用户点"示例" / 任何带 label 但 status==="none" 的 anchor
 * 节流：1.1s/req（Nominatim 公共服务策略：不超过 1 req/sec）
 * 缓存：相同 label 只查一次，命中后直接复用
 */
export async function startAutoAnchor(state, hooks) {
  if (state.autoAnchor.running) return;
  const tasks = collectUnanchoredTasks(state);
  if (!tasks.length) return;
  // 跨 trip 取消令牌：切 trip 时 generation++，此处快照后每步对照
  const myGen = state.autoAnchor.generation;
  state.autoAnchor.running = true;
  showAutoAnchorStatus(`🌍 自动锚定中 0 / ${tasks.length}…`);

  const cache = new Map(); // label -> {lat, lon, display}
  let done = 0, ok = 0, failed = 0;

  for (const t of tasks) {
    // 切 trip 检查（进入循环前）
    if (state.autoAnchor.generation !== myGen) return;
    // 任务期间用户可能已手动锚定/删除该 event，先校验目标仍存在且仍是 none
    const evt = state.events.find((e) => e.id === t.eventId);
    if (!evt || !evt[t.field] || evt[t.field].status !== "none" || !evt[t.field].label) {
      done++;
      showAutoAnchorStatus(`🌍 自动锚定中 ${done} / ${tasks.length}…`);
      continue;
    }

    try {
      let result = cache.get(t.label);
      if (result === undefined) {
        result = await geocodeOne(t.label);
        if (state.autoAnchor.generation !== myGen) return; // fetch 后切 trip
        cache.set(t.label, result);
        // 仅在真正发了请求时节流
        await sleep(1100);
        if (state.autoAnchor.generation !== myGen) return; // sleep 后切 trip
      }
      if (result) {
        evt[t.field] = {
          status: "precise",
          lat: result.lat,
          lon: result.lon,
          label: result.display || t.label,
        };
        ok++;
        // 表单/预览实时反馈
        if (hooks && hooks.onAnchored) hooks.onAnchored();
      }
    } catch (err) {
      console.warn("[auto-anchor] failed:", t.label, err);
      failed++;
    }
    done++;
    showAutoAnchorStatus(`🌍 自动锚定中 ${done} / ${tasks.length}…`);
  }

  if (state.autoAnchor.generation !== myGen) return;
  state.autoAnchor.running = false;
  showAutoAnchorStatus(`✅ 自动锚定完成 ${ok} / ${tasks.length}`, true);
  if (failed > 0) {
    toast.warn(`自动锚定 ${failed} 项失败，可在卡片中手动打点`);
  } else if (ok < tasks.length) {
    // 没失败但也没全锚上 → 多半是 OSM 没找着
    toast.info(`自动锚定完成 · ${ok} / ${tasks.length}，其余 OSM 没找到`);
  }
}

function collectUnanchoredTasks(state) {
  const tasks = [];
  state.events.forEach((evt) => {
    if (evt.type === "交通") {
      if (evt.anchorFrom && evt.anchorFrom.status === "none" && evt.anchorFrom.label) {
        tasks.push({ eventId: evt.id, field: "anchorFrom", label: evt.anchorFrom.label });
      }
      if (evt.anchorTo && evt.anchorTo.status === "none" && evt.anchorTo.label) {
        tasks.push({ eventId: evt.id, field: "anchorTo", label: evt.anchorTo.label });
      }
    } else if (evt.anchor && evt.anchor.status === "none" && evt.anchor.label) {
      tasks.push({ eventId: evt.id, field: "anchor", label: evt.anchor.label });
    }
  });
  return tasks;
}

function showAutoAnchorStatus(text, finished) {
  let el = document.getElementById("auto-anchor-status");
  if (!el) {
    el = document.createElement("span");
    el.id = "auto-anchor-status";
    el.className = "auto-anchor-status";
    const actions = document.querySelector(".topbar__actions");
    if (actions) actions.insertBefore(el, actions.firstChild);
    else document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.toggle("is-finished", !!finished);
  if (finished) {
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 5000);
  }
}
