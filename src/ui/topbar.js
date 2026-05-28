/* 顶栏：mode 切换 / trip 标题 / 面包屑返回 library
 *
 * v1.0：不存在"发布"概念。所有动作（导入 / 示例 / 清空 / 导出）
 * 都搬到事件 panel header 内（位置即语义）。这里只负责导航 + 标题。
 */

import {
  schedulePersist,
  flushPersistNow,
  normalizeLoadedEvent,
  createTrip,
  setActiveTrip,
  adoptSharedAsTrip,
} from "../storage.js";
import { clearShareHash } from "../share.js";
import { buildSampleEvents, SAMPLE_GRAND_TOUR_2026 } from "../data/sample.js";
import { startAutoAnchor } from "../geo/nominatim.js";
import { renderEventList } from "./event-list.js";
import {
  renderPreview,
  renderPreviewHeader,
  refreshPreviewPoints,
} from "./preview-map.js";
import { renderLibrary } from "./library.js";
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
    } else if (action === "back-to-library") {
      btn.addEventListener("click", () => setMode(state, "library"));
    } else if (action === "adopt-shared") {
      btn.addEventListener("click", () => adoptSharedTrip(state));
    } else if (action === "leave-shared") {
      btn.addEventListener("click", () => leaveSharedMode(state));
    }
  });
  initOverflowMenus();
  const importInput = document.getElementById("import-json-input");
  if (importInput) {
    importInput.addEventListener("change", (e) => handleImportFile(state, e));
  }
  const titleInput = document.querySelector("[data-trip-field='title']");
  if (titleInput) {
    titleInput.value = state.trip.title || "";
    titleInput.addEventListener("input", (e) => {
      // 没有活跃 trip 时禁止编辑标题（理论上 form mode 永远有 active；safety net）
      if (!state.activeTripId) return;
      state.trip.title = e.target.value;
      schedulePersist(state);
      renderPreviewHeader(state);
      pingAutosaveHint();
      // 标题改变会影响 library 行，但用户看不到 library；切回 library 时会重渲
    });
  }
}

export function setMode(state, mode) {
  // form / preview 都需要 activeTripId；空仓库时只允许进 library
  // shared 是一个独立模式：从 URL hash 进来,不需要 activeTripId
  if ((mode === "form" || mode === "preview") && !state.activeTripId) {
    mode = "library";
  }
  state.activeMode = mode;

  // Topbar 三视图切换：
  //   library  → 父层(仅品牌名)
  //   trip     → 工作台(面包屑+标题+子模式+动作)
  //   shared   → 查看条(只读他人 trip,带"复制到我的 Trip")
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    if (mode === "library") topbar.dataset.topbarView = "library";
    else if (mode === "shared") topbar.dataset.topbarView = "shared";
    else topbar.dataset.topbarView = "trip";
  }

  // 仅在 trip 工作台内的 mode-nav 才有 form/preview 按钮；library/shared 时不点亮任何按钮
  document.querySelectorAll("[data-mode-button]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.modeButton === mode);
  });
  // shared 模式复用 preview 的 mode-section（同一套渲染引擎）
  const visibleSection = mode === "shared" ? "preview" : mode;
  document.querySelectorAll(".mode-section").forEach((sec) => {
    sec.classList.toggle("is-active", sec.dataset.modeSection === visibleSection);
  });
  if (mode === "preview" || mode === "shared") {
    renderPreview(state);
    if (mode === "shared") renderSharedTopbar(state);
    window.setTimeout(() => {
      if (state.preview.map) state.preview.map.invalidateSize();
    }, 60);
  } else if (mode === "library") {
    // 进入 library 前若有 pending 持久化（如刚改完标题），先同步 flush 一次
    // 让 tripIndex 反映最新标题/事件数
    if (state.activeTripId) flushPersistNow(state);
    renderLibrary(state);
  } else if (mode === "form") {
    // 切回 form 时同步 title 输入框
    syncTripTitleInput(state);
    renderEventList(state);
    renderPreviewHeader(state);
  }
}

/* shared 模式 topbar 文案：把标题填进只读条 */
function renderSharedTopbar(state) {
  const titleEl = document.querySelector("[data-shared-title]");
  if (titleEl) {
    titleEl.textContent = state.trip.title || "未命名 Trip";
  }
}

/* "退出查看":丢掉 shared payload,回到本机的 library / form
 * shared 模式不写存储,所以 state.events 直接清空即可。 */
function leaveSharedMode(state) {
  if (state.activeMode !== "shared") return;
  clearShareHash();
  // 清掉 shared payload
  state.events = [];
  state.trip = { id: null, title: "", createdAt: null, updatedAt: null };
  state.preview.transportCache.clear();
  state.preview.activeTransportId = null;
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  // 看本地有没有 trip:有就回到上次的活跃 trip(从索引里读),没有就 library
  const idx = state.tripIndex || [];
  const lastActive = idx.length ? idx[0].id : null;
  if (lastActive) {
    setActiveTrip(state, lastActive);
    setMode(state, "form");
  } else {
    setMode(state, "library");
  }
  renderAll(state);
}

/* "复制到我的 Trip"：把 shared payload 写成本地 trip,清掉分享 hash,进 form */
function adoptSharedTrip(state) {
  if (state.activeMode !== "shared") return;
  if (!state.events || !state.events.length) {
    toast.warn("没有可复制的内容");
    return;
  }
  const id = adoptSharedAsTrip(state);
  if (!id) {
    toast.error("复制失败");
    return;
  }
  // 切到刚写入的本地 trip(setActiveTrip 会重新 load record + 切 activeTripId)
  const ok = setActiveTrip(state, id);
  if (!ok) {
    toast.error("复制失败:数据写入异常");
    return;
  }
  clearShareHash(); // 地址栏 #t=... → 干净 URL
  toast.success("已复制到我的 Trip,可以继续编辑");
  setMode(state, "form");
  renderAll(state);
}

function loadSample(state) {
  // 没有活跃 trip → 先创建一个
  if (!state.activeTripId) {
    const id = createTrip(state, { title: "" });
    setActiveTrip(state, id);
  }
  const sampleTitle =
    (SAMPLE_GRAND_TOUR_2026 && SAMPLE_GRAND_TOUR_2026.trip && SAMPLE_GRAND_TOUR_2026.trip.title) ||
    "grand tour 2026";
  state.trip.title = sampleTitle;
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
  if (!state.activeTripId) return;
  if (!window.confirm("确认清空当前 Trip 的所有事件？标题保留。")) return;
  state.events = [];
  state.preview.transportCache.clear();
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  schedulePersist(state);
  renderAll(state);
}

function exportJSON(state) {
  if (!state.events.length) {
    window.alert("还没有事件可导出，先在表单里加一条。");
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: "plan-your-tour-studio-v1.0",
    trip: { title: state.trip.title },
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
    if (!window.confirm(`导入会替换当前 ${state.events.length} 个事件，确认继续？`)) {
      event.target.value = "";
      return;
    }
  }
  // 文案规则：confirm 措辞和 voice.md 第 5 条对齐——陈述事实 + 不评价。
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
  // 没有活跃 trip → 自动创建一个承载导入数据
  if (!state.activeTripId) {
    const id = createTrip(state, { title: (payload.trip && payload.trip.title) || "" });
    setActiveTrip(state, id);
  }
  if (payload.trip && typeof payload.trip === "object") {
    state.trip.title = String(payload.trip.title || "");
  } else {
    state.trip.title = "";
  }
  state.events = cleaned;
  state.preview.transportCache.clear();
  state.ui.expandedIds.clear();
  state.ui.justAddedId = null;
  schedulePersist(state);
  renderAll(state);
  if (skipped > 0) {
    toast.warn(`导入完成 · ${cleaned.length} 个事件；${skipped} 个跳过（type 不识别）`);
  } else {
    toast.success(`导入完成 · ${cleaned.length} 个事件`);
  }
}

/* ---------- 自动保存提示（transient） ---------- */

let autosaveHintTimer = null;
export function pingAutosaveHint() {
  const el = document.querySelector("[data-autosave-hint]");
  if (!el) return;
  el.classList.remove("is-saved");
  el.classList.add("is-saving");
  el.textContent = "保存中…";
  if (autosaveHintTimer) window.clearTimeout(autosaveHintTimer);
  autosaveHintTimer = window.setTimeout(() => {
    el.classList.remove("is-saving");
    el.classList.add("is-saved");
    el.textContent = "已自动保存";
  }, 320);
}

/* ---------- 溢出菜单（事件 panel header 内） ---------- */

function initOverflowMenus() {
  document.querySelectorAll("[data-overflow-menu]").forEach((wrap) => {
    const trigger = wrap.querySelector("[data-overflow-trigger]");
    const panel = wrap.querySelector("[data-overflow-panel]");
    if (!trigger || !panel) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.hasAttribute("hidden");
      closeAllOverflowMenus();
      if (open) {
        panel.removeAttribute("hidden");
        trigger.setAttribute("aria-expanded", "true");
        wrap.classList.add("is-open");
      }
    });
    panel.addEventListener("click", (e) => {
      const item = e.target.closest("[role='menuitem']");
      if (!item) return;
      // 让原 action 按钮的 click handler 处理；菜单关闭即可
      closeAllOverflowMenus();
    });
  });
  document.addEventListener("click", () => closeAllOverflowMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllOverflowMenus();
  });
}

function closeAllOverflowMenus() {
  document.querySelectorAll("[data-overflow-menu]").forEach((wrap) => {
    const trigger = wrap.querySelector("[data-overflow-trigger]");
    const panel = wrap.querySelector("[data-overflow-panel]");
    if (!panel || panel.hasAttribute("hidden")) return;
    panel.setAttribute("hidden", "");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    wrap.classList.remove("is-open");
  });
}

export function renderAll(state) {
  syncTripTitleInput(state);
  renderEventList(state);
  renderPreviewHeader(state);
  renderPreview(state);
  renderLibrary(state);
}

function syncTripTitleInput(state) {
  const input = document.querySelector("[data-trip-field='title']");
  if (input && input.value !== (state.trip.title || "")) {
    input.value = state.trip.title || "";
  }
}
