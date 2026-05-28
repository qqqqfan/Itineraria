/* 事件列表（按日期 + 未填日期分组、状态摘要、可拖拽） */

import {
  emptyEvent,
  hasDate,
  sortedEvents,
  nextSortIndex,
  analyzeEvents,
} from "../events.js";
import { mutate } from "../mutate.js";
import { escapeHtml } from "../utils/dom.js";
import { renderEventCard } from "./event-card.js";

export function initFormBindings(state) {
  document.querySelectorAll("[data-action='add-event']").forEach((btn) => {
    btn.addEventListener("click", () => {
      mutate(state, (s) => {
        const evt = emptyEvent("游览");
        evt.sortIndex = nextSortIndex(s);
        s.events.push(evt);
        s.ui.expandedIds.add(evt.id);
        s.ui.justAddedId = evt.id;
      }, { rerender: "list" });
      focusJustAddedCard(state);
    });
  });
}

/**
 * 单卡级重渲：把现有 .event-card[data-event-id] 替换成新渲染的卡片，
 * 不动其他卡，不动滚动位置，不动 IME composing 状态。
 * 用于：编辑名称/tag/日期/地点/交通方式 等"内部字段"变更后回流。
 *
 * 如果卡片不在 DOM 中（比如它属于另一组、被排序到不可见处）就 fallback 到全量。
 */
export function rerenderCard(state, eventId) {
  const evt = state.events.find((e) => e.id === eventId);
  const old = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
  if (!evt || !old) {
    renderEventList(state);
    return;
  }
  const fresh = renderEventCard(state, evt);
  old.replaceWith(fresh);
  renderEventStatus(state);
}

function focusJustAddedCard(state) {
  const id = state.ui.justAddedId;
  if (!id) return;
  window.requestAnimationFrame(() => {
    const card = document.querySelector(`.event-card[data-event-id="${id}"]`);
    if (!card) return;
    card.classList.add("event-card--just-added");
    try {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (_) {
      card.scrollIntoView();
    }
    const nameInput = card.querySelector(".event-card__body input[type='text']");
    if (nameInput) {
      window.setTimeout(() => nameInput.focus({ preventScroll: true }), 220);
    }
    window.setTimeout(() => card.classList.remove("event-card--just-added"), 900);
    state.ui.justAddedId = null;
  });
}

export function renderEventList(state) {
  const container = document.getElementById("event-list");
  if (!container) return;
  renderEventStatus(state);
  container.innerHTML = "";

  if (state.events.length === 0) {
    container.innerHTML = renderEmptyOnboarding();
    bindEmptyOnboarding(state, container);
    return;
  }

  const sorted = sortedEvents(state);
  const firstUndatedIdx = sorted.findIndex((e) => !hasDate(e));
  const datedGroup = firstUndatedIdx === -1 ? sorted : sorted.slice(0, firstUndatedIdx);
  const undatedGroup = firstUndatedIdx === -1 ? [] : sorted.slice(firstUndatedIdx);

  const datedList = document.createElement("div");
  datedList.className = "event-list__group";
  datedList.dataset.group = "dated";
  datedGroup.forEach((evt) => datedList.appendChild(renderEventCard(state, evt)));
  container.appendChild(datedList);

  if (undatedGroup.length) {
    const divider = document.createElement("div");
    divider.className = "list-divider";
    divider.textContent = "以下未填日期，按拖动顺序排列";
    container.appendChild(divider);

    const undatedList = document.createElement("div");
    undatedList.className = "event-list__group";
    undatedList.dataset.group = "undated";
    undatedGroup.forEach((evt) => undatedList.appendChild(renderEventCard(state, evt)));
    container.appendChild(undatedList);
  }

  bindSortable(state, container);
}

function bindSortable(state, container) {
  if (!window.Sortable) return;
  // P1 #6：只在 undated 组上启用拖拽。
  // 有日期的卡片：顺序由 date.from 决定，拖动只会被强制还原，徒增困惑。
  // 顶部 divider 文案已经提示"调整顺序请修改日期"。
  const group = container.querySelector(".event-list__group[data-group='undated']");
  if (!group) return;
  new window.Sortable(group, {
    handle: ".drag-handle",
    animation: 150,
    ghostClass: "event-card--ghost",
    onEnd: () => {
      const newOrder = Array.from(group.querySelectorAll(".event-card")).map(
        (el) => el.dataset.eventId
      );
      const baseIndex = nextSortIndex(state);
      newOrder.forEach((eid, i) => {
        const e = state.events.find((x) => x.id === eid);
        if (e) e.sortIndex = baseIndex + i;
      });
      mutate(state, () => {}, { rerender: "list" });
    },
  });
}

function renderEmptyOnboarding() {
  return `
    <div class="onboarding">
      <div class="onboarding__title">从一张事件卡片开始</div>
      <div class="onboarding__lead">把每一天要做的事拆成一张卡片。地图里点出地点，预览自动连起来。</div>
      <ol class="onboarding__steps">
        <li><strong>添加事件</strong>：点下方 <span class="onboarding__plus">+</span>，选类型（酒店 / 游览 / 餐饮 / 活动 / 交通）。</li>
        <li><strong>锚定地点</strong>：点「地点」按钮 → 输入名字 → 回车搜索 OSM；找不到就在地图上点击或拖针。</li>
        <li><strong>填日期可选</strong>：填了就按日期排序；不填就在底部按拖动顺序排列。</li>
      </ol>
      <div class="onboarding__cta">
        <button class="primary-button" data-onboard-action="add">+ 添加第一个事件</button>
        <button class="tiny-button" data-onboard-action="sample">加载示例</button>
      </div>
    </div>
  `;
}

function bindEmptyOnboarding(state, container) {
  const addBtn = container.querySelector("[data-onboard-action='add']");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const real = document.querySelector("[data-action='add-event']");
      if (real) real.click();
    });
  }
  const sampleBtn = container.querySelector("[data-onboard-action='sample']");
  if (sampleBtn) {
    sampleBtn.addEventListener("click", () => {
      const real = document.querySelector("[data-action='load-sample']");
      if (real) real.click();
    });
  }
}

export function renderEventStatus(state) {
  // 同时给"导出"按钮做启用门控：无事件可导出时禁用
  const exportBtn = document.querySelector("[data-action='export-json']");
  if (exportBtn) {
    const enabled = !!state.activeTripId && state.events.length > 0;
    exportBtn.disabled = !enabled;
    exportBtn.classList.toggle("is-disabled", !enabled);
  }
  const el = document.getElementById("event-status");
  if (!el) return;
  const s = analyzeEvents(state);
  const parts = [`<span class="event-status__count">共 ${s.total} 个</span>`];
  if (s.total === 0) {
    el.innerHTML = parts.join("");
    return;
  }
  const issues = [];
  if (s.missingLocation) issues.push(`${s.missingLocation} 个缺地点`);
  if (s.missingTransportMode) issues.push(`${s.missingTransportMode} 个缺交通方式`);
  if (issues.length) {
    issues.forEach((t) => parts.push(`<span class="event-status__issue">⚠ ${escapeHtml(t)}</span>`));
  } else {
    parts.push(`<span class="event-status__issue event-status__issue--ok">✓ 全部就绪</span>`);
  }
  // 状态文案：缺地点/缺交通方式 走 events.js analyzeEvents；按 voice.md
  // 规则——数据维度用「个」，前后文已指代事件可省略名词（"5 个"/"3 个缺地点"）。
  el.innerHTML = parts.join("");
}
