/* Event 数据模型 + 排序 / 完整性判断 */

export const EVENT_TYPES = [
  { value: "酒店", emoji: "🏨" },
  { value: "游览", emoji: "🗺️" },
  { value: "餐饮", emoji: "🍜" },
  { value: "活动", emoji: "🎉" },
  { value: "交通", emoji: "✈️" },
];

export const TYPE_COLOR = {
  酒店: "#6e3131",
  游览: "#1f6a74",
  餐饮: "#8f6c30",
  活动: "#3f6b45",
  交通: "#2a221c",
};

export const TRANSPORT_MODES = [
  // 自驾用 OSRM 真实路径距离+时长；其余仅显示直线距离，不展示时长
  { value: "flight", label: "✈️ 飞机", emoji: "✈️" },
  { value: "rail",   label: "🚄 高铁", emoji: "🚄" },
  { value: "drive",  label: "🚗 自驾", emoji: "🚗" },
  { value: "ferry",  label: "🚢 轮船", emoji: "🚢" },
  { value: "bus",    label: "🚌 大巴", emoji: "🚌" },
];

/* Event：
 *   id, type, name, date{from,to}|null, tags[], sortIndex
 *   通用类: anchor: { status: "precise"|"manual"|"none", lat, lon, label }
 *   交通类: anchorFrom, anchorTo, transportMode (必填)
 */

export function emptyEvent(type = "游览") {
  const base = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    name: "",
    date: null, // {from:"YYYY-MM-DD", to:"YYYY-MM-DD"} or null
    tags: [],
    sortIndex: Date.now(),
  };
  if (type === "交通") {
    return {
      ...base,
      transportMode: "",
      anchorFrom: emptyAnchor(),
      anchorTo: emptyAnchor(),
    };
  }
  return { ...base, anchor: emptyAnchor() };
}

export function emptyAnchor() {
  return { status: "none", lat: null, lon: null, label: "" };
}

export function cloneAnchor(a) {
  return { status: a.status, lat: a.lat, lon: a.lon, label: a.label };
}

export function isAnchorSet(a) {
  return a && a.status && a.status !== "none" && a.lat != null && a.lon != null;
}

/**
 * 判断单条 event 是否"完整"：
 *   - 通用类：anchor 已锚定（precise 或 manual）即可；
 *     name 不强制——anchor.label 可以兜底（confirmLocation 也会镜像到 name）。
 *   - 交通类：anchorFrom/anchorTo 都已锚定、transportMode 已选；name 选填。
 *   - date 不强制（PRD 里日期选填）
 */
export function isEventComplete(evt) {
  if (!evt) return false;
  if (evt.type === "交通") {
    return Boolean(evt.transportMode) && isAnchorSet(evt.anchorFrom) && isAnchorSet(evt.anchorTo);
  }
  return isAnchorSet(evt.anchor);
}

export function hasDate(evt) {
  return evt.date && evt.date.from && evt.date.to;
}

export function allHaveDate(state) {
  return state.events.length > 0 && state.events.every(hasDate);
}

export function sortedEvents(state) {
  const dated = state.events.filter(hasDate).slice().sort((a, b) => {
    return a.date.from.localeCompare(b.date.from) || a.date.to.localeCompare(b.date.to);
  });
  const undated = state.events
    .filter((e) => !hasDate(e))
    .slice()
    .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));
  return [...dated, ...undated];
}

export function nextSortIndex(state) {
  const max = state.events.reduce((m, e) => Math.max(m, e.sortIndex || 0), 0);
  return max + 1;
}

export function emojiOf(type) {
  const found = EVENT_TYPES.find((t) => t.value === type);
  return found ? found.emoji : "";
}

/** 按 transportMode 返回对应 emoji；找不到回退到 ✈️ */
export function transportEmojiOf(evt) {
  const found = TRANSPORT_MODES.find((m) => m.value === evt.transportMode);
  return found ? found.emoji : "✈️";
}

export function typeKey(type) {
  const map = { 酒店: "hotel", 游览: "tour", 餐饮: "food", 活动: "event", 交通: "transport" };
  return map[type] || "tour";
}

export function displayDefaultName(evt) {
  if (evt.type === "交通") {
    const f = (evt.anchorFrom && evt.anchorFrom.label) || "?";
    const t = (evt.anchorTo && evt.anchorTo.label) || "?";
    return `${f} → ${t}`;
  }
  // 非交通：anchor.label 可作 name 兜底（用户没填 name 时折叠摘要也不会显得空）
  if (evt.anchor && evt.anchor.label) return evt.anchor.label;
  return evt.type;
}

export function statusEmoji(status) {
  if (status === "precise") return "✅";
  if (status === "manual") return "🟡";
  return "❌";
}

export function buildTransportSubtitle(evt) {
  const fromLabel = evt.anchorFrom && evt.anchorFrom.label ? evt.anchorFrom.label : "?";
  const toLabel = evt.anchorTo && evt.anchorTo.label ? evt.anchorTo.label : "?";
  const modeLabel = (TRANSPORT_MODES.find((m) => m.value === evt.transportMode) || {}).label || "未选交通方式";
  return `${modeLabel} · ${fromLabel} → ${toLabel}`;
}

export function analyzeEvents(state) {
  const stats = {
    total: state.events.length,
    missingLocation: 0,
    missingTransportMode: 0,
  };
  state.events.forEach((evt) => {
    if (evt.type === "交通") {
      if (!evt.transportMode) stats.missingTransportMode += 1;
      if (!isAnchorSet(evt.anchorFrom) || !isAnchorSet(evt.anchorTo)) stats.missingLocation += 1;
    } else {
      if (!isAnchorSet(evt.anchor)) stats.missingLocation += 1;
    }
  });
  return stats;
}
