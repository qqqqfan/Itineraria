/* 持久化（v1.0：无遗留迁移） */

import { STORAGE_KEY } from "./state.js";
import { emptyEvent, emptyAnchor } from "./events.js";

export function loadPersistedState(state) {
  const fresh = safeReadJson(STORAGE_KEY);
  if (fresh && Array.isArray(fresh.events)) {
    state.trip = fresh.trip || { title: "" };
    state.events = fresh.events.map(normalizeLoadedEvent);
    state.previewView = {
      ...state.previewView,
      ...(fresh.previewView || {}),
    };
  }
}

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

function safeReadJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("读取存储失败", key, err);
    return null;
  }
}

export function schedulePersist(state) {
  if (state.persistTimer) window.clearTimeout(state.persistTimer);
  state.persistTimer = window.setTimeout(() => {
    state.persistTimer = null;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          trip: state.trip,
          events: state.events,
          previewView: state.previewView,
        })
      );
    } catch (err) {
      console.warn("写入存储失败", err);
    }
  }, 250);
}
