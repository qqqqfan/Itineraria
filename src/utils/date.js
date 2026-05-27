/* 日期工具 */

export function ymd(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatDateRange(date) {
  if (!date) return "";
  if (date.from === date.to) return date.from;
  return `${date.from} → ${date.to}`;
}

export function weekdayOf(ymdStr) {
  const d = new Date(ymdStr + "T00:00:00");
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

export function nightsBetween(fromIso, toIso) {
  const from = new Date(fromIso + "T00:00:00");
  const to = new Date(toIso + "T00:00:00");
  if (isNaN(from) || isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86400000));
}
