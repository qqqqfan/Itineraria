/* Library 模式：Trip 列表 / 新建 / 切换 / 复制 / 删除
 *
 * 渲染来源：state.tripIndex（IndexEntry[] 镜像）。
 * 行为入口都通过 setActiveTrip / createTrip / duplicateTrip / deleteTrip 走 storage 层。
 */

import {
  createTrip,
  duplicateTrip,
  deleteTrip,
  setActiveTrip,
} from "../storage.js";
import { escapeHtml } from "../utils/dom.js";
import { toast } from "./toast.js";

/* ---------- 初始化：事件委托 ---------- */

export function initLibrary(state) {
  // 顶层"新建 Trip"按钮（在 library section 顶部）
  document.querySelectorAll("[data-action='new-trip']").forEach((btn) => {
    btn.addEventListener("click", () => handleNewTrip(state));
  });

  // 行级 action（事件委托，避免每次重渲都重挂）
  const list = document.querySelector("[data-library-list]");
  if (list) {
    list.addEventListener("click", (e) => handleListClick(state, e));
  }
}

/* ---------- 渲染 ---------- */

export function renderLibrary(state) {
  const list = document.querySelector("[data-library-list]");
  if (!list) return;
  const trips = (state.tripIndex || []).slice().sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || "";
    const tb = b.updatedAt || b.createdAt || "";
    return tb.localeCompare(ta);
  });
  if (!trips.length) {
    list.innerHTML = `
      <li class="library__empty">
        还没有 Trip — 点击右上「+ 新建 Trip」开始。
      </li>
    `;
    return;
  }
  list.innerHTML = trips.map((entry) => rowHTML(state, entry)).join("");
}

function rowHTML(state, entry) {
  const isActive = entry.id === state.activeTripId;
  const title = entry.title ? escapeHtml(entry.title) : "<span class='library__title--empty'>未命名 Trip</span>";
  const meta = `${entry.eventCount || 0} 个事件 · 更新于 ${formatRelative(entry.updatedAt)}`;
  return `
    <li class="library__row ${isActive ? "is-active" : ""}" data-trip-id="${escapeHtml(entry.id)}">
      <button class="library__row-main" data-trip-action="open" type="button">
        <span class="library__title">${title}</span>
        <span class="library__meta">${meta}</span>
      </button>
      <div class="library__row-actions">
        <button class="tiny-button" data-trip-action="duplicate" type="button" title="复制为新 Trip">复制</button>
        <button class="tiny-button library__danger" data-trip-action="delete" type="button" title="删除此 Trip">删除</button>
      </div>
    </li>
  `;
}

/* ---------- 事件处理 ---------- */

function handleListClick(state, e) {
  const actionEl = e.target.closest("[data-trip-action]");
  if (!actionEl) return;
  const row = actionEl.closest("[data-trip-id]");
  if (!row) return;
  const id = row.dataset.tripId;
  const action = actionEl.dataset.tripAction;
  if (action === "open")      handleOpenTrip(state, id);
  else if (action === "duplicate") handleDuplicateTrip(state, id);
  else if (action === "delete")    handleDeleteTrip(state, id);
}

function handleNewTrip(state) {
  const id = createTrip(state, { title: "" });
  const ok = setActiveTrip(state, id);
  if (!ok) {
    toast.error("新建失败");
    return;
  }
  // 切到 form 模式，让用户立刻填标题
  goToForm(state);
}

function handleOpenTrip(state, id) {
  if (id === state.activeTripId && state.activeMode === "form") return;
  const ok = setActiveTrip(state, id);
  if (!ok) {
    toast.error("打开失败：数据可能已损坏");
    renderLibrary(state);
    return;
  }
  goToForm(state);
}

function handleDuplicateTrip(state, id) {
  const newId = duplicateTrip(state, id);
  if (!newId) {
    toast.error("复制失败");
    return;
  }
  toast.success("已复制");
  renderLibrary(state);
}

function handleDeleteTrip(state, id) {
  const entry = (state.tripIndex || []).find((e) => e.id === id);
  const title = entry && entry.title ? entry.title : "未命名 Trip";
  if (!window.confirm(`确认删除「${title}」？此操作不可撤销。`)) return;
  const wasActive = id === state.activeTripId;
  const nextActive = deleteTrip(state, id);
  toast.success("已删除");
  if (wasActive) {
    if (nextActive) {
      setActiveTrip(state, nextActive);
      renderLibrary(state);
      // 留在 library，让用户决定接下来开哪个 / 不强行进 form
    } else {
      renderLibrary(state);
    }
  } else {
    renderLibrary(state);
  }
}

/* ---------- helpers ---------- */

function goToForm(state) {
  // 不导入 setMode 避免循环；通过点击 mode 按钮触发同样的 setMode 路径。
  const btn = document.querySelector("[data-mode-button='form']");
  if (btn) btn.click();
}

function formatRelative(iso) {
  if (!iso) return "尚未保存";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const now = Date.now();
  const diff = (now - t) / 1000; // 秒
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  // 超过一周 → 显示日期
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, "0"); }
