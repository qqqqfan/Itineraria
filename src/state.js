/* 全局 state 创建 */

export const STORAGE_KEY = "plan-your-tour-studio-v1.0";
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// OSM Nominatim 公共服务的"identifying yourself"政策：浏览器无法设 User-Agent，
// 改用 email= 查询参数声明联系人。如有需要请改成你的真实邮箱。
// 留空字符串表示不附带（不推荐：碰到滥用封禁会无从联系）。
export const NOMINATIM_EMAIL = "tripstudio-personal@local.invalid";
export const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
export const FLIGHT_AVG_KMH = 900;

export function createState() {
  return {
    storageKey: STORAGE_KEY,
    activeMode: "form",
    trip: { title: "" },
    events: [],
    // hideEdgeTransport: 持久化的"隐藏头尾大交通"开关
    previewView: { tab: "map", sub: "day", hideEdgeTransport: false },
    persistTimer: null,
    // UI 运行时状态（不持久化）
    ui: {
      // 当前展开的 event id 集合：用户必须主动点开才会进入；
      // 完整后点 ✅ / 再次点头部即可折叠；不完整时无法折叠（避免必填被藏）
      expandedIds: new Set(),
      justAddedId: null, // 最近一次新加的 event id，用于高亮+滚动+focus
    },
    // 地点浮窗运行时状态
    locationModal: {
      open: false,
      target: null, // { eventId, field: "anchor"|"anchorFrom"|"anchorTo" }
      map: null,
      marker: null,
      candidates: [],
      pickedAnchor: null, // 当前在浮窗内待确认的锚点
      searchAbort: null, // 当前 in-flight 搜索的 AbortController
      lastQuery: "",
      lastFocus: null, // 关闭时焦点回弹的目标
    },
    // 预览运行时状态
    preview: {
      map: null,
      pointLayer: null,
      lineLayer: null,
      transportLayer: null,
      activeTransportId: null,
      transportCache: new Map(), // key: eventId, value: latlng[]
    },
    // 自动锚定运行状态（之前是模块级 let，挪进 state 集中管理）
    autoAnchor: {
      running: false,
    },
  };
}
