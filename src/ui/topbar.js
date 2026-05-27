/* 顶栏：mode 切换 / 示例 / 重置 / 导出 / trip 标题 */

import { schedulePersist, normalizeLoadedEvent } from "../storage.js";
import { buildSampleEvents, SAMPLE_GRAND_TOUR_2026 } from "../data/sample.js";
import { startAutoAnchor } from "../geo/nominatim.js";
import { renderEventList } from "./event-list.js";
import {
  renderPreview,
  renderPreviewHeader,
  refreshPreviewPoints,
} from "./preview-map.js";
import { toast } from "./toast.js";

export function initTopbar(state) {
  document.querySelectorAll("[data-mode-button]").forEach((btn) => {
    btn.addEventListener("click", () => setMode(state, btn.dataset.modeButton));
  });
  document.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    if (action === "load-sample") {
      btn.addEventListener("click", () => loadSample(state));
    } else if (action === "reset-form") {
      btn.addEventListener("click", () => resetAll(state));
    } else if (action === "export-json") {
      btn.addEventListener("click", () => exportJSON(state));
    } else if (action === "import-json") {
      btn.addEventListener("click", () => triggerImportJSON());
    }
  });
  const importInput = document.getElementById("import-json-input");
  if (importInput) {
    importInput.addEventListener("change", (e) => handleImportFile(state, e));
  }
  const titleInput = document.querySelector("[data-trip-field='title']");
  if (titleInput) {
    titleInput.value = state.trip.title || "";
    titleInput.addEventListener("input", (e) => {
      state.trip.title = e.target.value;
      schedulePersist(state);
      renderPreviewHeader(state);
    });
  }
}

export function setMode(state, mode) {
  state.activeMode = mode;
  document.querySelectorAll("[data-mode-button]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.modeButton === mode);
  });
  document.querySelectorAll(".mode-section").forEach((sec) => {
    sec.classList.toggle("is-active", sec.dataset.modeSection === mode);
  });
  if (mode === "preview") {
    renderPreview(state);
    window.setTimeout(() => {
      if (state.preview.map) state.preview.map.invalidateSize();
    }, 60);
  }
}

function loadSample(state) {
  const sampleTitle = (SAMPLE_GRAND_TOUR_2026 && SAMPLE_GRAND_TOUR_2026.trip && SAMPLE_GRAND_TOUR_2026.trip.title) || "grand tour 2026";
  state.trip = { title: sampleTitle };
  state.events = buildSampleEvents();
  state.preview.transportCache.clear();
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  schedulePersist(state);
  renderAll(state);
  // 后台自动锚定（异步、节流），不阻塞 UI
  startAutoAnchor(state, {
    onAnchored: () => {
      renderEventList(state);
      if (state.activeMode === "preview" && state.preview.map) {
        refreshPreviewPoints(state);
      }
      schedulePersist(state);
    },
  });
}

function resetAll(state) {
  if (!window.confirm("确认清空当前所有数据？")) return;
  state.trip = { title: "" };
  state.events = [];
  state.preview.transportCache.clear();
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  schedulePersist(state);
  renderAll(state);
}

function exportJSON(state) {
  if (!state.events.length) {
    window.alert("还没有事件可以导出，先在表单里加一条吧。");
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: "plan-your-tour-studio-v1.0",
    trip: state.trip,
    events: state.events,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const safeTitle = (state.trip.title || "trip")
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "trip";
  const a = document.createElement("a");
  a.href = url;
  a.download = `tripstudio-${safeTitle}-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerImportJSON() {
  const input = document.getElementById("import-json-input");
  if (!input) return;
  // 重置 value 让选同一个文件也能再次触发 change
  input.value = "";
  input.click();
}

function handleImportFile(state, event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (state.events.length) {
    if (!window.confirm(`导入会替换当前 ${state.events.length} 张事件，确认继续？`)) {
      event.target.value = "";
      return;
    }
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const parsed = JSON.parse(text);
      applyImportedPayload(state, parsed);
    } catch (err) {
      console.warn("导入 JSON 解析失败", err);
      toast.error(`导入失败：JSON 解析错误（${err && err.message ? err.message : "格式不正确"}）`);
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    toast.error("导入失败：无法读取文件");
    event.target.value = "";
  };
  reader.readAsText(file);
}

function applyImportedPayload(state, payload) {
  if (!payload || typeof payload !== "object") {
    toast.error("导入失败：JSON 顶层不是对象");
    return;
  }
  const events = Array.isArray(payload.events) ? payload.events : null;
  if (!events) {
    toast.error("导入失败：缺少 events 数组");
    return;
  }
  // 校验：每条 event 至少要有 type
  const validTypes = new Set(["酒店", "游览", "餐饮", "活动", "交通"]);
  const cleaned = [];
  let skipped = 0;
  events.forEach((e) => {
    if (!e || !validTypes.has(e.type)) {
      skipped++;
      return;
    }
    cleaned.push(normalizeLoadedEvent(e));
  });
  if (!cleaned.length) {
    toast.error("导入失败：没有可识别的事件");
    return;
  }
  state.trip = (payload.trip && typeof payload.trip === "object")
    ? { title: String(payload.trip.title || "") }
    : { title: "" };
  state.events = cleaned;
  state.preview.transportCache.clear();
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  schedulePersist(state);
  renderAll(state);
  if (skipped > 0) {
    toast.warn(`导入完成：${cleaned.length} 条成功，${skipped} 条跳过（type 不识别）`);
  } else {
    toast.success(`导入完成：${cleaned.length} 条事件`);
  }
}

export function renderAll(state) {
  syncTripTitleInput(state);
  renderEventList(state);
  renderPreviewHeader(state);
  renderPreview(state);
}

function syncTripTitleInput(state) {
  const input = document.querySelector("[data-trip-field='title']");
  if (input && input.value !== (state.trip.title || "")) {
    input.value = state.trip.title || "";
  }
}
