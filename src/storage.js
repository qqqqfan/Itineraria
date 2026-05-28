/* 持久化（v1.0：多 trip + 索引）
 *
 * localStorage 布局：
 *   {PREFIX}:index            -> { version, activeTripId, trips: IndexEntry[] }
 *   {PREFIX}:trip:<id>        -> TripRecord
 *   {PREFIX}                  -> v0.1 旧键（迁移后保留作首发版本备份）
 *
 * 写入顺序：先实体后索引，保证"索引指向不存在的实体"不会出现。
 * schedulePersist 永远操作活跃 trip；切 trip 走 setActiveTrip 唯一入口。
 */

import { STORAGE_KEY, STORAGE_PREFIX, INDEX_KEY, tripKey } from "./state.js";
import { emptyEvent, emptyAnchor } from "./events.js";

const SCHEMA_VERSION = 2;

/* ---------- helpers ---------- */

function nowISO() { return new Date().toISOString(); }

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "tr-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function safeReadJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("读取存储失败", key, err);
    return null;
  }
}

function safeWriteJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn("写入存储失败", key, err);
    return false;
  }
}

/* ---------- normalizeLoadedEvent (legacy + multi-trip 共用) ---------- */

export function normalizeLoadedEvent(e) {
  const base = emptyEvent(e.type || "游览");
  const tags = Array.isArray(e.tags) ? e.tags.slice() : [];
  return {
    ...base,
    ...e,
    tags,
    anchor: e.anchor || (e.type !== "交通" ? emptyAnchor() : undefined),
    anchorFrom: e.anchorFrom || (e.type === "交通" ? emptyAnchor() : undefined),
    anchorTo: e.anchorTo || (e.type === "交通" ? emptyAnchor() : undefined),
  };
}

/* ---------- index ---------- */

export function loadIndex() {
  const idx = safeReadJson(INDEX_KEY);
  if (idx && Array.isArray(idx.trips)) return idx;
  return null;
}

export function saveIndex(idx) {
  return safeWriteJson(INDEX_KEY, idx);
}

export function ensureIndex() {
  let idx = loadIndex();
  if (!idx) {
    idx = { version: SCHEMA_VERSION, activeTripId: null, trips: [] };
    saveIndex(idx);
  }
  return idx;
}

/* ---------- trip records ---------- */

export function loadTrip(id) {
  if (!id) return null;
  const rec = safeReadJson(tripKey(id));
  if (!rec || !Array.isArray(rec.events)) return null;
  return rec;
}

export function saveTripRecord(record) {
  if (!record || !record.id) return false;
  return safeWriteJson(tripKey(record.id), record);
}

function buildIndexEntry(record) {
  return {
    id: record.id,
    title: record.title || "",
    eventCount: Array.isArray(record.events) ? record.events.length : 0,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

/* ---------- v0.1 → v1.0 迁移 ---------- */

export function migrateV01IfNeeded() {
  if (loadIndex()) {
    selfHealIndex();
    return;
  }
  // 无索引 → 看旧键
  const legacy = safeReadJson(STORAGE_KEY);
  if (legacy && Array.isArray(legacy.events)) {
    const id = newId();
    const now = nowISO();
    const record = {
      id,
      title: (legacy.trip && legacy.trip.title) || "",
      events: legacy.events,
      previewView: legacy.previewView || { tab: "map", sub: "day", hideEdgeTransport: false },
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
    saveTripRecord(record);
    saveIndex({
      version: SCHEMA_VERSION,
      activeTripId: id,
      trips: [buildIndexEntry(record)],
    });
    // 旧键保留作首发备份；下个版本再清理
    console.info("[tripstudio] migrated v0.1 single-trip → trip", id);
  } else {
    saveIndex({ version: SCHEMA_VERSION, activeTripId: null, trips: [] });
  }
}

/**
 * Self-heal：索引和实体不一致时双向修补
 *   - 实体存在但索引缺 → 补回索引
 *   - 索引指向不存在的实体 → 从索引剔除
 *   - activeTripId 指向不存在的 trip → 重置为 null
 */
function selfHealIndex() {
  const idx = loadIndex();
  if (!idx) return;
  let changed = false;
  // 索引指向不存在的实体？
  const seen = new Set();
  const filtered = idx.trips.filter((entry) => {
    if (!entry || !entry.id) return false;
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    if (!loadTrip(entry.id)) {
      changed = true;
      return false;
    }
    return true;
  });
  if (filtered.length !== idx.trips.length) idx.trips = filtered;
  if (idx.activeTripId && !loadTrip(idx.activeTripId)) {
    idx.activeTripId = idx.trips[0] ? idx.trips[0].id : null;
    changed = true;
  }
  if (changed) saveIndex(idx);
}

/* ---------- 高阶操作（库层） ---------- */

/**
 * 创建一个新 trip 并切到它。
 * 返回新 trip id。
 */
export function createTrip(state, opts = {}) {
  const id = newId();
  const now = nowISO();
  const record = {
    id,
    title: opts.title || "",
    events: [],
    previewView: { tab: "map", sub: "day", hideEdgeTransport: false },
    status: "draft",
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };
  saveTripRecord(record);
  const idx = ensureIndex();
  idx.trips.push(buildIndexEntry(record));
  idx.activeTripId = id;
  saveIndex(idx);
  state.tripIndex = idx.trips.slice();
  // 调用方负责 setActiveTrip 切过去
  return id;
}

/**
 * 复制一个 trip。返回新 id。
 */
export function duplicateTrip(state, srcId) {
  const src = loadTrip(srcId);
  if (!src) return null;
  const id = newId();
  const now = nowISO();
  const record = {
    id,
    title: (src.title || "") + " (副本)",
    // events/previewView 深拷贝（JSON 来回一次）
    events: JSON.parse(JSON.stringify(src.events || [])),
    previewView: JSON.parse(JSON.stringify(src.previewView || {})),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };
  saveTripRecord(record);
  const idx = ensureIndex();
  idx.trips.push(buildIndexEntry(record));
  saveIndex(idx);
  state.tripIndex = idx.trips.slice();
  return id;
}

/**
 * 删除一个 trip。如果是活跃 trip，活跃指针切到下一个或 null。
 */
export function deleteTrip(state, id) {
  if (!id) return;
  try { window.localStorage.removeItem(tripKey(id)); } catch (_) {}
  const idx = ensureIndex();
  idx.trips = idx.trips.filter((e) => e.id !== id);
  let nextActive = idx.activeTripId;
  if (idx.activeTripId === id) {
    nextActive = idx.trips[0] ? idx.trips[0].id : null;
    idx.activeTripId = nextActive;
  }
  saveIndex(idx);
  state.tripIndex = idx.trips.slice();
  // 如果当前 state 持有的是被删 trip，清空 state（调用方应紧接着 setActiveTrip 或回到 library）
  if (state.activeTripId === id) {
    state.activeTripId = null;
    state.events = [];
    state.trip = { id: null, title: "", createdAt: null, updatedAt: null };
    state.preview.transportCache.clear();
    state.preview.activeTransportId = null;
    state.ui.expandedIds.clear();
    state.ui.justAddedId = null;
    state.autoAnchor.generation++;
    state.autoAnchor.running = false;
  }
  return nextActive;
}

/**
 * 切到指定 trip：完整 teardown + 加载新数据。
 * 调用方负责：（a）确保 location modal 已关闭；（b）切完后重渲。
 */
export function setActiveTrip(state, id) {
  // 1. 强制 flush 当前 trip 的 pending 持久化
  if (state.persistTimer) {
    window.clearTimeout(state.persistTimer);
    state.persistTimer = null;
    flushActiveTrip(state); // 同步写一次
  }
  // 2. 撤销在飞异步：generation 自增让所有跨 trip 回调短路
  state.autoAnchor.generation++;
  state.autoAnchor.running = false;
  // 3. 清运行时缓存
  state.preview.transportCache.clear();
  state.preview.activeTransportId = null;
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  // 4. 加载新 trip
  const record = loadTrip(id);
  if (!record) {
    // 半切风险：保持当前 state 不变，让调用方 toast 错误
    return false;
  }
  state.events = (record.events || []).map(normalizeLoadedEvent);
  state.trip = {
    id: record.id,
    title: record.title || "",
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
  state.previewView = {
    tab: "map",
    sub: "day",
    hideEdgeTransport: false,
    ...(record.previewView || {}),
  };
  state.activeTripId = id;
  // 5. 更新索引
  const idx = ensureIndex();
  idx.activeTripId = id;
  saveIndex(idx);
  state.tripIndex = idx.trips.slice();
  return true;
}

/* ---------- v0.2 shared mode：把分享 payload 装进 state，不写存储 ---------- */

/**
 * 把分享链接解出的 payload 装进 state，供 shared 模式渲染。
 * 不写 localStorage、不动 tripIndex、不动 activeTripId。
 * 调用方负责 setMode(state, 'shared') + renderPreview。
 */
export function loadSharedPayload(state, payload) {
  state.events = (payload.events || []).map(normalizeLoadedEvent);
  state.trip = {
    id: null,
    title: (payload.trip && payload.trip.title) || "",
    createdAt: null,
    updatedAt: null,
  };
  state.previewView = {
    tab: "map",
    sub: "day",
    hideEdgeTransport: false,
    ...(payload.previewView || {}),
  };
  state.activeTripId = null; // shared 模式下没有活跃本地 trip
  state.preview.transportCache.clear();
  state.preview.activeTransportId = null;
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
}

/**
 * 把当前 shared state 复制成一个本地 trip（"复制到我的 Trip"）。
 * 写新 trip 实体 + 加索引 + 切活跃。返回新 id。
 */
export function adoptSharedAsTrip(state) {
  const id = newId();
  const now = nowISO();
  const record = {
    id,
    title: state.trip.title || "",
    events: JSON.parse(JSON.stringify(state.events || [])),
    previewView: JSON.parse(JSON.stringify(state.previewView || {})),
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };
  saveTripRecord(record);
  const idx = ensureIndex();
  idx.trips.push(buildIndexEntry(record));
  idx.activeTripId = id;
  saveIndex(idx);
  state.tripIndex = idx.trips.slice();
  return id;
}

/* ---------- 持久化主循环 ---------- */

/**
 * 启动入口：把索引读进 state.tripIndex；
 * 若有 activeTripId 则 setActiveTrip。否则 state 保持 empty（library 模式）。
 */
export function loadPersistedState(state) {
  const idx = ensureIndex();
  state.tripIndex = idx.trips.slice();
  if (idx.activeTripId) {
    const tryId = idx.activeTripId;
    const ok = setActiveTrip(state, tryId);
    if (!ok) {
      // 活跃 trip 数据丢了；从索引里剔掉、置空 active
      idx.trips = idx.trips.filter((e) => e.id !== tryId);
      idx.activeTripId = null;
      saveIndex(idx);
      state.tripIndex = idx.trips.slice();
    }
  }
}

/**
 * schedulePersist：去抖 250 ms，写实体 + 更新索引项。
 * 7 个调用站零改动 —— 永远操作活跃 trip。
 *
 * v0.2: shared 模式下短路 —— 看别人分享链接时不写本地存储,
 * 也不污染 tripIndex。复制到本机走显式 createTrip 路径。
 */
export function schedulePersist(state) {
  if (state.activeMode === "shared") return;
  if (state.persistTimer) window.clearTimeout(state.persistTimer);
  state.persistTimer = window.setTimeout(() => {
    state.persistTimer = null;
    flushActiveTrip(state);
  }, 250);
}

/**
 * flushPersistNow：同步触发一次 flush（用于切 trip / 进 library 前不丢输入）。
 */
export function flushPersistNow(state) {
  if (state.persistTimer) {
    window.clearTimeout(state.persistTimer);
    state.persistTimer = null;
  }
  flushActiveTrip(state);
}

function flushActiveTrip(state) {
  if (!state.activeTripId) return;
  const now = nowISO();
  const record = {
    id: state.activeTripId,
    title: state.trip.title || "",
    events: state.events,
    previewView: state.previewView,
    createdAt: state.trip.createdAt || now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  };
  state.trip.createdAt = record.createdAt;
  state.trip.updatedAt = now;

  // 先写实体后写索引：crash 时不会出现"索引指向不存在实体"
  if (!saveTripRecord(record)) return;
  const idx = loadIndex();
  if (!idx) return;
  const entry = buildIndexEntry(record);
  const i = idx.trips.findIndex((e) => e.id === record.id);
  if (i >= 0) idx.trips[i] = entry;
  else idx.trips.push(entry);
  saveIndex(idx);
  // 镜像到 state，library 渲染时能立刻反映
  state.tripIndex = idx.trips.slice();
}
