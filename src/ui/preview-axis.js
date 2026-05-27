/* 预览底部横轴：by day / by event */

import {
  hasDate,
  allHaveDate,
  emojiOf,
  transportEmojiOf,
  typeKey,
  displayDefaultName,
  buildTransportSubtitle,
} from "../events.js";
import { escapeHtml } from "../utils/dom.js";
import { formatDateRange, weekdayOf } from "../utils/date.js";
import { focusOnAnchor, toggleTransportRoute } from "./preview-map.js";

export function renderAxis(state, sorted, sub) {
  const axis = document.getElementById("preview-axis");
  if (!axis) return;
  axis.innerHTML = "";

  if (!sorted.length) {
    axis.innerHTML = `<div class="empty-state">还没有事件，去表单添加</div>`;
    return;
  }

  if (sub === "day" && allHaveDate(state)) {
    const groups = groupByDate(sorted);
    groups.forEach((g) => axis.appendChild(renderDayCard(state, g)));
  } else {
    sorted.forEach((evt) => axis.appendChild(renderEventChip(state, evt)));
  }
}

export function groupByDate(sorted) {
  const map = new Map();
  sorted.forEach((evt) => {
    if (!hasDate(evt)) return;
    const key = evt.date.from;
    if (!map.has(key)) map.set(key, { date: key, events: [] });
    map.get(key).events.push(evt);
  });
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function renderDayCard(state, group) {
  const card = document.createElement("div");
  card.className = "day-card";
  const header = document.createElement("div");
  header.className = "day-card__header";
  header.innerHTML = `<strong>${escapeHtml(group.date)}</strong> <span class="day-card__weekday">${weekdayOf(group.date)}</span>`;
  card.appendChild(header);
  const list = document.createElement("div");
  list.className = "day-card__events";
  group.events.forEach((e) => list.appendChild(renderEventChip(state, e)));
  card.appendChild(list);
  return card;
}

function renderEventChip(state, evt) {
  const wrap = document.createElement("div");
  wrap.className = `event-chip-wrap`;

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `event-chip event-chip--${typeKey(evt.type)}`;
  const emoji = evt.type === "交通" ? transportEmojiOf(evt) : emojiOf(evt.type);
  const title = evt.name || displayDefaultName(evt);
  const timeText = evt.date ? formatDateRange(evt.date) : "";
  const timeRow = timeText
    ? `<span class="event-chip__time">${escapeHtml(timeText)}</span>`
    : `<span class="event-chip__time" style="opacity:.5">未填日期</span>`;
  chip.innerHTML = `
    <span class="event-chip__emoji">${emoji}</span>
    <span class="event-chip__main">
      <span class="event-chip__name">${escapeHtml(title)}</span>
      ${timeRow}
    </span>
  `;
  const hoverParts = [];
  if (evt.type === "交通") {
    hoverParts.push(buildTransportSubtitle(evt));
  } else if (evt.anchor && evt.anchor.label) {
    hoverParts.push(evt.anchor.label);
  }
  if (Array.isArray(evt.tags) && evt.tags.length) {
    hoverParts.push(`#${evt.tags.join("  #")}`);
  }
  if (hoverParts.length) chip.title = hoverParts.join(" · ");

  if (evt.type === "交通") {
    chip.classList.add("event-chip--transport");
    chip.addEventListener("click", () => toggleTransportRoute(state, evt));
  } else if (evt.anchor && evt.anchor.lat != null) {
    chip.addEventListener("click", () => focusOnAnchor(state, evt.anchor));
  }
  wrap.appendChild(chip);

  return wrap;
}
