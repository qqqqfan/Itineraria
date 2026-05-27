/* DOM / HTML 工具函数 */

export function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 创建一个表单 field 容器（label + 必填星号） */
export function makeField(label, required) {
  const field = document.createElement("label");
  field.className = "field field--wide";
  const span = document.createElement("span");
  span.className = "field__label";
  span.innerHTML = required
    ? `${escapeHtml(label)} <em class="field__required">*</em>`
    : escapeHtml(label);
  field.appendChild(span);
  return field;
}

/** Leaflet 彩色 div icon */
export function makeColoredDivIcon(color, glyph) {
  return window.L.divIcon({
    className: "studio-marker",
    html: `<div class="studio-marker__inner" style="background:${color}">${glyph || ""}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
