/* PostcardData → HTMLElement
 *
 * 模块各自独立函数，按 schema 槽位选择性插入。
 * 不依赖主产品任何代码（demo 自包含）。
 */

import { validatePostcard } from "./schema.js";

export function renderPostcard(data) {
  const errs = validatePostcard(data);
  if (errs.length) {
    const err = document.createElement("div");
    err.className = "pc pc--error";
    err.textContent = `Postcard 数据错误：${errs.join("; ")}`;
    return err;
  }
  const m = data.modules;
  const card = document.createElement("article");
  card.className = "pc";
  card.dataset.id = data.id;

  card.appendChild(renderHeader(m.header));

  // 中段：左 hero / 右 stamp + meta
  const body = document.createElement("div");
  body.className = "pc__body";

  const left = document.createElement("div");
  left.className = "pc__left";
  left.appendChild(renderHero(m.hero));
  if (m.map)    left.appendChild(renderMap(m.map));
  body.appendChild(left);

  const right = document.createElement("div");
  right.className = "pc__right";
  right.appendChild(renderStamp(m.stamp));
  if (m.weather) right.appendChild(renderWeather(m.weather));
  if (m.ticket)  right.appendChild(renderTicket(m.ticket));
  body.appendChild(right);

  card.appendChild(body);
  card.appendChild(renderFooter(data, m.header));
  return card;
}

/* ---------- modules ---------- */

function renderHeader(h) {
  const el = document.createElement("header");
  el.className = "pc__header";
  el.innerHTML = `
    <div class="pc__header-left">
      <span class="pc__header-place">${esc(h.locationName)}${h.countryCode ? ` · ${esc(h.countryCode)}` : ""}</span>
      <span class="pc__header-date">${formatLongDate(h.date)}</span>
    </div>
    <div class="pc__header-right">
      <span class="pc__header-day">DAY ${pad2(h.dayIndex)} / ${pad2(h.totalDays)}</span>
      <span class="pc__header-coord">${formatCoord(h.coordinate)}</span>
    </div>
  `;
  return el;
}

function renderHero(hero) {
  const el = document.createElement("div");
  el.className = `pc__hero pc__hero--${hero.type}`;
  if (hero.type === "typo") {
    el.innerHTML = `
      <div class="pc__hero-typo">
        <h1 class="pc__hero-title">${esc(hero.title)}</h1>
        ${hero.subtitle ? `<p class="pc__hero-sub">${esc(hero.subtitle)}</p>` : ""}
        ${hero.accent   ? `<p class="pc__hero-accent">${esc(hero.accent)}</p>` : ""}
      </div>
    `;
  } else if (hero.type === "icon") {
    el.innerHTML = `
      <div class="pc__hero-icon">${hero.svgInline || ""}</div>
      ${hero.caption ? `<p class="pc__hero-caption">${esc(hero.caption)}</p>` : ""}
    `;
  } else if (hero.type === "map") {
    el.innerHTML = `
      <div class="pc__hero-map">${hero.svgInline || ""}</div>
      ${hero.caption ? `<p class="pc__hero-caption">${esc(hero.caption)}</p>` : ""}
    `;
  }
  return el;
}

function renderStamp(s) {
  const el = document.createElement("div");
  el.className = `pc__stamp pc__stamp--${s.tone || "black"}`;
  const verb = s.kind === "arrival" ? "ARRIVED" : s.kind === "departure" ? "DEPARTED" : "TRANSIT";
  el.innerHTML = `
    <div class="pc__stamp-ring">
      <span class="pc__stamp-verb">${verb}</span>
      <span class="pc__stamp-place">${esc(s.place)}</span>
      <span class="pc__stamp-date">${esc(s.date)}</span>
    </div>
  `;
  return el;
}

function renderWeather(w) {
  const el = document.createElement("div");
  el.className = "pc__weather";
  el.innerHTML = `
    <div class="pc__weather-temp">
      <span class="pc__weather-low">${w.tempLow}°</span>
      <span class="pc__weather-sep">/</span>
      <span class="pc__weather-high">${w.tempHigh}°</span>
    </div>
    <div class="pc__weather-meta">
      <span class="pc__weather-code">${esc(w.code || "")}</span>
      <span class="pc__weather-sun">↑ ${esc(w.sunrise)} &nbsp; ↓ ${esc(w.sunset)}</span>
    </div>
  `;
  return el;
}

function renderMap(m) {
  const el = document.createElement("div");
  el.className = "pc__map";
  el.innerHTML = `
    <div class="pc__map-svg">${m.svgInline || ""}</div>
    ${m.caption ? `<p class="pc__map-caption">${esc(m.caption)}</p>` : ""}
  `;
  return el;
}

function renderTicket(t) {
  const el = document.createElement("div");
  el.className = `pc__ticket pc__ticket--${t.kind || "flight"}`;
  el.innerHTML = `
    <div class="pc__ticket-row pc__ticket-row--top">
      <span class="pc__ticket-carrier">${esc(t.carrier || "")}</span>
      <span class="pc__ticket-code">${esc(t.code || "")}</span>
    </div>
    <div class="pc__ticket-row pc__ticket-row--main">
      <div class="pc__ticket-od">
        <span class="pc__ticket-place">${esc(t.from || "")}</span>
        <span class="pc__ticket-time">${esc(t.timeFrom || "")}</span>
      </div>
      <div class="pc__ticket-arrow">———————→</div>
      <div class="pc__ticket-od pc__ticket-od--right">
        <span class="pc__ticket-place">${esc(t.to || "")}</span>
        <span class="pc__ticket-time">${esc(t.timeTo || "")}</span>
      </div>
    </div>
    ${t.note ? `<div class="pc__ticket-note">${esc(t.note)}</div>` : ""}
  `;
  return el;
}

function renderFooter(data, h) {
  const el = document.createElement("footer");
  el.className = "pc__footer";
  // 模拟邮政编号 / 序列号
  const serial = `№ ${pad3(h.dayIndex)} / ${pad3(h.totalDays)}`;
  el.innerHTML = `
    <span class="pc__footer-serial">${serial}</span>
    <span class="pc__footer-line"></span>
    <span class="pc__footer-issued">TRIPSTUDIO · ISSUED ${formatShortDate(data.date)}</span>
  `;
  return el;
}

/* ---------- helpers ---------- */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad2(n) { return String(n).padStart(2, "0"); }
function pad3(n) { return String(n).padStart(3, "0"); }

function formatLongDate(ymd) {
  // "2026-05-05" → "MAY 5, 2026"
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [_, y, mo, d] = m;
  return `${months[+mo - 1]} ${+d}, ${y}`;
}

function formatShortDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[2]}.${m[3]}.${m[1]}`;
}

function formatCoord(c) {
  if (!c) return "";
  const ns = c.lat >= 0 ? "N" : "S";
  const ew = c.lon >= 0 ? "E" : "W";
  return `${Math.abs(c.lat).toFixed(4)}° ${ns} · ${Math.abs(c.lon).toFixed(4)}° ${ew}`;
}
