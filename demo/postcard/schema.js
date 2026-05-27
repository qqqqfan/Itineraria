/* PostcardData schema（demo 版，与 PRD v3 / ROADMAP Phase 4 契约对齐）
 *
 * 一张明信片 = 6 个槽位的可选组合（v1.0 强制 fieldNote/tip = null）
 *   header  必填
 *   stamp   必填
 *   hero    必填（typo / map / icon 三选一）
 *   weather 选填
 *   map     选填
 *   ticket  选填
 *
 * v1.0 验证目的：先看视觉，所以这里所有字段都接受 hardcoded mock data。
 * 后续 generator.js 接 events[] + Phase 5 真数据。
 */

export function validatePostcard(p) {
  const errs = [];
  if (!p) return ["postcard is null"];
  if (!p.id) errs.push("missing id");
  if (!p.date) errs.push("missing date");
  if (!p.modules) errs.push("missing modules");
  else {
    const m = p.modules;
    if (!m.header) errs.push("missing modules.header");
    if (!m.stamp)  errs.push("missing modules.stamp");
    if (!m.hero)   errs.push("missing modules.hero");
    if (m.hero && !["typo", "map", "icon"].includes(m.hero.type)) {
      errs.push(`invalid hero.type: ${m.hero.type}`);
    }
  }
  return errs;
}

/* 槽位字段示意（不强制运行时校验，写在这是给后续 generator 当参考）：
 *
 * header: {
 *   locationName: "Paris",
 *   countryCode:  "FR",
 *   date:         "2026-05-05",
 *   dayIndex:     1,           // 行程第 N 天
 *   totalDays:    16,
 *   coordinate:   { lat: 48.8534, lon: 2.3483 }
 * }
 *
 * stamp: {
 *   kind:     "arrival" | "departure" | "transit",
 *   place:    "Paris CDG",
 *   date:     "2026-05-05",
 *   tone:     "red" | "blue" | "black",
 * }
 *
 * hero (type=typo): {
 *   type: "typo",
 *   title:    "PARIS",
 *   subtitle: "48.8534° N · 2.3483° E",
 *   accent:   "le 5 mai"        // 可选小字
 * }
 * hero (type=icon): {
 *   type: "icon",
 *   svgKey: "mountain-seceda",   // 指向 demo 内置 SVG
 *   caption: "SECEDA · 2519 m"
 * }
 * hero (type=map): {
 *   type: "map",
 *   svgInline: "<svg ...>...</svg>",   // 手绘风地图片段
 *   caption: "Castelrotto → Seceda"
 * }
 *
 * weather: {
 *   tempLow: 11, tempHigh: 19, code: "晴", sunrise: "06:21", sunset: "21:08"
 * }
 *
 * map: {
 *   svgInline: "<svg ...>...</svg>",   // 当日整体路径（可与 hero.map 不同）
 *   caption: "CDG → Place Vendôme · 27 km"
 * }
 *
 * ticket: {
 *   kind:    "flight" | "rail" | "drive" | "ferry" | "bus" | "meal" | "lodge",
 *   carrier: "Air China",
 *   code:    "CA933",
 *   from:    "PEK T3",
 *   to:      "CDG",
 *   timeFrom:"01:30",
 *   timeTo:  "06:25",
 *   note:    "13h B777-300ER"
 * }
 */
