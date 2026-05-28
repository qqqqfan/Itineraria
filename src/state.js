/* 全局 state 创建 */

// v0.1 旧键（保留作首发版本备份）
export const STORAGE_KEY = "plan-your-tour-studio-v1.0";
// v1.0 多 trip 命名空间：索引 + 每 trip 一键
export const STORAGE_PREFIX = "plan-your-tour-studio-v1.0";
export const INDEX_KEY = `${STORAGE_PREFIX}:index`;
export function tripKey(id) { return `${STORAGE_PREFIX}:trip:${id}`; }

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
    // v1.0 多 trip
    activeTripId: null,
    tripIndex: [], // IndexEntry[] 镜像，library 模式渲染用
    trip: {
      id: null,
      title: "",
      // v1.0 不存在"发布"概念（v1.1+ 才有明信片导出 = 真正的发布）。
      // 这里只保留身份与时间戳。
      createdAt: null,
      updatedAt: null,
    },
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
    // 自动锚定运行状态：generation 用作跨 trip 取消令牌
    // 切 trip 时 ++generation；in-flight 任务发现 mismatch 立即返回，避免串写
    autoAnchor: {
      running: false,
      generation: 0,
    },
  };
}
