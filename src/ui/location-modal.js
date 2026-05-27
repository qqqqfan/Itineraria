/* 地点搜索 + 地图浮窗
 *
 * UX 设计原则（v1.1 重构）：
 *   - 输入框 = 地点名称（同时也是 OSM 搜索 query）。打字只改 label，不改坐标。
 *   - 不自动搜索：用户回车 / 点🔍按钮才发请求 → 节省 OSM 公共服务、减少紧张感。
 *   - 手动打点优先级：用户能在地图上点击或拖针标点；name 永远以输入框为准。
 *   - OSM 候选点击：把候选名回填输入框，并把锚点设为 precise。用户可继续编辑名字。
 */

import { NOMINATIM_URL, NOMINATIM_EMAIL } from "../state.js";
import { emptyAnchor, cloneAnchor, sortedEvents, isAnchorSet } from "../events.js";
import { schedulePersist } from "../storage.js";
import { escapeHtml, makeColoredDivIcon } from "../utils/dom.js";
import { rankByCentroid, shortName } from "../geo/nominatim.js";
import { renderEventList } from "./event-list.js";
import { toast } from "./toast.js";

export function initLocationModal(state) {
  document
    .querySelectorAll("[data-action='close-location-modal']")
    .forEach((el) => el.addEventListener("click", () => closeLocationModal(state)));

  const confirmBtn = document.querySelector("[data-action='confirm-location']");
  if (confirmBtn) confirmBtn.addEventListener("click", () => confirmLocation(state));

  // Esc 关闭 + Tab 焦点环
  document.addEventListener("keydown", (e) => {
    if (!state.locationModal.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeLocationModal(state);
      return;
    }
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  const clearBtn = document.querySelector("[data-action='clear-location']");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      state.locationModal.pickedAnchor = emptyAnchor();
      updateModalCoord(state);
      if (state.locationModal.marker && state.locationModal.map) {
        state.locationModal.map.removeLayer(state.locationModal.marker);
        state.locationModal.marker = null;
      }
    });
  }

  const input = document.getElementById("location-search-input");
  if (input) {
    // 输入：实时把 label 同步进 pickedAnchor（不发任何请求）
    input.addEventListener("input", (e) => {
      const v = e.target.value;
      if (!state.locationModal.pickedAnchor) {
        state.locationModal.pickedAnchor = emptyAnchor();
      }
      state.locationModal.pickedAnchor.label = v;
      // 用户改了名 → 把"precise"降级为"manual"，防止显示和 OSM 出处不符
      if (state.locationModal.pickedAnchor.status === "precise") {
        state.locationModal.pickedAnchor.status = "manual";
      }
      updateModalCoord(state);
    });
    // 回车：触发搜索
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = input.value.trim();
        if (q) runSearch(state, q);
      }
    });
  }

  const searchBtn = document.querySelector("[data-action='run-location-search']");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const q = (document.getElementById("location-search-input").value || "").trim();
      if (q) runSearch(state, q);
    });
  }
}

export function openLocationModal(state, eventId, field, label) {
  const evt = state.events.find((e) => e.id === eventId);
  if (!evt) return;
  // P1 #8：切换目标时，丢弃前一次的搜索结果
  abortInFlightSearch(state);
  // 记下当前 focus，用于关闭时回弹
  state.locationModal.lastFocus = document.activeElement;
  state.locationModal.open = true;
  state.locationModal.target = { eventId, field };
  state.locationModal.candidates = [];
  state.locationModal.pickedAnchor = cloneAnchor(evt[field] || emptyAnchor());

  const modal = document.getElementById("location-modal");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("location-modal-title").textContent = `${label} — ${evt.name || evt.type}`;

  const input = document.getElementById("location-search-input");
  input.value = evt[field] && evt[field].label ? evt[field].label : "";
  input.placeholder = placeholderFor(evt, field);

  // 候选清空 + 协调显示
  renderCandidates(state, []);
  updateModalCoord(state);

  // 初始化地图
  window.setTimeout(() => initLocationMap(state), 50);

  // 不再自动搜索：用户主动回车/点按钮才发请求
  input.focus();
  input.select();
}

export function closeLocationModal(state) {
  state.locationModal.open = false;
  state.locationModal.target = null;
  state.locationModal.pickedAnchor = null;
  // P1 #8：关闭浮窗时取消正在飞的搜索请求
  abortInFlightSearch(state);
  const modal = document.getElementById("location-modal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  const confirmBtn = document.querySelector("[data-action='confirm-location']");
  if (confirmBtn) confirmBtn.classList.remove("is-armed");
  if (state.locationModal.marker) {
    if (state.locationModal.map) state.locationModal.map.removeLayer(state.locationModal.marker);
    state.locationModal.marker = null;
  }
  if (state.locationModal.map) {
    state.locationModal.map.remove();
    state.locationModal.map = null;
  }
  // 焦点回弹
  const last = state.locationModal.lastFocus;
  state.locationModal.lastFocus = null;
  if (last && typeof last.focus === "function") {
    try { last.focus({ preventScroll: true }); } catch (_) { last.focus(); }
  }
}

/**
 * Tab focus trap：让 Tab/Shift+Tab 在 panel 内循环。
 * 只看可见且未禁用的可聚焦元素。
 */
function trapFocus(e) {
  const panel = document.querySelector("#location-modal .location-modal__panel");
  if (!panel) return;
  const focusables = Array.from(
    panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || !panel.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

/**
 * 根据 type / field 给 placeholder 一个有代表性的样例。
 * 用过即丢的提示，不持久。
 */
function placeholderFor(evt, field) {
  if (evt.type === "交通") {
    if (field === "anchorFrom") return "出发地点，例如 浦东机场 T2、京都站";
    if (field === "anchorTo")   return "到达地点，例如 羽田机场、横滨港";
  }
  switch (evt.type) {
    case "酒店": return "酒店名字，例如 大阪心斋桥东急 REI";
    case "餐饮": return "店名，例如 一兰拉面 道顿堀店";
    case "活动": return "活动名/场地，例如 富士急乐园、武道馆";
    case "游览":
    default:    return "景点/地名，例如 清水寺、Hallstatt 老城";
  }
}

function armConfirmButton() {
  const btn = document.querySelector("[data-action='confirm-location']");
  if (!btn) return;
  btn.classList.add("is-armed");
  // requestAnimationFrame：等 leaflet 拖动事件冒泡完再 focus，避免被吞
  window.requestAnimationFrame(() => {
    try { btn.focus({ preventScroll: true }); } catch (_) { btn.focus(); }
  });
}

function abortInFlightSearch(state) {
  if (state.locationModal.searchAbort) {
    try { state.locationModal.searchAbort.abort(); } catch (_) { /* ignore */ }
    state.locationModal.searchAbort = null;
  }
  const spinner = document.getElementById("location-search-spinner");
  if (spinner) spinner.hidden = true;
}

function initLocationMap(state) {
  if (!window.L) return;
  const container = document.getElementById("location-map");
  if (!container) return;
  if (state.locationModal.map) {
    state.locationModal.map.remove();
    state.locationModal.map = null;
  }
  // 决定初始视图
  const center = decideInitialMapCenter(state);
  const map = window.L.map(container, { zoomControl: true }).setView(
    center.latlng,
    center.zoom
  );
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  state.locationModal.map = map;

  // 已有锚点：放置可拖动 marker
  const picked = state.locationModal.pickedAnchor;
  if (picked && picked.lat != null) {
    placePickedMarker(state, picked.lat, picked.lon, picked.label, picked.status === "precise" ? "precise" : "manual");
    map.setView([picked.lat, picked.lon], 12);
  }

  // 点击地图任意位置 = 手动打点
  // label 完全交给输入框；用户没起名就先空着，confirmLocation 不会强行造一个"手动标记"
  map.on("click", (e) => {
    const input = document.getElementById("location-search-input");
    const labelFromInput = input ? input.value.trim() : "";
    placePickedMarker(state, e.latlng.lat, e.latlng.lng, labelFromInput, "manual");
    armConfirmButton();
  });

  // 修复初始尺寸：grid 布局可能在多帧里才稳定，分两次刷新
  window.requestAnimationFrame(() => map.invalidateSize());
  window.setTimeout(() => map.invalidateSize(), 200);
}

function decideInitialMapCenter(state) {
  // 1) 已有 picked anchor
  const picked = state.locationModal.pickedAnchor;
  if (picked && picked.lat != null) {
    return { latlng: [picked.lat, picked.lon], zoom: 12 };
  }
  // 2) P1 #5：交通卡的智能默认中心
  //    anchorFrom：找时间上"最邻近"的已锚定点
  //    anchorTo  ：直接用本卡 anchorFrom
  const transportCenter = decideTransportFallbackCenter(state);
  if (transportCenter) return { latlng: [transportCenter.lat, transportCenter.lon], zoom: 11 };
  // 3) 行程内已有锚点的地理重心
  const center = computeTripCentroid(state);
  if (center) return { latlng: [center.lat, center.lon], zoom: 5 };
  // 4) 默认世界视图
  return { latlng: [20, 10], zoom: 2 };
}

function decideTransportFallbackCenter(state) {
  const target = state.locationModal.target;
  if (!target) return null;
  const evt = state.events.find((e) => e.id === target.eventId);
  if (!evt || evt.type !== "交通") return null;

  // anchorTo：用本卡 anchorFrom（如果已锚定）
  if (target.field === "anchorTo") {
    if (isAnchorSet(evt.anchorFrom)) {
      return { lat: evt.anchorFrom.lat, lon: evt.anchorFrom.lon };
    }
    return null;
  }

  // anchorFrom：找时间上最邻近的已锚定点（前向优先：上一段交通的 anchorTo / 上一个游览的 anchor）
  if (target.field === "anchorFrom") {
    return findNearestAnchoredInTime(state, evt) || null;
  }
  return null;
}

function findNearestAnchoredInTime(state, currentEvt) {
  const ordered = sortedEvents(state);
  const idx = ordered.findIndex((e) => e.id === currentEvt.id);
  if (idx < 0) return null;
  // 优先往前找：行程上一站的"目的地"语义
  for (let i = idx - 1; i >= 0; i--) {
    const a = pickEndAnchor(ordered[i]);
    if (a) return { lat: a.lat, lon: a.lon };
  }
  // 再往后找：万一当前是第一段
  for (let i = idx + 1; i < ordered.length; i++) {
    const a = pickStartAnchor(ordered[i]);
    if (a) return { lat: a.lat, lon: a.lon };
  }
  return null;
}

function pickEndAnchor(evt) {
  if (evt.type === "交通") {
    if (isAnchorSet(evt.anchorTo)) return evt.anchorTo;
    if (isAnchorSet(evt.anchorFrom)) return evt.anchorFrom;
    return null;
  }
  return isAnchorSet(evt.anchor) ? evt.anchor : null;
}

function pickStartAnchor(evt) {
  if (evt.type === "交通") {
    if (isAnchorSet(evt.anchorFrom)) return evt.anchorFrom;
    if (isAnchorSet(evt.anchorTo)) return evt.anchorTo;
    return null;
  }
  return isAnchorSet(evt.anchor) ? evt.anchor : null;
}

export function computeTripCentroid(state) {
  const anchors = collectAllAnchors(state).filter((a) => a.lat != null);
  if (!anchors.length) return null;
  const lat = anchors.reduce((s, a) => s + a.lat, 0) / anchors.length;
  const lon = anchors.reduce((s, a) => s + a.lon, 0) / anchors.length;
  return { lat, lon };
}

function collectAllAnchors(state) {
  const list = [];
  state.events.forEach((e) => {
    if (e.type === "交通") {
      if (e.anchorFrom) list.push(e.anchorFrom);
      if (e.anchorTo) list.push(e.anchorTo);
    } else if (e.anchor) {
      list.push(e.anchor);
    }
  });
  return list;
}

function placePickedMarker(state, lat, lon, label, status) {
  const map = state.locationModal.map;
  if (!map) return;
  if (state.locationModal.marker) {
    map.removeLayer(state.locationModal.marker);
  }
  const color = status === "precise" ? "#3f6b45" : "#8f6c30";
  const marker = window.L.marker([lat, lon], {
    draggable: true,
    icon: makeColoredDivIcon(color, "📍"),
  }).addTo(map);
  marker.on("dragend", (e) => {
    const ll = e.target.getLatLng();
    // 拖针只动坐标，不替用户起名（之前会兜底成 "手动标记" 是个 bug）
    const keepLabel = (state.locationModal.pickedAnchor && state.locationModal.pickedAnchor.label) || "";
    state.locationModal.pickedAnchor = {
      status: "manual",
      lat: ll.lat,
      lon: ll.lng,
      label: keepLabel,
    };
    updateModalCoord(state);
    // 拖动后视觉变黄
    if (state.locationModal.marker) {
      map.removeLayer(state.locationModal.marker);
    }
    placePickedMarker(state, ll.lat, ll.lng, keepLabel, "manual");
    // P1 #4：拖针后高亮 + 聚焦确认按钮，引导用户回收眼睛
    armConfirmButton();
  });
  state.locationModal.marker = marker;
  state.locationModal.pickedAnchor = { status, lat, lon, label };
  updateModalCoord(state);
}

function updateModalCoord(state) {
  const node = document.getElementById("location-coord");
  const a = state.locationModal.pickedAnchor;
  if (!a || a.lat == null) {
    node.textContent = "未锚定";
  } else {
    node.textContent = `📍 ${a.lat.toFixed(4)}, ${a.lon.toFixed(4)} · ${a.label || ""}`;
  }
}

function runSearch(state, query) {
  if (!query) return;
  // P1 #8：发新请求前先取消旧的
  abortInFlightSearch(state);
  state.locationModal.lastQuery = query;
  const spinner = document.getElementById("location-search-spinner");
  if (spinner) spinner.hidden = false;

  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "8",
    "accept-language": "zh,en",
  });
  // P1 #9：Nominatim 公共服务要求 identifying yourself
  if (NOMINATIM_EMAIL) params.set("email", NOMINATIM_EMAIL);

  const ctrl = new AbortController();
  state.locationModal.searchAbort = ctrl;

  fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal: ctrl.signal,
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((results) => {
      if (state.locationModal.lastQuery !== query) return; // 过期请求
      const centroid = computeTripCentroid(state);
      const ranked = rankByCentroid(state, results || [], centroid);
      state.locationModal.candidates = ranked;
      renderCandidates(state, ranked);
      // 只把地图视野挪到第一个候选附近,不替用户落点 —— 由用户点候选或地图打点
      if (ranked.length && state.locationModal.map) {
        const top = ranked[0];
        state.locationModal.map.setView([parseFloat(top.lat), parseFloat(top.lon)], 11);
      }
    })
    .catch((err) => {
      if (err && err.name === "AbortError") return; // 主动取消，不打日志
      console.warn("OSM 搜索失败", err);
      toast.error(`OSM 搜索失败：${err && err.message ? err.message : "网络异常"}。可在地图上手动打点。`);
      // 失败时也把候选区切到"空态"提示，引导手动打点
      renderCandidates(state, []);
    })
    .finally(() => {
      // 仅当本次请求仍是当前 in-flight 时才清 spinner
      if (state.locationModal.searchAbort === ctrl) {
        state.locationModal.searchAbort = null;
        if (spinner) spinner.hidden = true;
      }
    });
}

function renderCandidates(state, list) {
  const container = document.getElementById("location-candidates");
  if (!container) return;
  container.innerHTML = "";
  // 没搜过 → 直接折叠候选栏，把空间还给地图
  const body = document.querySelector(".location-modal__body");
  if (!state.locationModal.lastQuery && !list.length) {
    if (body) body.classList.add("is-no-candidates");
    return;
  }
  if (body) body.classList.remove("is-no-candidates");
  if (!list.length) {
    container.innerHTML = `<p class="location-candidates__empty">OSM 没找到这个地名 —— 在地图上点击或拖针手动打点即可</p>`;
    return;
  }
  list.forEach((r, i) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "location-candidate";
    item.innerHTML = `
      <span class="location-candidate__name">${escapeHtml(shortName(r))}</span>
      <span class="location-candidate__addr">${escapeHtml(r.display_name)}</span>
    `;
    item.addEventListener("click", () => {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      const name = shortName(r);
      placePickedMarker(state, lat, lon, name, "precise");
      if (state.locationModal.map) {
        state.locationModal.map.setView([lat, lon], 13);
      }
      // 把候选名回填到输入框（同时也是 anchor.label 来源）
      const input = document.getElementById("location-search-input");
      if (input) input.value = name;
      // 选中样式
      container.querySelectorAll(".location-candidate").forEach((el) => el.classList.remove("is-active"));
      item.classList.add("is-active");
      armConfirmButton();
    });
    container.appendChild(item);
  });
}

function confirmLocation(state) {
  const target = state.locationModal.target;
  if (!target) return closeLocationModal(state);
  const evt = state.events.find((e) => e.id === target.eventId);
  if (!evt) return closeLocationModal(state);
  const picked = state.locationModal.pickedAnchor;
  // 输入框是 label 真相 —— 用户可能改了名后没再点候选
  const inputEl = document.getElementById("location-search-input");
  const inputLabel = inputEl ? inputEl.value.trim() : "";
  if (picked && picked.lat != null) {
    // label 优先级：输入框 > picked.label > 空串（让展示层 fallback "未命名地点"）
    const finalLabel = inputLabel || picked.label || "";
    // 用户改过名 → 不再算"OSM 精确" → 降级 manual
    const sameAsOsm = picked.status === "precise" && inputLabel === picked.label;
    evt[target.field] = {
      status: sameAsOsm ? "precise" : "manual",
      lat: picked.lat,
      lon: picked.lon,
      label: finalLabel,
    };
  } else if (inputLabel) {
    // 有名字但用户没打点 → 留下 label，status=none，将来 startAutoAnchor 可以补
    evt[target.field] = { status: "none", lat: null, lon: null, label: inputLabel };
  } else {
    evt[target.field] = emptyAnchor();
  }
  // 注意：不再把 anchor.label 镜像到 evt.name —— evt.name 只存"用户手填"的值。
  // 展示用 displayDefaultName(evt) 做兜底；name 输入框用 placeholder 灰显派生值。
  // 交通：清缓存
  if (evt.type === "交通") state.preview.transportCache.delete(evt.id);
  schedulePersist(state);
  closeLocationModal(state);
  renderEventList(state);
}
