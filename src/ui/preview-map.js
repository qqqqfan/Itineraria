/* 预览：地图 Tab + 交通路径懒加载 */

import {
  TYPE_COLOR,
  sortedEvents,
  allHaveDate,
  emojiOf,
  transportEmojiOf,
} from "../events.js";
import { schedulePersist } from "../storage.js";
import { escapeHtml, makeColoredDivIcon } from "../utils/dom.js";
import { formatDateRange } from "../utils/date.js";
import { greatCircleArc } from "../geo/geo-utils.js";
import { fetchOSRMRoute } from "../geo/osrm.js";
import { renderAxis } from "./preview-axis.js";
import { renderPreviewList } from "./preview-list.js";
import { toast } from "./toast.js";

export function initPreviewBindings(state) {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.previewView.tab = btn.dataset.tab;
      schedulePersist(state);
      renderPreview(state);
    });
  });
  document.querySelectorAll("[data-sub-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.previewView.sub = btn.dataset.subTab;
      schedulePersist(state);
      renderPreview(state);
    });
  });
  document.querySelectorAll("[data-action='reset-zoom']").forEach((btn) => {
    btn.addEventListener("click", () => resetMapView(state));
  });
  document.querySelectorAll("[data-map-setting='hideEdgeTransport']").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      state.previewView.hideEdgeTransport = !!e.target.checked;
      schedulePersist(state);
      refreshPreviewPoints(state, { fitView: true });
      renderAxis(state, sortedEvents(state), state.previewView.sub);
    });
  });
}

export function renderPreviewHeader(state) {
  const t = document.getElementById("preview-trip-title");
  if (t) t.textContent = state.trip.title || "未命名 Trip";
}

export function renderPreview(state) {
  // 子 tab 激活规则
  const allDated = allHaveDate(state);
  const subBtns = document.querySelectorAll("[data-sub-tab]");
  subBtns.forEach((btn) => {
    if (btn.dataset.subTab === "day") {
      btn.disabled = !allDated;
      btn.classList.toggle("is-disabled", !allDated);
    }
  });
  if (!allDated && state.previewView.sub === "day") {
    state.previewView.sub = "event";
  }

  document.querySelectorAll(".preview-tab[data-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === state.previewView.tab);
  });
  document.querySelectorAll(".preview-tab[data-sub-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.subTab === state.previewView.sub);
  });
  document.querySelectorAll(".preview-pane").forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.pane === state.previewView.tab);
  });

  // shared 模式复用同一渲染引擎，所以也放行
  if (state.activeMode !== "preview" && state.activeMode !== "shared") return;

  if (state.previewView.tab === "map") {
    renderPreviewMap(state);
  } else {
    renderPreviewList(state);
  }
}

function renderPreviewMap(state) {
  if (!window.L) return;
  const container = document.getElementById("preview-map");
  if (!container) return;
  if (!state.preview.map) {
    state.preview.map = window.L.map(container, { zoomControl: true, scrollWheelZoom: false }).setView([20, 10], 2);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(state.preview.map);
    state.preview.pointLayer = window.L.layerGroup().addTo(state.preview.map);
    state.preview.lineLayer = window.L.layerGroup().addTo(state.preview.map);
    state.preview.transportLayer = window.L.layerGroup().addTo(state.preview.map);
    installPinchAndCtrlWheelZoom(state.preview.map);
  }
  state.preview.transportLayer.clearLayers();
  state.preview.activeTransportId = null;

  document.querySelectorAll("[data-map-setting='hideEdgeTransport']").forEach((cb) => {
    cb.checked = !!state.previewView.hideEdgeTransport;
  });

  refreshPreviewPoints(state, { fitView: true });
  renderAxis(state, sortedEvents(state), state.previewView.sub);

  window.setTimeout(() => state.preview.map && state.preview.map.invalidateSize(), 60);
}

function installPinchAndCtrlWheelZoom(map) {
  const container = map.getContainer();
  container.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const stepRaw = Math.min(Math.abs(e.deltaY) / 80, 1.2);
      const step = Math.max(stepRaw, 0.25);
      const targetZoom = map.getZoom() + direction * step;
      const point = map.mouseEventToContainerPoint(e);
      map.setZoomAround(point, targetZoom, { animate: false });
    },
    { passive: false }
  );
}

function resetMapView(state) {
  if (!state.preview.map) return;
  refreshPreviewPoints(state, { fitView: true });
}

function getEdgeTransportIds(sorted) {
  const ids = new Set();
  const transports = sorted.filter((e) => e.type === "交通");
  if (!transports.length) return ids;
  ids.add(transports[0].id);
  ids.add(transports[transports.length - 1].id);
  return ids;
}

export function refreshPreviewPoints(state, opts = {}) {
  if (!state.preview.map) return;
  state.preview.pointLayer.clearLayers();
  state.preview.lineLayer.clearLayers();

  const sorted = sortedEvents(state);
  const hideEdge = !!state.previewView.hideEdgeTransport;
  const edgeIds = hideEdge ? getEdgeTransportIds(sorted) : new Set();
  const isHidden = (evt) => edgeIds.has(evt.id);

  const mapPoints = [];
  sorted.forEach((evt) => {
    if (isHidden(evt)) return;
    if (evt.type === "交通") {
      const a = evt.anchorFrom, b = evt.anchorTo;
      if (a && a.lat != null) mapPoints.push({ evt, anchor: a, role: "from" });
      if (b && b.lat != null) mapPoints.push({ evt, anchor: b, role: "to" });
    } else if (evt.anchor && evt.anchor.lat != null) {
      mapPoints.push({ evt, anchor: evt.anchor, role: "main" });
    }
  });

  const jittered = jitterOverlaps(mapPoints);

  jittered.forEach((p) => {
    const color = TYPE_COLOR[p.evt.type] || "#2a221c";
    const glyph = p.evt.type === "交通" ? transportEmojiOf(p.evt) : emojiOf(p.evt.type);
    const marker = window.L.marker([p.lat, p.lon], {
      icon: makeColoredDivIcon(color, glyph),
    });
    marker.bindPopup(buildMarkerPopup(p.evt, p.anchor, p.role));
    marker.addTo(state.preview.pointLayer);
  });

  // 顺序连线（仅可见、非交通锚点）
  const lineCoords = [];
  sorted.forEach((evt) => {
    if (isHidden(evt)) return;
    if (evt.type === "交通") return;
    const a = evt.anchor;
    if (a && a.lat != null) lineCoords.push([a.lat, a.lon]);
  });
  if (lineCoords.length >= 2) {
    window.L.polyline(lineCoords, {
      color: "#2a221c",
      weight: 2,
      opacity: 0.55,
      dashArray: "4,5",
    }).addTo(state.preview.lineLayer);
  }

  if (opts.fitView) {
    if (jittered.length) {
      const bounds = window.L.latLngBounds(jittered.map((p) => [p.lat, p.lon]));
      state.preview.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    } else {
      state.preview.map.setView([20, 10], 2);
    }
  }
}

function jitterOverlaps(points) {
  const groups = new Map();
  points.forEach((p) => {
    const key = `${p.anchor.lat.toFixed(4)},${p.anchor.lon.toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  const out = [];
  const RADIUS_DEG = 0.0003; // 约 30m
  groups.forEach((arr) => {
    if (arr.length === 1) {
      out.push({ ...arr[0], lat: arr[0].anchor.lat, lon: arr[0].anchor.lon });
    } else {
      arr.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / arr.length;
        out.push({
          ...p,
          lat: p.anchor.lat + Math.sin(angle) * RADIUS_DEG,
          lon: p.anchor.lon + Math.cos(angle) * RADIUS_DEG,
        });
      });
    }
  });
  return out;
}

function buildMarkerPopup(evt, anchor, role) {
  const titleParts = [];
  titleParts.push(`${emojiOf(evt.type)} ${escapeHtml(evt.name || evt.type)}`);
  if (evt.type === "交通") titleParts.push(role === "from" ? "(出发)" : "(到达)");
  return `
    <div class="marker-popup">
      <strong>${titleParts.join(" ")}</strong>
      ${anchor.label ? `<div class="marker-popup__label">${escapeHtml(anchor.label)}</div>` : ""}
      ${evt.date ? `<div class="marker-popup__date">${escapeHtml(formatDateRange(evt.date))}</div>` : ""}
    </div>
  `;
}

export function focusOnAnchor(state, anchor) {
  if (!state.preview.map) return;
  state.preview.map.setView([anchor.lat, anchor.lon], 13);
}

/* ---------- 交通路径懒加载 ---------- */
export function toggleTransportRoute(state, evt) {
  if (state.preview.activeTransportId === evt.id) {
    state.preview.transportLayer.clearLayers();
    state.preview.activeTransportId = null;
    return;
  }
  state.preview.transportLayer.clearLayers();
  state.preview.activeTransportId = evt.id;
  const a = evt.anchorFrom;
  const b = evt.anchorTo;
  if (!a || !b || a.lat == null || b.lat == null) return;

  const mode = evt.transportMode;
  if (mode === "drive") {
    const cached = state.preview.transportCache.get(evt.id);
    if (cached) {
      drawDrivingRoute(state, cached.coords);
    } else {
      // 跨 trip 守卫：fetch 期间若切了 trip，generation 会变；resolve 时丢弃
      const myGen = state.autoAnchor.generation;
      fetchOSRMRoute(a, b)
        .then((result) => {
          if (state.autoAnchor.generation !== myGen) return;
          state.preview.transportCache.set(evt.id, result);
          if (state.preview.activeTransportId === evt.id) drawDrivingRoute(state, result.coords);
          renderAxis(state, sortedEvents(state), state.previewView.sub);
        })
        .catch((err) => {
          if (state.autoAnchor.generation !== myGen) return;
          console.warn("OSRM 失败，回退直线", err);
          toast.warn("自驾路线服务暂不可用，已用直线距离代替");
          drawStraightLine(state, a, b);
        });
    }
  } else if (mode === "flight") {
    const arc = greatCircleArc(a.lat, a.lon, b.lat, b.lon, 64);
    drawFlightArc(state, arc, a, b);
  } else {
    drawStraightLine(state, a, b);
  }
}

function drawDrivingRoute(state, coords) {
  window.L.polyline(coords, {
    color: "#2a5fa6",
    weight: 4,
    opacity: 0.9,
  }).addTo(state.preview.transportLayer);
  fitTransportBounds(state, coords);
}

function drawFlightArc(state, coords, a, b) {
  window.L.polyline(coords, {
    color: "#7f4b26",
    weight: 3,
    opacity: 0.85,
    dashArray: "6,8",
  }).addTo(state.preview.transportLayer);
  fitTransportBounds(state, [[a.lat, a.lon], [b.lat, b.lon]]);
}

function drawStraightLine(state, a, b) {
  window.L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
    color: "#70665b",
    weight: 2,
    opacity: 0.7,
    dashArray: "3,6",
  }).addTo(state.preview.transportLayer);
  fitTransportBounds(state, [[a.lat, a.lon], [b.lat, b.lon]]);
}

function fitTransportBounds(state, coords) {
  if (!state.preview.map) return;
  const bounds = window.L.latLngBounds(coords);
  state.preview.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
}
