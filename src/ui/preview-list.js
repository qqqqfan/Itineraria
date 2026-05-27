/* 预览：列表 Tab */

import {
  sortedEvents,
  allHaveDate,
  emojiOf,
  typeKey,
  displayDefaultName,
  buildTransportSubtitle,
} from "../events.js";
import { escapeHtml } from "../utils/dom.js";
import { formatDateRange, weekdayOf } from "../utils/date.js";
import { computeAutoTags } from "./auto-tags.js";
import { groupByDate } from "./preview-axis.js";

export function renderPreviewList(state) {
  const list = document.getElementById("preview-list");
  if (!list) return;
  list.innerHTML = "";
  const sorted = sortedEvents(state);
  if (!sorted.length) {
    list.innerHTML = `<div class="empty-state">还没有事件，去表单添加</div>`;
    return;
  }
  if (state.previewView.sub === "day" && allHaveDate(state)) {
    const groups = groupByDate(sorted);
    groups.forEach((g) => list.appendChild(renderListDayCard(state, g)));
  } else {
    sorted.forEach((e) => list.appendChild(renderListItem(state, e)));
  }
}

function renderListDayCard(state, group) {
  const card = document.createElement("div");
  card.className = "list-day-card";
  card.innerHTML = `
    <div class="list-day-card__header">
      <strong>${escapeHtml(group.date)}</strong>
      <span class="list-day-card__weekday">${weekdayOf(group.date)}</span>
    </div>
    <div class="list-day-card__body"></div>
  `;
  const body = card.querySelector(".list-day-card__body");
  group.events.forEach((e) => body.appendChild(renderListItem(state, e)));
  return card;
}

function renderListItem(state, evt) {
  const item = document.createElement("div");
  item.className = `list-item list-item--${typeKey(evt.type)}`;
  const subtitle = evt.type === "交通"
    ? buildTransportSubtitle(evt)
    : (evt.anchor && evt.anchor.label) || "未锚定";
  const autoTags = computeAutoTags(evt, state);
  const userTags = Array.isArray(evt.tags) ? evt.tags : [];
  const tagsHtml = (autoTags.length || userTags.length)
    ? `<div class="list-item__tags">` +
      autoTags.map((a) => `<span class="tag-chip tag-chip--auto"${a.title ? ` title="${escapeHtml(a.title)}"` : ""}>${escapeHtml(a.label)}</span>`).join("") +
      userTags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("") +
      `</div>`
    : "";
  item.innerHTML = `
    <div class="list-item__type">${emojiOf(evt.type)}</div>
    <div class="list-item__main">
      <div class="list-item__name">${escapeHtml(evt.name || displayDefaultName(evt))}</div>
      <div class="list-item__sub">${escapeHtml(subtitle)}</div>
      ${tagsHtml}
    </div>
    ${evt.date ? `<div class="list-item__date">${escapeHtml(formatDateRange(evt.date))}</div>` : ""}
  `;
  return item;
}
